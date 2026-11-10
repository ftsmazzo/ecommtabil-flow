'use client';
import { useState } from 'react';

const SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export function TipoTarefa({ hoje }: { hoje: string }) {
  const [tipo, setTipo] = useState<'unica' | 'recorrente'>('unica');
  const [per, setPer] = useState('mensal');
  return (
    <>
      <input type="hidden" name="tipo" value={tipo} />
      <label>Tipo</label>
      <div className="seg">
        <button type="button" className={tipo === 'unica' ? 'on' : ''} onClick={() => setTipo('unica')}>Única</button>
        <button type="button" className={tipo === 'recorrente' ? 'on' : ''} onClick={() => setTipo('recorrente')}>Recorrente</button>
      </div>
      {tipo === 'unica' ? (
        <><label>Prazo *</label><input type="date" name="prazo" required defaultValue={hoje} /></>
      ) : (
        <div className="row">
          <div><label>Repetir</label>
            <select name="periodicidade" value={per} onChange={(e) => setPer(e.target.value)}>
              <option value="mensal">Mensal</option><option value="semanal">Semanal</option><option value="diaria">Diária (dias úteis)</option>
              <option value="trimestral">Trimestral</option><option value="anual">Anual</option>
            </select></div>
          {['mensal', 'trimestral', 'anual'].includes(per) && <div><label>Dia do mês</label><input type="number" name="dia_mes" min={1} max={31} defaultValue={10} required /></div>}
          {per === 'semanal' && <div><label>Dia da semana</label><select name="dia_semana" defaultValue={1}>{SEMANA.map((d, i) => <option key={i} value={i}>{d}</option>)}</select></div>}
          {per === 'trimestral' && <div><label>Ciclo</label><select name="mes_ano" defaultValue={1}><option value={1}>jan/abr/jul/out</option><option value={2}>fev/mai/ago/nov</option><option value={3}>mar/jun/set/dez</option></select></div>}
          {per === 'anual' && <div><label>Mês</label><select name="mes_ano" defaultValue={1}>{MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></div>}
        </div>
      )}
    </>
  );
}
