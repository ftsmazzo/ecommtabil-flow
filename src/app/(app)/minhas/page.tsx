import { exigirUsuario } from '@/lib/auth';
import { departamentos, listarTarefas, titulosDisponiveis } from '@/lib/tarefas';
import { TaskTable } from '@/components/TaskTable';
import { Busca, FiltrosTarefas, urlAtual } from '@/components/FiltrosTarefas';

export const metadata = { title: 'EcommFlow · Minhas tarefas' };

export default async function Minhas({ searchParams: sp }: { searchParams: Busca }) {
  const s = await exigirUsuario();
  const [tarefas, deps, titulos] = await Promise.all([
    listarTarefas(s, { operador: s.id, departamento: parseInt(sp.dep || '') || undefined, titulo: sp.titulo, status: sp.status, busca: sp.q, atalho: sp.atalho }),
    departamentos(s),
    titulosDisponiveis(s, s.id),
  ]);
  return (
    <>
      <h2 style={{ margin: '0 0 14px' }}>Minhas tarefas</h2>
      <FiltrosTarefas sp={sp} deps={deps} titulos={titulos} base="/minhas" total={tarefas.length} />
      <TaskTable tarefas={tarefas} sessao={s} back={urlAtual('/minhas', sp as Record<string, string>)} mostrarResponsavel={false} />
    </>
  );
}
