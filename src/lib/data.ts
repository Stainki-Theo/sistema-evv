import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { canonicalEsquadrao, DEFAULT_FUNCTIONS, flightDuration, todayISO, vigenteEm } from "@/lib/evv";
import { isReboque } from "@/lib/missao";
import { repairEncoding } from "@/lib/textEncoding";

/* ---------- Dia da operação (horário do briefing) ---------- */

export async function fetchDay(date: string) {
  const { data, error } = await supabase
    .from("op_days")
    .select("*")
    .eq("op_date", date)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function useDay(date: string) {
  return useQuery({ queryKey: ["day", date], queryFn: () => fetchDay(date) });
}

export async function saveBriefingTime(date: string, briefing_time: string) {
  const { error } = await supabase
    .from("op_days")
    .upsert({ op_date: date, briefing_time }, { onConflict: "op_date" });
  if (error) throw error;
}

/* ---------- Escala de voos ---------- */

export function useFlights(date: string) {
  return useQuery({
    queryKey: ["flights", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flight_schedule")
        .select("*")
        .eq("op_date", date)
        .order("sort_order")
        .order("time_planned");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ---------- Funções (escala de serviço) ---------- */

export function useDuties(date: string) {
  return useQuery({
    queryKey: ["duties", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("duty_roster")
        .select("*")
        .eq("op_date", date)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export async function ensureDefaultDuties(date: string) {
  const { data, error } = await supabase
    .from("duty_roster")
    .select("id")
    .eq("op_date", date)
    .limit(1);
  if (error) throw error;
  if ((data ?? []).length) return;
  const rows = DEFAULT_FUNCTIONS.map((funcao, i) => ({
    op_date: date,
    funcao,
    sort_order: i + 1,
  }));
  const { error: insertError } = await supabase.from("duty_roster").insert(rows);
  if (insertError) throw insertError;
}

/* ---------- Meteorologia ---------- */

export function useWeather(date: string) {
  return useQuery({
    queryKey: ["weather", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weather_observations")
        .select("*")
        .eq("op_date", date)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ---------- Avisos ---------- */

/**
 * Avisos vigentes na data informada: temporários apenas no próprio dia e
 * persistentes desde a publicação até o encerramento.
 */
export function useAnnouncements(date?: string) {
  return useQuery({
    queryKey: ["announcements", date ?? "all"],
    queryFn: async () => {
      let query = supabase.from("announcements").select("*");
      if (date) query = query.lte("op_date", date);
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      return date ? rows.filter((r) => vigenteEm(r, date)) : rows;
    },
  });
}

/* ---------- Segurança de voo ---------- */

export function useSafety(date?: string) {
  return useQuery({
    queryKey: ["safety", date ?? "all"],
    queryFn: async () => {
      let query = supabase.from("safety_entries").select("*");
      if (date) query = query.lte("op_date", date);
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      return date ? rows.filter((r) => vigenteEm(r, date)) : rows;
    },
  });
}

/* ---------- Perfis / Quadro operacional ---------- */

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("status", "ATIVO").order("war_name");
      if (error) throw error;
      return (data ?? []).map((profile) => ({
        ...profile,
        esquadrao: canonicalEsquadrao(profile.esquadrao),
        fase: repairEncoding(profile.fase ?? ""),
      }));
    },
  });
}

/** Inclui formados e desativados; reservado a consultas históricas como o Gaivotômetro. */
export function useAllProfiles() {
  return useQuery({
    queryKey: ["profiles-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("war_name");
      if (error) throw error;
      return (data ?? []).map((profile) => ({
        ...profile,
        esquadrao: canonicalEsquadrao(profile.esquadrao),
        fase: repairEncoding(profile.fase ?? ""),
      }));
    },
  });
}

/* ---------- Configurações (RELPREV) ---------- */

export function useSetting(key: string) {
  return useQuery({
    queryKey: ["setting", key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      return data?.value ?? "";
    },
  });
}

export const AFA_SQUADRONS_SETTING = "afa_current_squadrons";

/** Turmas que ocupam, respectivamente, o 1º, 2º, 3º e 4º ano da AFA. */
export function useCurrentSquadrons() {
  const query = useSetting(AFA_SQUADRONS_SETTING);
  let squadrons = ["Drakon", "Perseu", "Uiraçu", "Athos"];
  try {
    const parsed = JSON.parse(query.data || "[]");
    if (Array.isArray(parsed) && parsed.length === 4 && parsed.every((item) => typeof item === "string" && item.trim())) {
      squadrons = parsed.map((item) => item.trim());
    }
  } catch {
    // Mantém o mapa padrão enquanto não houver configuração salva.
  }
  return { ...query, data: squadrons };
}

const OPERATION_CLOSED_PREFIX = "operation_closed:";

export function useOperationClosed(date: string) {
  return useSetting(`${OPERATION_CLOSED_PREFIX}${date}`);
}

export async function closeOperation(date: string) {
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: `${OPERATION_CLOSED_PREFIX}${date}`, value: "true" }, { onConflict: "key" });
  if (error) throw error;
}

export async function reopenOperation(date: string) {
  const { data, error } = await supabase.rpc("reopen_operation", { _op_date: date });
  if (error) throw error;
  return (data ?? {}) as {
    profiles_reversed?: number;
    pitocador_entries_removed?: number;
  };
}

type CreditFlight = {
  id?: string;
  dep_time: string;
  land_time: string;
  al_1p: string;
  in_2p: string;
  al_profile_id?: string | null;
  missao?: string;
  aeronave?: string;
  observacoes?: string;
};

type CreditProfile = {
  id: string;
  tri?: string | null;
  war_name?: string | null;
  full_name?: string | null;
  flight_minutes?: number | null;
};

export type FlightCreditNotice = {
  key: string;
  date: string;
  minutes: number;
  before: number;
  after: number;
  seen: boolean;
};

const FLIGHT_CREDIT_PREFIX = "flight_credit:";
const FLIGHT_CREDIT_NOTICE_PREFIX = "flight_credit_notice:";
const PITOCADOR_CREDIT_PREFIX = "pitocador_time_credited:";

function creditTag(value?: string | null) {
  return (value ?? "").trim().toUpperCase();
}

/** Credita o tempo de cada voo completo ao AL/1P e ao IN/2P, uma única vez por operação. */
export async function creditOperationFlightTime(
  date: string,
  flights: CreditFlight[],
  profiles: CreditProfile[],
) {
  const byTag = new Map<string, string>();
  const byId = new Map(profiles.map((profile) => [profile.id, profile]));
  for (const profile of profiles) {
    for (const tag of [profile.tri, profile.war_name, profile.full_name]) {
      const normalized = creditTag(tag);
      if (normalized && !byTag.has(normalized)) byTag.set(normalized, profile.id);
    }
  }

  const minutesByProfile = new Map<string, number>();
  for (const flight of flights) {
    if (!flight.dep_time?.trim() || !flight.land_time?.trim()) continue;
    const { minutes } = flightDuration(flight.dep_time, flight.land_time);
    if (minutes <= 0) continue;
    const crew = new Set([
      flight.al_profile_id || byTag.get(creditTag(flight.al_1p)) || "",
      byTag.get(creditTag(flight.in_2p)) || "",
    ]);
    for (const profileId of crew) {
      if (!profileId) continue;
      minutesByProfile.set(profileId, (minutesByProfile.get(profileId) ?? 0) + minutes);
    }
  }

  if (minutesByProfile.size === 0) return [] as FlightCreditNotice[];
  const markerKeys = [...minutesByProfile.keys()].map(
    (profileId) => `${FLIGHT_CREDIT_PREFIX}${date}:${profileId}`,
  );
  const { data: markerRows, error: markerError } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", markerKeys);
  if (markerError) throw markerError;
  const markers = new Map((markerRows ?? []).map((row) => [row.key, row.value]));
  const notices: FlightCreditNotice[] = [];

  for (const [profileId, minutes] of minutesByProfile) {
    const profile = byId.get(profileId);
    if (!profile) continue;
    const markerKey = `${FLIGHT_CREDIT_PREFIX}${date}:${profileId}`;
    const existingRaw = markers.get(markerKey);
    let existing: { status?: string; before?: number; after?: number; minutes?: number } | null =
      null;
    try {
      existing = existingRaw ? JSON.parse(existingRaw) : null;
    } catch {
      existing = null;
    }
    if (existing?.status === "done") continue;

    const before = existing?.before ?? profile.flight_minutes ?? 0;
    const creditMinutes = existing?.minutes ?? minutes;
    const after = existing?.after ?? before + creditMinutes;
    const pending = JSON.stringify({ status: "pending", before, after, minutes: creditMinutes });
    const { error: pendingError } = await supabase
      .from("app_settings")
      .upsert({ key: markerKey, value: pending }, { onConflict: "key" });
    if (pendingError) throw pendingError;

    if ((profile.flight_minutes ?? 0) < after) {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ flight_minutes: after })
        .eq("id", profileId);
      if (profileError) throw profileError;
    }

    const noticeKey = `${FLIGHT_CREDIT_NOTICE_PREFIX}${profileId}:${date}`;
    const notice: FlightCreditNotice = {
      key: noticeKey,
      date,
      minutes: creditMinutes,
      before,
      after,
      seen: false,
    };
    const { error: finalizeError } = await supabase.from("app_settings").upsert(
      [
        {
          key: markerKey,
          value: JSON.stringify({ status: "done", before, after, minutes: creditMinutes }),
        },
        { key: noticeKey, value: JSON.stringify(notice) },
      ],
      { onConflict: "key" },
    );
    if (finalizeError) throw finalizeError;
    notices.push(notice);
  }
  return notices;
}

/** Cria a ficha do Pitocador a partir dos voos encerrados, sem inventar grau. */
export async function syncOperationToPitocador(
  date: string,
  flights: CreditFlight[],
  profiles: CreditProfile[],
  actor?: { id?: string | null; name?: string },
) {
  const byTag = new Map<string, CreditProfile>();
  for (const profile of profiles) {
    for (const tag of [profile.tri, profile.war_name, profile.full_name]) {
      const normalized = creditTag(tag);
      if (normalized && !byTag.has(normalized)) byTag.set(normalized, profile);
    }
  }

  const flightIds = flights.map((flight) => flight.id).filter((id): id is string => !!id);
  const { data: existing, error: existingError } = flightIds.length
    ? await supabase.from("pitocador_entries").select("flight_id").in("flight_id", flightIds)
    : { data: [], error: null };
  if (existingError) throw existingError;
  const existingIds = new Set((existing ?? []).map((entry) => entry.flight_id).filter(Boolean));

  const rows = flights.flatMap((flight) => {
    if (!flight.id || existingIds.has(flight.id) || isReboque(flight.missao)) return [];
    if (!flight.dep_time?.trim() || !flight.land_time?.trim()) return [];
    const { minutes } = flightDuration(flight.dep_time, flight.land_time);
    const aluno = flight.al_profile_id
      ? profiles.find((profile) => profile.id === flight.al_profile_id)
      : byTag.get(creditTag(flight.al_1p));
    if (!aluno || minutes <= 0) return [];
    const instrutor = byTag.get(creditTag(flight.in_2p));
    return [
      {
        profile_id: aluno.id,
        op_date: date,
        missao: flight.missao?.trim() ?? "",
        minutes,
        grau: null,
        instrutor_id: instrutor?.id ?? null,
        instrutor_tag: flight.in_2p?.trim() ?? "",
        aeronave: flight.aeronave?.trim() ?? "",
        observacao: flight.observacoes?.trim() ?? "",
        flight_id: flight.id,
        created_by: actor?.id ?? null,
        created_by_name: actor?.name ?? "Encerramento da operação",
      },
    ];
  });
  if (!rows.length) return 0;
  const { error } = await supabase.from("pitocador_entries").insert(rows);
  if (error) throw error;
  return rows.length;
}

/** Ajusta as horas totais quando um voo antigo é incluído, editado ou excluído manualmente. */
export async function adjustProfileFlightMinutes(profileId: string, delta: number) {
  if (!delta) return;
  const { data, error: readError } = await supabase
    .from("profiles")
    .select("flight_minutes")
    .eq("id", profileId)
    .single();
  if (readError) throw readError;
  const next = Math.max(0, (data?.flight_minutes ?? 0) + delta);
  const { error } = await supabase
    .from("profiles")
    .update({ flight_minutes: next })
    .eq("id", profileId);
  if (error) throw error;
}

export async function markPitocadorTimeCredited(entryId: string) {
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: `${PITOCADOR_CREDIT_PREFIX}${entryId}`, value: "true" }, { onConflict: "key" });
  if (error) throw error;
}

export async function isPitocadorTimeCredited(entryId: string) {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", `${PITOCADOR_CREDIT_PREFIX}${entryId}`)
    .maybeSingle();
  if (error) throw error;
  return data?.value === "true";
}

export function useFlightCreditNotice(profileId?: string | null) {
  return useQuery({
    queryKey: ["flight_credit_notice", profileId ?? "none"],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .like("key", `${FLIGHT_CREDIT_NOTICE_PREFIX}${profileId}:%`)
        .order("key", { ascending: false });
      if (error) throw error;
      for (const row of data ?? []) {
        try {
          const notice = JSON.parse(row.value) as FlightCreditNotice;
          if (!notice.seen) return { ...notice, key: row.key };
        } catch {
          // Ignora notificações antigas inválidas.
        }
      }
      return null;
    },
  });
}

export async function acknowledgeFlightCreditNotice(notice: FlightCreditNotice) {
  const { error } = await supabase
    .from("app_settings")
    .update({ value: JSON.stringify({ ...notice, seen: true }) })
    .eq("key", notice.key);
  if (error) throw error;
}

async function fetchClosedOperationDates() {
  const { data, error } = await supabase
    .from("app_settings")
    .select("key")
    .like("key", `${OPERATION_CLOSED_PREFIX}%`)
    .eq("value", "true");
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.key.slice(OPERATION_CLOSED_PREFIX.length)));
}

export function useSaveSetting(key: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (value: string) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key, value }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["setting", key] }),
  });
}

export const TODAY = todayISO;

/* ---------- Diretorias ---------- */

export function useDiretorias() {
  return useQuery({
    queryKey: ["diretorias"],
    queryFn: async () => {
      const { data, error } = await supabase.from("diretorias").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ---------- RELPREVs anteriores ---------- */

export function useRelprevs() {
  return useQuery({
    queryKey: ["relprevs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("relprevs")
        .select("*")
        .order("relprev_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ---------- Documentos ---------- */

export function useDocuments() {
  return useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .order("doc_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ---------- Arquivos ---------- */

export const FILE_BUCKET = "arquivos";

export async function uploadFile(folder: string, file: File) {
  const safe = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${folder}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from(FILE_BUCKET).upload(path, file);
  if (error) throw error;
  return { path, name: file.name };
}

export async function openFile(path: string) {
  const { data, error } = await supabase.storage.from(FILE_BUCKET).createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

export async function removeFile(path: string) {
  if (!path) return;
  await supabase.storage.from(FILE_BUCKET).remove([path]);
}

/* ---------- Fases operacionais ---------- */

export function useFases() {
  return useQuery({
    queryKey: ["fases"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fases").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []).map((fase) => ({ ...fase, nome: repairEncoding(fase.nome) }));
    },
  });
}

/* ---------- Disponibilidade ---------- */

export function useWeeks() {
  return useQuery({
    queryKey: ["availability_weeks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("availability_weeks")
        .select("*")
        .order("week_start", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAvailability(weekId?: string) {
  return useQuery({
    queryKey: ["availability", weekId ?? "none"],
    enabled: !!weekId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("availability_entries")
        .select("*")
        .eq("week_id", weekId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

function dbMessage(error: { message?: string; details?: string; hint?: string; code?: string }) {
  return [error.message, error.details, error.hint].filter(Boolean).join(" · ") || "Erro no banco.";
}

/** Garante que a semana existe (sem duplicar) e que contém todos os dias informados. */
export async function ensureWeek(weekStart: string, weekEnd: string, days: string[]) {
  const wanted = [...new Set(days)].sort();
  const { data: existing, error: selError } = await supabase
    .from("availability_weeks")
    .select("*")
    .eq("week_start", weekStart)
    .maybeSingle();
  if (selError) throw new Error(dbMessage(selError));

  if (existing) {
    const current = ((existing.days ?? []) as string[]).map(String);
    const merged = [...new Set([...current, ...wanted])].sort();
    const needsUpdate =
      merged.length !== current.length ||
      existing.week_end !== (merged[merged.length - 1] ?? weekEnd);
    if (needsUpdate) {
      const { data: updated, error } = await supabase
        .from("availability_weeks")
        .update({ days: merged, week_end: merged[merged.length - 1] ?? weekEnd } as never)
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw new Error(dbMessage(error));
      return updated;
    }
    return existing;
  }

  const { data: created, error } = await supabase
    .from("availability_weeks")
    .insert({
      week_start: weekStart,
      week_end: wanted[wanted.length - 1] ?? weekEnd,
      days: wanted,
    })
    .select()
    .single();
  if (error) {
    // Corrida: outra sessão criou a semana no mesmo instante.
    const { data: retry } = await supabase
      .from("availability_weeks")
      .select("*")
      .eq("week_start", weekStart)
      .maybeSingle();
    if (retry) return retry;
    throw new Error(dbMessage(error));
  }
  return created;
}

/** Compatibilidade com chamadas anteriores. */
export const createWeek = ensureWeek;

/** Salva a resposta do integrante sem criar duplicatas (um registro por dia). */
export async function saveAvailability(
  weekId: string,
  profileId: string,
  rows: { op_date: string; status: string; observacao: string }[],
) {
  const { data: mine, error: readError } = await supabase
    .from("availability_entries")
    .select("id, op_date")
    .eq("week_id", weekId)
    .eq("profile_id", profileId);
  if (readError) throw new Error(dbMessage(readError));

  const byDate = new Map((mine ?? []).map((r) => [String(r.op_date), r.id]));

  for (const row of rows) {
    const existingId = byDate.get(row.op_date);
    if (existingId) {
      const { error } = await supabase
        .from("availability_entries")
        .update({ status: row.status, observacao: row.observacao } as never)
        .eq("id", existingId);
      if (error) throw new Error(dbMessage(error));
    } else {
      const { error } = await supabase.from("availability_entries").insert({
        week_id: weekId,
        profile_id: profileId,
        op_date: row.op_date,
        status: row.status,
        observacao: row.observacao,
      });
      if (error) throw new Error(dbMessage(error));
    }
  }
}

/** Adiciona um dia de operação extra (feriado, dia útil, operação especial). */
export async function addExtraDay(weekId: string, days: string[], day: string) {
  const merged = [...new Set([...days.map(String), day])].sort();
  const { error } = await supabase
    .from("availability_weeks")
    .update({ days: merged, week_end: merged[merged.length - 1] } as never)
    .eq("id", weekId);
  if (error) throw new Error(dbMessage(error));
}

/** Remove um dia extra e as respostas registradas para ele. */
export async function removeExtraDay(weekId: string, days: string[], day: string) {
  const merged = days.map(String).filter((d) => d !== day);
  const { error } = await supabase
    .from("availability_weeks")
    .update({
      days: merged,
      week_end: merged[merged.length - 1] ?? day,
    } as never)
    .eq("id", weekId);
  if (error) throw new Error(dbMessage(error));
  await supabase.from("availability_entries").delete().eq("week_id", weekId).eq("op_date", day);
}

/* ---------- Aeronaves e códigos de chamada (listas administráveis) ---------- */

export function useAircraft() {
  return useQuery({
    queryKey: ["aircraft"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aircraft")
        .select("*")
        .order("sort_order")
        .order("identificacao");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCallsigns() {
  return useQuery({
    queryKey: ["callsigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("callsigns")
        .select("*")
        .order("sort_order")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ---------- Planilha do Anotador ---------- */

export function useAnnotatorFlights(date: string) {
  return useQuery({
    queryKey: ["annotator_flights", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("annotator_flights")
        .select("*")
        .eq("op_date", date)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useActivations(date: string) {
  return useQuery({
    queryKey: ["annotator_activations", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("annotator_activations")
        .select("*")
        .eq("op_date", date)
        .order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ---------- Cargos e áreas das Diretorias ---------- */

export function useDiretoriaAssignments() {
  return useQuery({
    queryKey: ["diretoria_assignments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("diretoria_assignments").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDiretoriaItems(diretoriaId?: string, scope?: string) {
  return useQuery({
    queryKey: ["diretoria_items", diretoriaId ?? "none", scope ?? "DIRETORIA"],
    enabled: !!diretoriaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diretoria_items")
        .select("*")
        .eq("diretoria_id", diretoriaId!)
        .eq("scope", scope ?? "DIRETORIA")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ---------- Integrantes ativos (seletores de novas atividades) ---------- */

/** Somente integrantes ATIVOS: bloqueados, desativados e excluídos não aparecem. */
export function useActiveProfiles() {
  return useQuery({
    queryKey: ["profiles", "ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("status", "ATIVO")
        .order("war_name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ---------- Sequência operacional de missões ---------- */

export function useMissionSequence() {
  return useQuery({
    queryKey: ["mission_sequence"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mission_sequence")
        .select("*")
        .order("sort_order")
        .order("missao");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ---------- Histórico de progressão ---------- */

export function useProgression(profileId?: string) {
  return useQuery({
    queryKey: ["progression_log", profileId ?? "all"],
    queryFn: async () => {
      let query = supabase.from("progression_log").select("*");
      if (profileId) query = query.eq("profile_id", profileId);
      const { data, error } = await query
        .order("op_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ---------- Calendário ---------- */

export function useCalendarCategories() {
  return useQuery({
    queryKey: ["calendar_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_categories")
        .select("*")
        .order("sort_order")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Eventos do período informado (inclusive). */
export function useCalendarEvents(start: string, end: string) {
  return useQuery({
    queryKey: ["calendar_events", start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .gte("event_date", start)
        .lte("event_date", end)
        .order("event_date")
        .order("time_ref");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Operações já existentes no período (integração automática com o calendário). */
export function useOpDaysRange(start: string, end: string) {
  return useQuery({
    queryKey: ["op_days", start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("op_days")
        .select("*")
        .gte("op_date", start)
        .lte("op_date", end)
        .order("op_date");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Datas do período com atividade operacional efetiva registrada na Planilha do
 * Anotador (voo com decolagem/pouso lançados, voo em andamento/realizado ou
 * acionamento com hora). Disponibilidade, escala e meteorologia NÃO contam:
 * uma operação pode ser abortada antes dos voos.
 */
export function useOperacoesEfetivas(start: string, end: string) {
  return useQuery({
    queryKey: ["operacoes_efetivas", start, end],
    queryFn: async () => {
      const [flights, activations] = await Promise.all([
        supabase
          .from("annotator_flights")
          .select("op_date, dep_time, land_time, status, missao")
          .gte("op_date", start)
          .lte("op_date", end),
        supabase
          .from("annotator_activations")
          .select("op_date, hora")
          .gte("op_date", start)
          .lte("op_date", end),
      ]);
      if (flights.error) throw flights.error;
      if (activations.error) throw activations.error;

      const efetivas = new Set<string>();
      for (const f of flights.data ?? []) {
        const status = (f.status || "").trim().toUpperCase();
        const efetivo =
          !!(f.dep_time || "").trim() ||
          !!(f.land_time || "").trim() ||
          status === "EM VOO" ||
          status === "REALIZADO";
        if (efetivo) efetivas.add(String(f.op_date));
      }
      for (const a of activations.data ?? []) {
        if ((a.hora || "").trim()) efetivas.add(String(a.op_date));
      }
      return efetivas;
    },
  });
}

/* ---------- Log de alterações ---------- */

export function useChangeLog(filters?: { area?: string; date?: string }) {
  return useQuery({
    queryKey: ["change_log", filters?.area ?? "all", filters?.date ?? "all"],
    queryFn: async () => {
      let query = supabase.from("change_log").select("*");
      if (filters?.area) query = query.eq("area", filters.area);
      if (filters?.date) query = query.eq("op_date", filters.date);
      const { data, error } = await query.order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ---------- Grupo Supervisão ---------- */

export function useSupervisaoItems(enabled = true) {
  return useQuery({
    queryKey: ["supervisao_items"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supervisao_items")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Atualização de campos restritos do perfil (foto e IN pessoal).
 *
 * O RLS de `profiles` já garante que apenas o próprio integrante (ou um
 * administrador) consiga escrever, então a escrita vai direta pelo cliente.
 */
export async function updateProfileRestricted(args: {
  data: { id: string; patch: { avatar_path?: string; in_pessoal_id?: string | null } };
}) {
  const { id, patch } = args.data;
  const allowed: Record<string, unknown> = {};
  if ("avatar_path" in patch) allowed["avatar_path"] = patch.avatar_path ?? "";
  if ("in_pessoal_id" in patch) allowed["in_pessoal_id"] = patch.in_pessoal_id ?? null;
  if (!Object.keys(allowed).length) return { ok: true };
  const { error } = await supabase
    .from("profiles")
    .update(allowed as never)
    .eq("id", id);
  if (error) throw new Error(dbMessage(error as never));
  return { ok: true };
}

/* ---------- Fotos (integrantes e produtos) ---------- */

export const PHOTO_BUCKET = "fotos";

export async function uploadPhoto(folder: string, file: File) {
  const safe = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${folder}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, { upsert: true });
  if (error) throw new Error(dbMessage(error as never));
  return path;
}

export async function removePhoto(path?: string | null) {
  if (!path) return;
  await supabase.storage.from(PHOTO_BUCKET).remove([path]);
}

/** Endereço assinado da foto (bucket privado). */
export function usePhotoUrl(path?: string | null) {
  return useQuery({
    queryKey: ["photo", path ?? "none"],
    enabled: !!path,
    staleTime: 45 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .createSignedUrl(path!, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

/* ---------- Histórico completo (estatísticas automáticas) ---------- */

/** Toda a planilha do Anotador: base dos contadores de OPS, pousos e categorias. */
export function useAllAnnotatorFlights() {
  return useQuery({
    queryKey: ["annotator_flights", "todos"],
    queryFn: async () => {
      const [closedDates, result] = await Promise.all([
        fetchClosedOperationDates(),
        supabase
          .from("annotator_flights")
          .select("*")
          .order("op_date", { ascending: false })
          .limit(5000),
      ]);
      const { data, error } = result;
      if (error) throw error;
      return (data ?? []).filter((row) => closedDates.has(row.op_date));
    },
  });
}

/** Toda a escala de serviço: base da contagem de serviços cumpridos. */
export function useAllDuties() {
  return useQuery({
    queryKey: ["duty_roster", "todos"],
    queryFn: async () => {
      const [closedDates, result] = await Promise.all([
        fetchClosedOperationDates(),
        supabase.from("duty_roster").select("*").order("op_date", { ascending: false }).limit(5000),
      ]);
      const { data, error } = result;
      if (error) throw error;
      return (data ?? []).filter((row) => closedDates.has(row.op_date));
    },
  });
}

/* ---------- Estrelários (RLS mantém destinatário e lançador privados) ---------- */

export function useEstrelarios() {
  return useQuery({
    queryKey: ["estrelarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estrelarios")
        .select("*")
        .order("op_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useEstrelariosEstatistica(from: string, to: string) {
  return useQuery({
    queryKey: ["estrelarios_estatistica", from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("estrelarios_estatistica", {
        _from: from,
        _to: to,
      });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ---------- Pitocador (ficha de instrução) ---------- */

export function usePitocador(profileId?: string) {
  return useQuery({
    queryKey: ["pitocador", profileId ?? "none"],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pitocador_entries")
        .select("*")
        .eq("profile_id", profileId!)
        .order("op_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ---------- Comercial ---------- */

export function useCommerceCategories() {
  return useQuery({
    queryKey: ["commerce_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commerce_categories")
        .select("*")
        .order("sort_order")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCommerceProducts() {
  return useQuery({
    queryKey: ["commerce_products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("commerce_products").select("*").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCommercePurchases() {
  return useQuery({
    queryKey: ["commerce_purchases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commerce_purchases")
        .select("*, commerce_purchase_items(*)")
        .order("purchased_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
}
