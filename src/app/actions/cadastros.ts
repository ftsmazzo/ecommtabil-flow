'use server';
import { exigirGestor } from '@/lib/auth';
import { ErroNegocio, bool, executar, num, txt } from '@/lib/acao';
import { q1, tx } from '@/lib/db';
import { RAMOS, REGIMES, digitos, mascaraDoc } from '@/lib/format';

export async function salvarCliente(fd: FormData) {
  const s = await exigirGestor();
  await executar(fd, async () => {
    const id = num(fd, 'id');
    const nome = txt(fd, 'razao_social').toUpperCase();
    const doc = txt(fd, 'cnpj');
    if (!nome) throw new ErroNegocio('Informe a razão social.');
    if (![11, 14].includes(digitos(doc).length)) throw new ErroNegocio('Informe um CNPJ (14 dígitos) ou CPF (11 dígitos) válido.');
    const ramo = RAMOS.includes(txt(fd, 'ramo')) ? txt(fd, 'ramo') : null;
    const regime = REGIMES.includes(txt(fd, 'regime')) ? txt(fd, 'regime') : null;
    const grupoNome = txt(fd, 'grupo').toUpperCase();
    await tx(s, async (c) => {
      let grupo: number | null = null;
      if (grupoNome) {
        const g = await c.query(
          `INSERT INTO grupos (escritorio_id, nome) VALUES ($1, $2)
           ON CONFLICT (escritorio_id, nome) DO UPDATE SET nome = EXCLUDED.nome RETURNING id`,
          [s.esc, grupoNome],
        );
        grupo = g.rows[0].id;
      }
      const vals = [nome, mascaraDoc(doc), txt(fd, 'cod_alter') || null, grupo, ramo, regime,
        txt(fd, 'entrada') ? `${txt(fd, 'entrada')}-01` : null, txt(fd, 'contato') || null, num(fd, 'operador'), bool(fd, 'ativo')];
      if (id) {
        const r = await c.query(
          `UPDATE clientes SET razao_social=$1, cnpj=$2, cod_alter=$3, grupo_id=$4, ramo=$5, regime=$6, entrada_escritorio=$7,
                  contato_documentos=$8, operador_padrao=$9, ativo=$10 WHERE id=$11 AND escritorio_id=$12`,
          [...vals, id, s.esc],
        );
        if (!r.rowCount) throw new ErroNegocio('Cliente não encontrado.');
      } else {
        await c.query(
          `INSERT INTO clientes (razao_social, cnpj, cod_alter, grupo_id, ramo, regime, entrada_escritorio, contato_documentos,
                                 operador_padrao, ativo, escritorio_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [...vals, s.esc],
        );
      }
    });
  }, 'Cliente salvo.', '/cadastros');
}

export async function salvarUsuario(fd: FormData) {
  const s = await exigirGestor();
  await executar(fd, async () => {
    const id = num(fd, 'id');
    const nome = txt(fd, 'nome');
    const usuario = txt(fd, 'usuario');
    const perfil = txt(fd, 'perfil') === 'gestor' ? 'gestor' : 'operador';
    const senha = String(fd.get('senha') || '');
    if (!nome || !/^[A-Za-z0-9._-]{3,40}$/.test(usuario)) throw new ErroNegocio('Informe nome e usuário (3 a 40 caracteres, sem espaços).');
    if (senha && (senha.length < 8 || !/\d/.test(senha) || !/[A-Za-z]/.test(senha)))
      throw new ErroNegocio('A senha deve ter pelo menos 8 caracteres, com letras e números.');
    if (!id && !senha) throw new ErroNegocio('Defina a senha inicial do novo usuário.');
    if (id === s.id && (perfil !== 'gestor' || !bool(fd, 'ativo'))) throw new ErroNegocio('Você não pode remover o próprio acesso de gestor.');
    await tx(s, async (c) => {
      let uid = id;
      if (id) {
        const r = await c.query('UPDATE operadores SET nome=$1, usuario=$2, perfil=$3::perfil_usuario, email=$4, ativo=$5 WHERE id=$6 AND escritorio_id=$7',
          [nome, usuario, perfil, txt(fd, 'email') || null, bool(fd, 'ativo'), id, s.esc]);
        if (!r.rowCount) throw new ErroNegocio('Usuário não encontrado.');
      } else {
        const r = await c.query('INSERT INTO operadores (escritorio_id, nome, usuario, perfil, email) VALUES ($1,$2,$3,$4::perfil_usuario,$5) RETURNING id',
          [s.esc, nome, usuario, perfil, txt(fd, 'email') || null]);
        uid = r.rows[0].id;
      }
      if (senha) await c.query("UPDATE operadores SET senha_hash = crypt($1, gen_salt('bf', 10)) WHERE id = $2", [senha, uid]);
    });
  }, 'Usuário salvo.', '/cadastros?aba=usuarios');
}

export async function alterarMinhaSenha(fd: FormData) {
  const { exigirUsuario } = await import('@/lib/auth');
  const s = await exigirUsuario();
  await executar(fd, async () => {
    const atual = String(fd.get('atual') || '');
    const nova = String(fd.get('nova') || '');
    if (nova !== String(fd.get('confirma') || '')) throw new ErroNegocio('A confirmação não confere com a nova senha.');
    if (nova.length < 8 || !/\d/.test(nova) || !/[A-Za-z]/.test(nova)) throw new ErroNegocio('A nova senha deve ter pelo menos 8 caracteres, com letras e números.');
    const ok = await q1("SELECT 1 FROM operadores WHERE id = $1 AND senha_hash = crypt($2, senha_hash)", [s.id, atual]);
    if (!ok) throw new ErroNegocio('Senha atual incorreta.');
    await tx(s, (c) => c.query("UPDATE operadores SET senha_hash = crypt($1, gen_salt('bf', 10)) WHERE id = $2", [nova, s.id]));
  }, 'Senha alterada com sucesso.', '/conta');
}
