// Consulta das cobranças (rotinas financeiras agrupadas por cobranca_id)
export type Cobranca = {
  cobranca_id: number; cliente_id: number; razao_social: string; cnpj: string | null; tipo: 'mensal' | 'avulso'; valor: number;
  dia_vencimento: number | null; data_vencimento: string | null; dia_gerar: number | null; dia_enviar: number | null; data_gerar: string | null;
  responsavel: string; operador_id: number; ativa: boolean; observacao: string | null; situacao_avulso: string | null;
};

export const SQL_COBRANCAS = `
  SELECT r.cobranca_id, r.cliente_id, c.razao_social, c.cnpj,
         CASE WHEN bool_or(r.periodicidade = 'unica') THEN 'avulso' ELSE 'mensal' END AS tipo,
         max(r.valor) AS valor, max(r.dia_vencimento_boleto) AS dia_vencimento, max(r.data_vencimento_boleto) AS data_vencimento,
         max(r.dia_mes) FILTER (WHERE r.acao_financeira = 'gerar_boleto') AS dia_gerar,
         max(r.dia_mes) FILTER (WHERE r.acao_financeira = 'enviar_boleto') AS dia_enviar, max(r.data_unica) AS data_gerar,
         max(o.nome) AS responsavel, max(r.operador_id) AS operador_id,
         bool_or(r.ativa) OR bool_or(r.periodicidade = 'unica') AS ativa, max(r.observacao) AS observacao,
         (SELECT b.situacao FROM vw_boletos b WHERE b.cobranca_id = r.cobranca_id ORDER BY b.competencia DESC LIMIT 1) AS situacao_avulso
    FROM rotinas r JOIN clientes c ON c.id = r.cliente_id JOIN operadores o ON o.id = r.operador_id
   WHERE r.escritorio_id = $1 AND r.cobranca_id IS NOT NULL`;

