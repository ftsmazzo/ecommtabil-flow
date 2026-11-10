import { redirect } from 'next/navigation';
import { sessao } from '@/lib/auth';
import { Logo } from '@/components/Logo';
import { ARTE_LOGIN, FUNDO_LOGIN } from '@/components/arte';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'EcommFlow · Entrar' };

// Tela de login neutra (produto licenciável): não exibe dados do escritório.
export default async function LoginPage({ searchParams }: { searchParams: { expirado?: string } }) {
  if (await sessao()) redirect('/dashboard');
  return (
    <div className="login">
      <div className="lbg" dangerouslySetInnerHTML={{ __html: FUNDO_LOGIN }} />
      <div className="lwrap">
        <div className="lart" aria-hidden="true">
          <div className="lbrand"><Logo size={40} /><div><b>EcommFlow</b><span>Gestão de tarefas e rotinas</span></div></div>
          <div dangerouslySetInnerHTML={{ __html: ARTE_LOGIN }} />
          <p className="lcap">Rotinas, prazos e conferências<br />em um só fluxo.</p>
        </div>
        <div className="lbox">
          <div className="lmob"><Logo size={44} /></div>
          <h2>Bem-vindo ao <span style={{ color: 'var(--pri)' }}>EcommFlow</span></h2>
          <p className="mut" style={{ margin: '2px 0 8px' }}>Entre com seu usuário e senha</p>
          {searchParams.expirado && <div className="lerr">Sua sessão expirou ou o acesso foi desativado.</div>}
          <LoginForm />
          <p className="desc" style={{ marginTop: 18 }}>© EcommFlow · acesso restrito a usuários cadastrados</p>
        </div>
      </div>
    </div>
  );
}
