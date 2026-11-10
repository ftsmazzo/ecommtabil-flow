import { exigirGestor } from '@/lib/auth';
import { departamentos, listarTarefas, pessoas, titulosDisponiveis } from '@/lib/tarefas';
import { TaskTable } from '@/components/TaskTable';
import { Busca, FiltrosTarefas, urlAtual } from '@/components/FiltrosTarefas';

export const metadata = { title: 'EcommFlow · Todas as tarefas' };

export default async function Todas({ searchParams: sp }: { searchParams: Busca }) {
  const s = await exigirGestor();
  const [tarefas, deps, titulos, ops] = await Promise.all([
    listarTarefas(s, { operador: parseInt(sp.operador || '') || undefined, departamento: parseInt(sp.dep || '') || undefined, titulo: sp.titulo, status: sp.status, busca: sp.q, atalho: sp.atalho }),
    departamentos(s),
    titulosDisponiveis(s),
    pessoas(s),
  ]);
  return (
    <>
      <h2 style={{ margin: '0 0 14px' }}>Todas as tarefas</h2>
      <FiltrosTarefas sp={sp} deps={deps} titulos={titulos} operadores={ops} base="/tarefas" total={tarefas.length} />
      <TaskTable tarefas={tarefas} sessao={s} back={urlAtual('/tarefas', sp as Record<string, string>)} />
    </>
  );
}
