'use client';
import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { entrar } from '@/app/actions/auth';

function Botao() {
  const { pending } = useFormStatus();
  return <button className="btn" style={{ marginTop: 16, padding: 11 }} disabled={pending}>{pending ? 'Entrando…' : 'Entrar'}</button>;
}

export function LoginForm() {
  const [estado, acao] = useFormState(entrar, {});
  const [ver, setVer] = useState(false);
  return (
    <form action={acao}>
      <label htmlFor="usuario">Usuário</label>
      <input id="usuario" name="usuario" autoComplete="username" autoFocus required />
      <label htmlFor="senha">Senha</label>
      <div style={{ position: 'relative' }}>
        <input id="senha" name="senha" type={ver ? 'text' : 'password'} autoComplete="current-password" required style={{ width: '100%', paddingRight: 40 }} />
        <button type="button" className="olho" onClick={() => setVer(!ver)} title="Mostrar senha">👁</button>
      </div>
      <div className="lerr" role="alert">{estado?.erro}</div>
      <Botao />
    </form>
  );
}
