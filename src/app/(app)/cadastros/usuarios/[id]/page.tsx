import { notFound } from 'next/navigation';
import { exigirGestor } from '@/lib/auth';
import { q1 } from '@/lib/db';
import { salvarUsuario } from '@/app/actions/cadastros';

export const metadata = { title: 'EcommFlow · Usuário' };

export default async function Usuario({ params }: { params: { id: string } }) {
  const s = await exigirGestor();
  const novo = params.id === 'novo';
  const id = novo ? null : parseInt(params.id);
  if (!novo && !Number.isFinite(id)) notFound();
  const u = novo ? null : await q1<{ nome: string; usuario: string; email: string | null; perfil: string; ativo: boolean }>(
    'SELECT nome, usuario, email, perfil, ativo FROM operadores WHERE id = $1 AND escritorio_id = $2', [id, s.esc]);
  if (!novo && !u) notFound();
  return (
    <>
      <h2 style={{ margin: '0 0 14px' }}>{novo ? 'Novo usuário' : 'Editar usuário'}</h2>
      <form action={salvarUsuario} className="card form" autoComplete="off">
        {id && <input type="hidden" name="id" value={id} />}
        <input type="hidden" name="back" value={novo ? '/cadastros/usuarios/novo' : `/cadastros/usuarios/${id}`} />
        <div className="row">
          <div><label>Nome *</label><input name="nome" required defaultValue={u?.nome} /></div>
          <div><label>Usuário (login) *</label><input name="usuario" required pattern="[A-Za-z0-9._\-]{3,40}" defaultValue={u?.usuario} /></div>
        </div>
        <div className="row">
          <div><label>E-mail</label><input type="email" name="email" defaultValue={u?.email ?? ''} /></div>
          <div><label>Perfil</label><select name="perfil" defaultValue={u?.perfil ?? 'operador'}><option value="operador">Operador</option><option value="gestor">Gestor</option></select></div>
        </div>
        <label>{novo ? 'Senha inicial *' : 'Nova senha (deixe em branco para manter)'}</label>
        <input type="password" name="senha" autoComplete="new-password" minLength={8} required={novo} />
        <p className="desc">Mínimo de 8 caracteres, com letras e números. Oriente o usuário a trocar a senha em “Minha conta”.</p>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--tx)' }}><input type="checkbox" name="ativo" defaultChecked={u ? u.ativo : true} style={{ width: 'auto' }} /> Acesso ativo</label>
        <button className="btn" style={{ marginTop: 16 }}>Salvar</button>
      </form>
    </>
  );
}
