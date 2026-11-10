import { exigirGestor } from '@/lib/auth';
import { listarTarefas } from '@/lib/tarefas';
import { TaskTable } from '@/components/TaskTable';
import { Busca, FiltrosTarefas, urlAtual } from '@/components/FiltrosTarefas';

export const metadata = { title: 'EcommFlow · Tarefas financeiras' };

export default async function TarefasFin({ searchParams: sp }: { searchParams: Busca }) {
  const s = await exigirGestor();
  const tarefas = await listarTarefas(s, { financeiro: true, titulo: sp.titulo, status: sp.status, busca: sp.q });
  return (
    <>
      <FiltrosTarefas sp={sp} titulos={[{ titulo: 'GERAR BOLETOS', abertas: 0 }, { titulo: 'ENVIAR BOLETOS', abertas: 0 }].map((t) => ({ ...t, abertas: tarefas.filter((x) => x.titulo === t.titulo).length }))}
        base="/financeiro/tarefas" total={tarefas.length} />
      <TaskTable tarefas={tarefas} sessao={s} back={urlAtual('/financeiro/tarefas', sp as Record<string, string>)} />
    </>
  );
}
