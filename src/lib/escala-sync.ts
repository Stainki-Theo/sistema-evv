import { supabase } from "@/integrations/supabase/client";
import { buildAutoRows, type EscalaPerson } from "@/lib/escala-auto";
import { RESULTADO, seqMap, type MissionSeq } from "@/lib/missao";
import { AVAIL } from "@/lib/evv";

export type SyncResult = {
  criadas: number;
  atualizadas: number;
  removidas: number;
  /** Linhas ajustadas manualmente cuja missão automática mudou. */
  conflitos: { aluno: string; atual: string; sugerida: string }[];
  motivo?: string;
};

const AUTO = "AUTOMATICO";

/**
 * Alimenta a Escala do Dia a partir de Disponibilidade + Próxima Missão.
 * Nunca sobrescreve linhas ajustadas manualmente: nelas apenas registra a
 * missão sugerida para o escalante decidir.
 */
export async function syncEscalaDia(date: string): Promise<SyncResult> {
  const empty: SyncResult = { criadas: 0, atualizadas: 0, removidas: 0, conflitos: [] };

  const { data: weeks } = await supabase.from("availability_weeks").select("*");
  const week = (weeks ?? []).find((w) => ((w.days ?? []) as string[]).map(String).includes(date));
  if (!week) return { ...empty, motivo: "Nenhuma semana de disponibilidade cobre esta data." };

  const days = ((week.days ?? []) as string[]).map(String);

  const [{ data: entries }, { data: profiles }, { data: seqRows }, { data: results }] =
    await Promise.all([
      supabase.from("availability_entries").select("*").eq("week_id", week.id),
      supabase.from("profiles").select("*"),
      supabase.from("mission_sequence").select("missao, proxima, pane, categoria"),
      supabase
        .from("annotator_flights")
        .select("op_date, al_profile_id, resultado")
        .in("op_date", days),
    ]);

  const seq = seqMap((seqRows ?? []) as MissionSeq[]);

  const rows = buildAutoRows({
    day: date,
    days,
    people: (profiles ?? []) as EscalaPerson[],
    availableDays: (id) =>
      (entries ?? [])
        .filter((e) => e.profile_id === id && e.status === AVAIL.YES)
        .map((e) => String(e.op_date)),
    progressedDays: (id) =>
      (results ?? [])
        .filter((r) => r.al_profile_id === id && r.resultado !== RESULTADO.PENDENTE)
        .map((r) => String(r.op_date)),
    seq,
  });

  const { data: existing } = await supabase.from("flight_schedule").select("*").eq("op_date", date);
  const current = existing ?? [];

  const result: SyncResult = { ...empty, conflitos: [] };
  const usedIds = new Set<string>();

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]!;
    const sameMissao = current.find(
      (f) => f.profile_id === row.profile_id && f.missao === row.missao,
    );
    const mine = sameMissao ?? current.find((f) => f.profile_id === row.profile_id && !usedIds.has(f.id));
    if (mine) usedIds.add(mine.id);

    if (!mine) {
      const { error } = await supabase.from("flight_schedule").insert({
        op_date: date,
        profile_id: row.profile_id,
        aluno: row.aluno,
        instrutor: row.instrutor,
        missao: row.missao,
        observacao: row.observacao,
        sort_order: i + 1,
        origem: AUTO,
      });
      if (!error) result.criadas += 1;
      continue;
    }

    if (mine.origem !== AUTO) {
      if (mine.missao !== row.missao) {
        result.conflitos.push({ aluno: row.aluno, atual: mine.missao, sugerida: row.missao });
        await supabase
          .from("flight_schedule")
          .update({ missao_sugerida: row.missao } as never)
          .eq("id", mine.id);
      }
      continue;
    }

    if (mine.missao !== row.missao || mine.aluno !== row.aluno || mine.sort_order !== i + 1) {
      await supabase
        .from("flight_schedule")
        .update({
          missao: row.missao,
          aluno: row.aluno,
          observacao: row.observacao || mine.observacao,
          sort_order: i + 1,
          missao_sugerida: "",
        } as never)
        .eq("id", mine.id);
      result.atualizadas += 1;
    }
  }

  // Linhas automáticas de integrantes que não estão mais elegíveis.
  const keepIds = new Set([...usedIds]);
  const orfas = current.filter(
    (f) => f.origem === AUTO && f.profile_id && !keepIds.has(f.id),
  );
  for (const f of orfas) {
    const { error } = await supabase.from("flight_schedule").delete().eq("id", f.id);
    if (!error) result.removidas += 1;
  }

  return result;
}

/** Aceita a missão sugerida em uma linha ajustada manualmente. */
export async function aceitarSugestao(id: string, missao: string) {
  const { error } = await supabase
    .from("flight_schedule")
    .update({ missao, missao_sugerida: "" } as never)
    .eq("id", id);
  if (error) throw error;
}

/** Mantém a alteração manual e descarta a sugestão automática. */
export async function descartarSugestao(id: string) {
  const { error } = await supabase
    .from("flight_schedule")
    .update({ missao_sugerida: "" } as never)
    .eq("id", id);
  if (error) throw error;
}
