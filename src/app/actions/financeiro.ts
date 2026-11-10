'use server';
import { exigirGestor } from '@/lib/auth';
import { ErroNegocio, bool, executar, num, txt } from '@/lib/acao';
import { q, q1, tx } from '@/lib/db';
import { brl, digitos, fmtData, mascaraDoc, normalizar, parseValor, REGIMES } from '@/lib/format';
import { lerBoleto, textoPdf } from '@/lib/boleto';

export async function receberBoleto(fd: FormData) {
  const s = await exigirGestor();
  const desfazer = bool(fd, 'desfazer');
  await executar(fd, async () => {
    const data = txt(fd, 'data') || null;
    const r = await tx(s, (c) =>
      c.query(
        desfazer
          ? 'UPDATE boletos SET pago_em = NULL, valor_pago = NULL WHERE id = $1 AND escritorio_id = $2'
          : 'UPDATE boletos SET pago_em = COALESCE($3::date, CURRENT_DATE), valor_pago = valor WHERE id = $1 AND escritorio_id = $2 AND gerado_em IS NOT NULL',
        desfazer ? [num(fd, 'id'), s.esc] : [num(fd, 'id'), s.esc, data],
      ),
    );
    if (!r.rowCount) throw new ErroNegocio('Boleto não encontrado ou ainda não gerado.');
  }, desfazer ? 'Recebimento desfeito.' : 'Recebimento registrado.', '/financeiro/boletos');
}

/** Cadastro/edição de cobrança: mensal (rotinas GERAR + ENVIAR) ou avulsa (boleto único). */
export async function salvarCobranca(fd: FormData) {
  const s = await exigirGestor();
  await executar(fd, async () => {
    const cobranca = num(fd, 'cobranca');
    const valor = parseValor(txt(fd, 'valor'));
    if (!(valor > 0)) throw new ErroNegocio('Informe o valor do boleto.');
    const resp = num(fd, 'responsavel');
    const g = await q1('SELECT 1 FROM operadores WHERE id = $1 AND escritorio_id = $2 AND perfil = $3', [resp, s.esc, 'gestor']);
    if (!g) throw new ErroNegocio('O responsável deve ser um gestor.');
    const obs = txt(fd, 'observacao') || null;
    const tipo = txt(fd, 'tipo') === 'avulso' ? 'avulso' : 'mensal';
    const diaV = num(fd, 'dia_vencimento');
    const diaG = num(fd, 'dia_gerar');
    const diaE = num(fd, 'dia_enviar');
    const okDia = (d: number | null) => d !== null && d >= 1 && d <= 31;
    if (tipo === 'mensal' && !(okDia(diaV) && okDia(diaG) && okDia(diaE))) throw new ErroNegocio('Os dias devem estar entre 1 e 31.');
    const dataV = txt(fd, 'data_vencimento');
    const dataG = txt(fd, 'data_gerar') || dataV;
    if (tipo === 'avulso' && !/^\d{4}-\d{2}-\d{2}$/.test(dataV)) throw new ErroNegocio('Informe a data de vencimento do boleto.');

    const dep = await q1<{ id: number }>('SELECT id FROM departamentos WHERE escritorio_id = $1 AND restrito_gestor ORDER BY id LIMIT 1', [s.esc]);
    if (!dep) throw new ErroNegocio('Cadastre o departamento FINANCEIRO (restrito a gestores).');

    await tx(s, async (c) => {
      if (cobranca) {
        const r = await c.query(
          `UPDATE rotinas SET valor = $3, operador_id = $4, observacao = $5,
                  dia_vencimento_boleto = COALESCE($6, dia_vencimento_boleto),
                  dia_mes = CASE WHEN periodicidade = 'unica' THEN dia_mes
                                 WHEN acao_financeira = 'gerar_boleto' THEN COALESCE($7, dia_mes) ELSE COALESCE($8, dia_mes) END
            WHERE cobranca_id = $1 AND escritorio_id = $2`,
          [cobranca, s.esc, valor, resp, obs, tipo === 'mensal' ? diaV : null, diaG, diaE],
        );
        if (!r.rowCount) throw new ErroNegocio('Cobrança não encontrada.');
        if (bool(fd, 'aplicar')) {
          await c.query(
            `UPDATE tarefas t SET valor = $2, operador_id = $3 FROM rotinas r
              WHERE r.cobranca_id = $1 AND t.rotina_id = r.id AND t.status NOT IN ('concluida','cancelada')`,
            [cobranca, valor, resp],
          );
          await c.query('UPDATE boletos SET valor = $2 WHERE cobranca_id = $1 AND enviado_em IS NULL AND pago_em IS NULL', [cobranca, valor]);
        }
        return;
      }

      // Cliente: existente ou novo
      let cliente = num(fd, 'cliente');
      if (txt(fd, 'cliente') === 'novo') {
        const nome = txt(fd, 'novo_nome').toUpperCase();
        const doc = txt(fd, 'novo_doc');
        if (!nome) throw new ErroNegocio('Informe o nome da nova empresa.');
        if (![11, 14].includes(digitos(doc).length)) throw new ErroNegocio('CNPJ (14 dígitos) ou CPF (11 dígitos) inválido.');
        const existe = await c.query("SELECT 1 FROM clientes WHERE escritorio_id = $1 AND regexp_replace(cnpj, '\\D', '', 'g') = $2", [s.esc, digitos(doc)]);
        if (existe.rowCount) throw new ErroNegocio('Este CNPJ/CPF já está cadastrado — selecione a empresa na lista.');
        const reg = REGIMES.includes(txt(fd, 'novo_regime')) ? txt(fd, 'novo_regime') : null;
        const r = await c.query(
          `INSERT INTO clientes (escritorio_id, razao_social, cnpj, regime, contato_documentos, operador_padrao, entrada_escritorio)
           VALUES ($1,$2,$3,$4,$5,$6,date_trunc('month', CURRENT_DATE)) RETURNING id`,
          [s.esc, nome, mascaraDoc(doc), reg, txt(fd, 'novo_contato') || null, resp],
        );
        cliente = r.rows[0].id;
      }
      const ok = await c.query('SELECT 1 FROM clientes WHERE id = $1 AND escritorio_id = $2', [cliente, s.esc]);
      if (!ok.rowCount) throw new ErroNegocio('Selecione o cliente.');

      const cob = (await c.query("SELECT nextval('cobranca_seq') AS id")).rows[0].id;
      const ids: number[] = [];
      for (const [titulo, acao, dia] of [['GERAR BOLETOS', 'gerar_boleto', diaG], ['ENVIAR BOLETOS', 'enviar_boleto', diaE]] as const) {
        const r = await c.query(
          `INSERT INTO rotinas (escritorio_id, titulo, departamento_id, cliente_id, operador_id, periodicidade, dia_mes, data_unica,
                                prioridade, acao_financeira, cobranca_id, valor, dia_vencimento_boleto, data_vencimento_boleto, observacao, criado_por)
           VALUES ($1,$2,$3,$4,$5,$6::periodicidade,$7,$8,'alta',$9::acao_financeira,$10,$11,$12,$13,$14,$15) RETURNING id`,
          [s.esc, titulo, dep.id, cliente, resp, tipo === 'mensal' ? 'mensal' : 'unica', tipo === 'mensal' ? dia : null,
           tipo === 'avulso' ? dataG : null, acao, cob, valor, tipo === 'mensal' ? diaV : null, tipo === 'avulso' ? dataV : null, obs, s.id],
        );
        ids.push(r.rows[0].id);
      }
      for (const id of ids) await c.query('SELECT gerar_tarefa_rotina($1, CURRENT_DATE, TRUE)', [id]);
    });
  }, 'Cobrança salva.', '/financeiro/cobrancas');
}

export async function alternarCobranca(fd: FormData) {
  const s = await exigirGestor();
  await executar(fd, async () => {
    await tx(s, (c) =>
      c.query("UPDATE rotinas SET ativa = NOT ativa WHERE cobranca_id = $1 AND escritorio_id = $2 AND periodicidade <> 'unica'", [num(fd, 'cobranca'), s.esc]),
    );
  }, 'Cobrança atualizada.', '/financeiro/cobrancas');
}

// ---------------------------------------------------------------------
// Conciliação de PDFs
// ---------------------------------------------------------------------
export type LinhaConciliacao = {
  arquivo: string;
  pagador: string;
  documento: string;
  valor: number | null;
  vencimento: string;
  nossoNumero: string;
  resultado: 'confere' | 'divergente' | 'nao_encontrado' | 'duplicado';
  mensagens: string[];
  clienteNome?: string;
  boletoId?: number;
};

export async function lerPdfs(_prev: unknown, fd: FormData): Promise<{ linhas: LinhaConciliacao[]; erro?: string }> {
  const s = await exigirGestor();
  const arquivos = fd.getAll('pdfs').filter((f): f is File => f instanceof File && f.size > 0);
  if (!arquivos.length) return { linhas: [], erro: 'Selecione ao menos um PDF.' };
  if (arquivos.length > 300) return { linhas: [], erro: 'Envie no máximo 300 PDFs por vez.' };

  const esc = await q1<{ cnpj: string | null }>('SELECT cnpj FROM escritorios WHERE id = $1', [s.esc]);
  const clientes = await q<{ id: number; razao_social: string; cnpj: string | null }>(
    'SELECT id, razao_social, cnpj FROM clientes WHERE escritorio_id = $1', [s.esc]);
  const boletos = await q<{ id: number; cliente_id: number; valor: number; vencimento: string; enviado_em: string | null; gerado_em: string | null; nosso_numero: string | null }>(
    'SELECT id, cliente_id, valor, vencimento, enviado_em, gerado_em, nosso_numero FROM boletos WHERE escritorio_id = $1', [s.esc]);

  const linhas: LinhaConciliacao[] = [];
  const usados = new Set<number>();
  for (const f of arquivos) {
    const l: LinhaConciliacao = { arquivo: f.name, pagador: '', documento: '', valor: null, vencimento: '', nossoNumero: '', resultado: 'confere', mensagens: [] };
    linhas.push(l);
    if (!/\.pdf$/i.test(f.name) || f.size > 5 * 1024 * 1024) { l.resultado = 'nao_encontrado'; l.mensagens.push('Arquivo inválido (somente PDF até 5 MB).'); continue; }
    let d;
    try { d = lerBoleto(await textoPdf(await f.arrayBuffer()), esc?.cnpj || ''); } catch { l.resultado = 'nao_encontrado'; l.mensagens.push('PDF ilegível.'); continue; }
    Object.assign(l, { pagador: d.pagador, documento: d.documento, valor: d.valor, vencimento: d.vencimento, nossoNumero: d.nossoNumero });
    if (!d.valor || !d.vencimento) { l.resultado = 'nao_encontrado'; l.mensagens.push('Não foi possível ler valor/vencimento do boleto.'); continue; }
    if (esc?.cnpj && !d.beneficiarioDoc.some((b) => digitos(b) === digitos(esc.cnpj))) l.mensagens.push(`Beneficiário diferente do escritório (${esc.cnpj}).`);
    const dup = d.nossoNumero && boletos.find((b) => b.nosso_numero === d.nossoNumero);
    if (dup) { l.resultado = 'duplicado'; l.mensagens.push(`Boleto já conciliado anteriormente (nosso número ${d.nossoNumero}).`); continue; }

    let c = clientes.find((x) => digitos(x.cnpj) === digitos(d.documento));
    if (!c) {
      const p = normalizar(d.pagador);
      c = clientes.find((x) => normalizar(x.razao_social) === p) ||
          clientes.find((x) => normalizar(x.razao_social).startsWith(p) || p.startsWith(normalizar(x.razao_social))) ||
          clientes.find((x) => normalizar(x.razao_social).split(' ').slice(0, 2).join(' ') === p.split(' ').slice(0, 2).join(' '));
      if (c) l.mensagens.push(`CPF/CNPJ do pagador (${d.documento}) diferente do cadastro (${c.cnpj}) — localizado pelo nome.`);
    }
    if (!c) { l.resultado = 'nao_encontrado'; l.mensagens.push(`Pagador "${d.pagador}" (${d.documento}) não encontrado no cadastro.`); continue; }
    l.clienteNome = c.razao_social;
    const alvo = boletos
      .filter((b) => b.cliente_id === c!.id && !b.enviado_em && !usados.has(b.id))
      .sort((a, b) => Math.abs(+new Date(a.vencimento) - +new Date(d!.vencimento)) - Math.abs(+new Date(b.vencimento) - +new Date(d!.vencimento)))[0];
    if (!alvo) { l.resultado = 'nao_encontrado'; l.mensagens.push('Não há boleto pendente de envio para esta empresa.'); continue; }
    usados.add(alvo.id);
    l.boletoId = alvo.id;
    if (Math.abs(alvo.valor - d.valor) > 0.009) l.mensagens.push(`Valor divergente: PDF ${brl(d.valor)} × previsto ${brl(alvo.valor)}.`);
    if (alvo.vencimento !== d.vencimento) l.mensagens.push(`Vencimento divergente: PDF ${fmtData(d.vencimento)} × previsto ${fmtData(alvo.vencimento)}.`);
    if (l.mensagens.length) l.resultado = 'divergente';
    if (!alvo.gerado_em) l.mensagens.push('A tarefa GERAR BOLETOS será concluída junto.');
  }
  return { linhas };
}

export async function aplicarConciliacao(fd: FormData) {
  const s = await exigirGestor();
  await executar(fd, async () => {
    const linhas = JSON.parse(String(fd.get('dados') || '[]')) as LinhaConciliacao[];
    const marcados = new Set(fd.getAll('ok').map(String));
    let n = 0;
    await tx(s, async (c) => {
      for (const [i, l] of linhas.entries()) {
        const aceitar = l.boletoId && marcados.has(String(i)) && ['confere', 'divergente'].includes(l.resultado);
        if (aceitar) {
          const b = await c.query('SELECT id, tarefa_gerar_id, tarefa_enviar_id FROM boletos WHERE id = $1 AND escritorio_id = $2 AND enviado_em IS NULL', [l.boletoId, s.esc]);
          if (!b.rowCount) continue;
          const div = l.resultado === 'divergente' ? l.mensagens.filter((m) => !m.startsWith('A tarefa GERAR')).join(' ') + ' (aceito na conciliação)' : null;
          await c.query(
            `UPDATE boletos SET valor = $2, vencimento = $3, competencia = date_trunc('month', $3::date), nosso_numero = NULLIF($4, ''),
                    arquivo_pdf = $5, divergencia = $6, gerado_em = COALESCE(gerado_em, now()), enviado_em = now() WHERE id = $1`,
            [l.boletoId, l.valor, l.vencimento, l.nossoNumero, l.arquivo, div],
          );
          for (const t of [b.rows[0].tarefa_gerar_id, b.rows[0].tarefa_enviar_id].filter(Boolean)) {
            await c.query("UPDATE tarefas SET status = 'concluida' WHERE id = $1 AND status <> 'concluida'", [t]);
            await c.query("INSERT INTO historico_tarefas (tarefa_id, operador_id, acao, detalhe) VALUES ($1, $2, 'conciliacao', $3)", [t, s.id, `PDF ${l.arquivo}`]);
          }
          n++;
        }
        await c.query(
          `INSERT INTO conciliacao_boletos (escritorio_id, boleto_id, arquivo, pagador, documento, valor_pdf, vencimento_pdf, nosso_numero, resultado, mensagens, conciliado_por)
           VALUES ($1,$2,$3,$4,$5,$6,NULLIF($7,'')::date,NULLIF($8,''),$9,$10,$11)`,
          [s.esc, aceitar ? l.boletoId : null, l.arquivo, l.pagador, l.documento, l.valor, l.vencimento, l.nossoNumero, l.resultado, l.mensagens.join(' | '), s.id],
        );
      }
    });
    return n ? undefined : '/financeiro/conciliacao';
  }, 'Conciliação registrada. Envios concluídos para os boletos selecionados.', '/financeiro');
}
