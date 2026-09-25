import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeProxima } from "@/lib/progressao";
import { RESULTADO } from "@/lib/missao";

/**
 * Registra o resultado de um voo, atualiza a PRÓXIMA MISSÃO do integrante
 * (fonte única de verdade) e guarda o histórico de progressão.
 */
export const registrarResultado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      profileId: string;
      opDate: string;
      missao: string;
      resultado: string;
      registradoPor?: string;
    }) => {
      if (!input.profileId) throw new Error("Integrante não identificado.");
      if (!input.missao?.trim()) throw new Error("Informe a missão realizada.");
      if (![RESULTADO.APROVADO, RESULTADO.NAO_APROVADO].includes(input.resultado as never))
        throw new Error("Resultado inválido.");
      return input;
    },
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: seq } = await supabaseAdmin
      .from("mission_sequence")
      .select("missao, proxima, pane, categoria");

    const proxima = computeProxima(data.missao, data.resultado, (seq ?? []) as never);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, tri, war_name, full_name")
      .eq("id", data.profileId)
      .maybeSingle();

    const tag = [profile?.tri, profile?.war_name || profile?.full_name]
      .filter(Boolean)
      .join(" — ");

    await supabaseAdmin.from("progression_log").insert({
      profile_id: data.profileId,
      profile_tag: tag,
      op_date: data.opDate,
      missao: data.missao,
      resultado: data.resultado,
      proxima_missao: proxima,
      registrado_por: data.registradoPor ?? "",
    });

    if (proxima) {
      await supabaseAdmin
        .from("profiles")
        .update({ proxima_missao: proxima })
        .eq("id", data.profileId);
    }

    return { proxima };
  });

/**
 * Desfaz o resultado de um voo: devolve a PRÓXIMA MISSÃO anterior ao
 * integrante e remove o registro de progressão correspondente.
 */
export const reverterResultado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { profileId: string; proximaAnterior: string; opDate: string; missao: string }) => {
      if (!input.profileId) throw new Error("Integrante não identificado.");
      return input;
    },
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin
      .from("profiles")
      .update({ proxima_missao: data.proximaAnterior ?? "" })
      .eq("id", data.profileId);

    const { data: rows } = await supabaseAdmin
      .from("progression_log")
      .select("id")
      .eq("profile_id", data.profileId)
      .eq("op_date", data.opDate)
      .eq("missao", data.missao)
      .order("created_at", { ascending: false })
      .limit(1);

    const id = rows?.[0]?.id;
    if (id) await supabaseAdmin.from("progression_log").delete().eq("id", id);

    return { proxima: data.proximaAnterior ?? "" };
  });
