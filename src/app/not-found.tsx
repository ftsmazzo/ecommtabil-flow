import Link from 'next/link';

export default function NaoEncontrado() {
  return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <h2>Página não encontrada</h2>
      <p className="mut">O endereço não existe ou você não tem acesso a ele.</p>
      <Link className="btn" href="/dashboard">Voltar ao início</Link>
    </div>
  );
}
