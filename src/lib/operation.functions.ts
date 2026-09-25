import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { flightDuration } from "@/lib/evv";
import { isReboque } from "@/lib/missao";

const CONTROL_ROLES = ["Chefe de Pista (Manhã)", "Chefe de Pista (Tarde)", "Sombra (Manhã)", "Sombra (Tarde)", "Anotador"];

async function assertCanControlOperation(supabaseAdmin: any, userId: string, opDate: string) {
  const [{ data: roles }, { data: profile }, { data: director }, { data: duty }] = await Promise.all([
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "administrador").maybeSingle(),
    supabaseAdmin.from("profiles").select("cargo").eq("id", userId).maybeSingle(),
    supabaseAdmin.from("diretoria_assignments").select("id").eq("profile_id", userId).eq("tipo", "DIRETOR").limit(1).maybeSingle(),
    supabaseAdmin.from("duty_roster").select("id").eq("op_date", opDate).eq("profile_id", userId).in("funcao", CONTROL_ROLES).limit(1).maybeSingle(),
  ]);
  const privileged = !!roles || ["Supervisão", "Presidente"].includes(profile?.cargo ?? "") || !!director;
  if (!privileged && !duty) {
    throw new Error("Somente Administração, Diretoria, Supervisão ou o Chefe de Pista, Sombra e Anotador escalados neste dia podem controlar a operação.");
  }
}

export const finalizeOperation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { opDate: string }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.opDate)) throw new Error("Data inválida.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = (context as { userId: string }).userId;
    await assertCanControlOperation(supabaseAdmin, userId, data.opDate);

    const markerKey = `operation_closed:${data.opDate}`;
    const { data: closed } = await supabaseAdmin.from("app_settings").select("value").eq("key", markerKey).maybeSingle();
    if (closed?.value === "true") throw new Error("Esta operação já está encerrada.");

    const [{ data: flights, error: flightsError }, { data: profiles, error: profilesError }] = await Promise.all([
      supabaseAdmin.from("annotator_flights").select("*").eq("op_date", data.opDate),
      supabaseAdmin.from("profiles").select("id, tri, war_name, full_name, flight_minutes"),
    ]);
    if (flightsError) throw flightsError;
    if (profilesError) throw profilesError;

    const tag = (v?: string | null) => (v ?? "").trim().toUpperCase();
    const byTag = new Map<string, any>();
    const byId = new Map<string, any>();
    for (const p of profiles ?? []) {
      byId.set(p.id, p);
      for (const value of [p.tri, p.war_name, p.full_name]) if (tag(value) && !byTag.has(tag(value))) byTag.set(tag(value), p);
    }

    const minutes = new Map<string, number>();
    for (const flight of flights ?? []) {
      if (!flight.dep_time?.trim() || !flight.land_time?.trim()) continue;
      const duration = flightDuration(flight.dep_time, flight.land_time).minutes;
      if (duration <= 0) continue;
      const crew = new Set([
        flight.al_profile_id || byTag.get(tag(flight.al_1p))?.id || "",
        byTag.get(tag(flight.in_2p))?.id || "",
      ]);
      for (const id of crew) if (id) minutes.set(id, (minutes.get(id) ?? 0) + duration);
    }

    let credited = 0;
    for (const [profileId, amount] of minutes) {
      const creditKey = `flight_credit:${data.opDate}:${profileId}`;
      const { data: previous } = await supabaseAdmin.from("app_settings").select("value").eq("key", creditKey).maybeSingle();
      if (previous?.value) continue;
      const before = byId.get(profileId)?.flight_minutes ?? 0;
      const after = before + amount;
      await supabaseAdmin.from("profiles").update({ flight_minutes: after }).eq("id", profileId);
      await supabaseAdmin.from("app_settings").upsert([
        { key: creditKey, value: JSON.stringify({ status: "done", before, after, minutes: amount }) },
        { key: `flight_credit_notice:${profileId}:${data.opDate}`, value: JSON.stringify({ date: data.opDate, minutes: amount, before, after, seen: false }) },
      ], { onConflict: "key" });
      credited += 1;
    }

    const flightIds = (flights ?? []).map((f: any) => f.id);
    const { data: existing } = flightIds.length
      ? await supabaseAdmin.from("pitocador_entries").select("flight_id").in("flight_id", flightIds)
      : { data: [] };
    const existingIds = new Set((existing ?? []).map((r: any) => r.flight_id));
    const pitRows = (flights ?? []).flatMap((flight: any) => {
      if (existingIds.has(flight.id) || isReboque(flight.missao) || !flight.dep_time?.trim() || !flight.land_time?.trim()) return [];
      const amount = flightDuration(flight.dep_time, flight.land_time).minutes;
      const aluno = flight.al_profile_id ? byId.get(flight.al_profile_id) : byTag.get(tag(flight.al_1p));
      if (!aluno || amount <= 0) return [];
      return [{
        profile_id: aluno.id, op_date: data.opDate, missao: flight.missao?.trim() ?? "", minutes: amount,
        grau: null, instrutor_id: byTag.get(tag(flight.in_2p))?.id ?? null, instrutor_tag: flight.in_2p?.trim() ?? "",
        aeronave: flight.aeronave?.trim() ?? "", observacao: flight.observacoes?.trim() ?? "", flight_id: flight.id,
        created_by: userId, created_by_name: "Encerramento da operação",
      }];
    });
    if (pitRows.length) {
      const { error } = await supabaseAdmin.from("pitocador_entries").insert(pitRows);
      if (error) throw error;
    }
    await supabaseAdmin.from("app_settings").upsert({ key: markerKey, value: "true" }, { onConflict: "key" });
    return { profilesCredited: credited, pitocadorEntries: pitRows.length };
  });

export const reopenControlledOperation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { opDate: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = (context as { userId: string }).userId;
    await assertCanControlOperation(supabaseAdmin, userId, data.opDate);
    const { data: marker } = await supabaseAdmin.from("app_settings").select("value").eq("key", `operation_closed:${data.opDate}`).maybeSingle();
    if (marker?.value !== "true") throw new Error("Esta operação não está encerrada.");

    const { data: credits } = await supabaseAdmin.from("app_settings").select("key, value").like("key", `flight_credit:${data.opDate}:%`);
    let reversed = 0;
    for (const row of credits ?? []) {
      try {
        const payload = JSON.parse(row.value);
        const profileId = row.key.slice(`flight_credit:${data.opDate}:`.length);
        const { data: profile } = await supabaseAdmin.from("profiles").select("flight_minutes").eq("id", profileId).maybeSingle();
        await supabaseAdmin.from("profiles").update({ flight_minutes: Math.max(0, (profile?.flight_minutes ?? 0) - Math.max(0, payload.minutes ?? 0)) }).eq("id", profileId);
        reversed += 1;
      } catch { throw new Error("Crédito de voo inválido nesta operação."); }
    }
    const { data: flights } = await supabaseAdmin.from("annotator_flights").select("id").eq("op_date", data.opDate);
    const ids = (flights ?? []).map((f: any) => f.id);
    let removed = 0;
    if (ids.length) {
      const { data } = await supabaseAdmin.from("pitocador_entries").delete().in("flight_id", ids).select("id");
      removed = data?.length ?? 0;
    }
    if ((credits ?? []).length) await supabaseAdmin.from("app_settings").delete().in("key", (credits ?? []).map((r: any) => r.key));
    await supabaseAdmin.from("app_settings").delete().like("key", `flight_credit_notice:%:${data.opDate}`);
    await supabaseAdmin.from("app_settings").upsert({ key: `operation_closed:${data.opDate}`, value: "false" }, { onConflict: "key" });
    return { profiles_reversed: reversed, pitocador_entries_removed: removed };
  });
