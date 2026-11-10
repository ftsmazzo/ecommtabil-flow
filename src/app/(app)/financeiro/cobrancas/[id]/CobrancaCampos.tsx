'use client';
import { useEffect, useState } from 'react';

type Cli = { id: number; razao_social: string; cnpj: string | null };

function mascara(x: string) {
  const d = x.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 11) return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
}

export function CobrancaCampos({ nova, clientes, tipoInicial, hoje }: { nova: boolean; clientes: Cli[]; tipoInicial: 'mensal' | 'avulso'; hoje: string }) {
  const [cli, setCli] = useState('');
  const [tipo, setTipo] = useState(tipoInicial);
  const [doc, setDoc] = useState('');
  // Mostra/oculta os campos de dias do tipo mensal (renderizados no servidor)
  useEffect(() => {
    document.querySelectorAll<HTMLElement>('[data-tipo="mensal"]').forEach((e) => (e.style.display = tipo === 'mensal' ? '' : 'none'));
  }, [tipo]);
  if (!nova) return <input type="hidden" name="tipo" value={tipoInicial} />;
  return (
    <>
      <label>Cliente *</label>
      <select name="cliente" required value={cli} onChange={(e) => setCli(e.target.value)}>
        <option value="" disabled>Selecione a empresa…</option>
        <option value="novo">➕ Cadastrar nova empresa</option>
        {clientes.map((c) => <option key={c.id} value={c.id}>{c.razao_social} · {c.cnpj}</option>)}
      </select>
      {cli === 'novo' && (
        <div style={{ border: '1px dashed var(--bd)', borderRadius: 10, padding: '4px 12px 12px', marginTop: 8, background: '#f8fafc' }}>
          <label>Razão social / Nome *</label><input name="novo_nome" required />
          <div className="row">
            <div><label>CNPJ ou CPF *</label><input name="novo_doc" required value={doc} onChange={(e) => setDoc(mascara(e.target.value))} placeholder="00.000.000/0000-00 ou 000.000.000-00" /></div>
            <div><label>Regime</label><select name="novo_regime" defaultValue="Simples Nacional">{['Simples Nacional', 'MEI', 'Lucro Presumido', 'Lucro Real'].map((r) => <option key={r}>{r}</option>)}</select></div>
          </div>
          <label>Contato para envio do boleto</label><input name="novo_contato" placeholder="E-mail ou WhatsApp" />
        </div>
      )}
      <input type="hidden" name="tipo" value={tipo} />
      <label>Tipo de cobrança</label>
      <div className="seg">
        <button type="button" className={tipo === 'mensal' ? 'on' : ''} onClick={() => setTipo('mensal')}>🔁 Mensal (recorrente)</button>
        <button type="button" className={tipo === 'avulso' ? 'on' : ''} onClick={() => setTipo('avulso')}>1️⃣ Avulso (boleto único)</button>
      </div>
      {tipo === 'avulso' && (
        <div className="row">
          <div><label>Vencimento do boleto *</label><input type="date" name="data_vencimento" required /></div>
          <div><label>Gerar e enviar até</label><input type="date" name="data_gerar" defaultValue={hoje} /></div>
        </div>
      )}
    </>
  );
}
