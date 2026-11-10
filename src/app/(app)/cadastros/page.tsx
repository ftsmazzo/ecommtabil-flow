import Link from 'next/link';
import { exigirGestor } from '@/lib/auth';
import { q } from '@/lib/db';
import { fmtComp, fmtDataHora } from '@/lib/format';
import { pessoas } from '@/lib/tarefas';

export const metadata = { title: 'EcommFlow · Cadastros' };

type SP = { aba?: string; q?: string; grupo?: string; operador?: string; regime?: string };

export default async function Cadastros({ searchParams: sp }: { searchParams: SP }) {
  const s = await exigirGestor();
  const aba = sp.aba === 'usuarios' ? 'usuarios' : 'clientes';
  const tabs = (
    <div className="tabs">
      <Link href="/cadastros" className={aba === 'clientes' ? 'on' : ''}>🏢 Clientes</Link>
      <Link href="/cadastros?aba=usuarios" className={aba === 'usuarios' ? 'on' : ''}>👤 Usuários</Link>
    </div>
  );

  if (aba === 'usuarios') {
    const U = await q<{ id: number; nome: string; usuario: string; perfil: string; ativo: boolean; ultimo_acesso: string | null; empresas: number; sem_senha: boolean }>(
      `SELECT o.id, o.nome, o.usuario, o.perfil, o.ativo, o.ultimo_acesso, o.senha_hash IS NULL AS sem_senha,
              (SELECT count(*) FROM clientes c WHERE c.operador_padrao = o.id AND c.ativo) AS empresas
         FROM operadores o WHERE o.escritorio_id = $1 ORDER BY o.ativo DESC, o.perfil DESC, o.nome`, [s.esc]);
    return (
      <>
        <h2 style={{ margin: '0 0 14px' }}>Cadastros</h2>{tabs}
        <div className="filtros"><Link className="btn" href="/cadastros/usuarios/novo">+ Novo usuário</Link></div>
        <div className="card tblwrap"><table>
          <thead><tr><th>Nome</th><th>Usuário</th><th>Perfil</th><th>Empresas</th><th>Último acesso</th><th>Status</th><th></th></tr></thead>
          <tbody>{U.map((u) => (
            <tr key={u.id} style={u.ativo ? undefined : { opacity: 0.55 }}>
              <td>{u.nome}</td><td><code>{u.usuario}</code></td><td>{u.perfil}</td><td>{u.empresas}</td><td className="desc">{fmtDataHora(u.ultimo_acesso)}</td>
              <td>{!u.ativo ? <span className="tag pendente">Inativo</span> : u.sem_senha ? <span className="tag atrasada">Sem senha</span> : <span className="tag concluida">Ativo</span>}</td>
              <td><Link className="btn sm gh" href={`/cadastros/usuarios/${u.id}`}>✎ Editar</Link></td>
            </tr>))}
          </tbody></table></div>
      </>
    );
  }

  const [C, grupos, ops] = await Promise.all([
    q<{ id: number; cod_alter: string | null; razao_social: string; cnpj: string | null; grupo: string | null; ramo: string | null; regime: string | null; entrada: string | null; contato: string | null; responsavel: string | null; ativo: boolean }>(
      `SELECT c.id, c.cod_alter, c.razao_social, c.cnpj, g.nome AS grupo, c.ramo, c.regime, c.entrada_escritorio AS entrada,
              c.contato_documentos AS contato, o.nome AS responsavel, c.ativo
         FROM clientes c LEFT JOIN grupos g ON g.id = c.grupo_id LEFT JOIN operadores o ON o.id = c.operador_padrao
        WHERE c.escritorio_id = $1
          AND ($2 = '' OR c.razao_social ILIKE '%' || $2 || '%' OR regexp_replace(COALESCE(c.cnpj,''), '\\D', '', 'g') LIKE '%' || regexp_replace($2, '\\D', '', 'g') || '%' AND length(regexp_replace($2, '\\D', '', 'g')) > 2 OR g.nome ILIKE '%' || $2 || '%')
          AND ($3 = '' OR g.nome = $3) AND ($4 = '' OR c.operador_padrao::text = $4 OR ($4 = '0' AND c.operador_padrao IS NULL)) AND ($5 = '' OR c.regime = $5)
        ORDER BY c.ativo DESC, c.razao_social`, [s.esc, sp.q || '', sp.grupo || '', sp.operador || '', sp.regime || '']),
    q<{ nome: string }>('SELECT nome FROM grupos WHERE escritorio_id = $1 ORDER BY nome', [s.esc]),
    pessoas(s),
  ]);
  return (
    <>
      <h2 style={{ margin: '0 0 14px' }}>Cadastros</h2>{tabs}
      <form className="filtros">
        <Link className="btn" href="/cadastros/clientes/novo">+ Novo cliente</Link>
        <input name="q" placeholder="🔎 Empresa, CNPJ ou grupo" defaultValue={sp.q || ''} />
        <select name="grupo" defaultValue={sp.grupo || ''}><option value="">Todos os grupos</option>{grupos.map((g) => <option key={g.nome}>{g.nome}</option>)}</select>
        <select name="operador" defaultValue={sp.operador || ''}><option value="">Todos responsáveis</option>{ops.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}<option value="0">⚠ Sem responsável</option></select>
        <select name="regime" defaultValue={sp.regime || ''}><option value="">Todos regimes</option>{['Simples Nacional', 'MEI', 'Lucro Presumido', 'Lucro Real'].map((r) => <option key={r}>{r}</option>)}</select>
        <button className="btn sm">Filtrar</button>
        <span className="mut right" style={{ alignSelf: 'center' }}>{C.length} empresa(s)</span>
      </form>
      <div className="card tblwrap"><table>
        <thead><tr><th>Cód</th><th>Empresa</th><th>Grupo</th><th>CNPJ/CPF</th><th>Ramo</th><th>Regime</th><th>Entrada</th><th>Contato docs</th><th>Responsável</th><th></th></tr></thead>
        <tbody>{C.map((c) => (
          <tr key={c.id} style={c.ativo ? undefined : { opacity: 0.55 }}>
            <td className="desc">{c.cod_alter}</td><td>{c.razao_social}</td>
            <td>{c.grupo && <Link className="tag grp" href={`/cadastros?grupo=${encodeURIComponent(c.grupo)}`}>{c.grupo}</Link>}</td>
            <td style={{ whiteSpace: 'nowrap' }}>{c.cnpj || '—'}</td><td>{c.ramo || '—'}</td><td>{c.regime || '—'}</td>
            <td className="desc">{c.entrada ? fmtComp(c.entrada) : ''}</td>
            <td>{c.contato ? `${c.contato.includes('@') ? '✉' : '📱'} ${c.contato}` : '—'}</td>
            <td>{c.responsavel || <span className="tag atrasada">Sem responsável</span>}</td>
            <td><Link className="btn sm gh" href={`/cadastros/clientes/${c.id}`}>✎</Link></td>
          </tr>))}
        </tbody></table></div>
    </>
  );
}
