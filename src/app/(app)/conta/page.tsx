import { exigirUsuario } from '@/lib/auth';
import { alterarMinhaSenha } from '@/app/actions/cadastros';

export const metadata = { title: 'EcommFlow · Minha conta' };

export default async function Conta() {
  const s = await exigirUsuario();
  return (
    <>
      <h2 style={{ margin: '0 0 14px' }}>Minha conta</h2>
      <div className="card form">
        <p><b>{s.nome}</b> <span className="desc">({s.perfil}) · {s.escNome}</span></p>
        <h3 style={{ marginTop: 18 }}>Alterar senha</h3>
        <form action={alterarMinhaSenha} autoComplete="off">
          <input type="hidden" name="back" value="/conta" />
          <label>Senha atual</label><input type="password" name="atual" required autoComplete="current-password" />
          <label>Nova senha</label><input type="password" name="nova" required minLength={8} autoComplete="new-password" />
          <label>Confirme a nova senha</label><input type="password" name="confirma" required minLength={8} autoComplete="new-password" />
          <p className="desc">Mínimo de 8 caracteres, com letras e números.</p>
          <button className="btn" style={{ marginTop: 12 }}>Alterar senha</button>
        </form>
      </div>
    </>
  );
}
