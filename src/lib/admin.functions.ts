import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ADMIN = "administrador";
const SUPERVISOR = "operador";
const MEMBRO = "usuario";

type Ctx = { supabase: any; userId: string };

async function assertAdmin(context: Ctx) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", ADMIN)
    .maybeSingle();
  if (error || !data) throw new Error("Ação permitida apenas para administradores.");
}

function normalizeNivel(nivel: string) {
  if (nivel === ADMIN) return ADMIN;
  if (nivel === SUPERVISOR) return SUPERVISOR;
  return MEMBRO;
}

export const listAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as unknown as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, war_name, email, status, esquadrao, posto, fase")
        .order("war_name"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);
    const roleMap = new Map<string, string>();
    for (const r of roles ?? []) {
      if (r.role === ADMIN) roleMap.set(r.user_id, ADMIN);
      else if (r.role === SUPERVISOR && roleMap.get(r.user_id) !== ADMIN) roleMap.set(r.user_id, SUPERVISOR);
      else if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, r.role as string);
    }
    return (profiles ?? []).map((p) => ({ ...p, nivel: roleMap.get(p.id) ?? MEMBRO }));
  });

export const createAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      email: string;
      password?: string;
      full_name?: string;
      war_name: string;
      nivel: string;
      gaivota?: string;
      posto?: string;
      tri?: string;
      esquadrao?: string;
      diretoria?: string;
      funcao?: string;
      fase?: string;
    }) => {
      if (!input.email?.includes("@")) throw new Error("Informe um e-mail válido.");
      if (input.password && input.password.length < 6)
        throw new Error("A senha inicial precisa ter no mínimo 6 caracteres.");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();
    const metadata = {
        full_name: (data.full_name ?? "").trim(),
        war_name: (data.war_name ?? "").trim(),
        funcao: data.funcao ?? "",
        gaivota: data.gaivota ?? "",
        posto: data.posto ?? "",
        tri: data.tri ?? "",
        esquadrao: data.esquadrao ?? "",
        diretoria: data.diretoria ?? "",
        fase: data.fase ?? "",
      };
    const { data: created, error } = data.password
      ? await supabaseAdmin.auth.admin.createUser({
          email,
          password: data.password,
          email_confirm: true,
          user_metadata: metadata,
        })
      : await supabaseAdmin.auth.admin.inviteUserByEmail(email, { data: metadata });
    if (error || !created.user) throw new Error(error?.message ?? "Falha ao criar usuário.");

    const userId = created.user.id;
    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: (data.full_name ?? "").trim(),
        war_name: (data.war_name ?? "").trim(),
        email,
        funcao: data.funcao ?? "",
        gaivota: data.gaivota ?? "",
        posto: data.posto ?? "",
        tri: data.tri ?? "",
        esquadrao: data.esquadrao ?? "",
        diretoria: data.diretoria ?? "",
        fase: data.fase ?? "",
        status: "ATIVO",
      })
      .eq("id", userId);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: normalizeNivel(data.nivel) });
    return { id: userId, invited: !data.password };
  });

export const setAccountNivel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; nivel: string }) => input)
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await assertAdmin(ctx);
    if (data.userId === ctx.userId)
      throw new Error("Não é possível alterar o nível da própria conta.");
    const nivel = normalizeNivel(data.nivel);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: nivel });
    return { ok: true };
  });

export const setAccountFase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; fase: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as Ctx);
    const fase = data.fase.trim();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ fase })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setAccountStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; status: string }) => {
    if (!["ATIVO", "BLOQUEADO", "DESATIVADO"].includes(input.status))
      throw new Error("Situação inválida.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await assertAdmin(ctx);
    if (data.userId === ctx.userId)
      throw new Error("Não é possível alterar a situação da própria conta.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.status === "ATIVO" ? "none" : "876000h",
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("profiles").update({ status: data.status }).eq("id", data.userId);
    return { ok: true };
  });

export const resetAccountPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; password: string }) => {
    if (!input.password || input.password.length < 6)
      throw new Error("A senha precisa ter no mínimo 6 caracteres.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Exclusão permanente de conta.
 *
 * O histórico operacional é preservado: os lançamentos (escala, planilha do
 * anotador, progressão, disponibilidade) mantêm o texto original e apenas
 * perdem o vínculo com o perfil; a identificação do integrante fica registrada
 * em `deleted_members`.
 */
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => {
    if (!input.userId) throw new Error("Conta inválida.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await assertAdmin(ctx);
    if (data.userId === ctx.userId)
      throw new Error("Não é possível excluir a própria conta.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: alvo } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, war_name, tri, email, esquadrao, posto")
      .eq("id", data.userId)
      .maybeSingle();
    const { data: autor } = await supabaseAdmin
      .from("profiles")
      .select("war_name, full_name")
      .eq("id", ctx.userId)
      .maybeSingle();

    if (alvo) {
      await supabaseAdmin.from("deleted_members").insert({
        id: alvo.id,
        full_name: alvo.full_name ?? "",
        war_name: alvo.war_name ?? "",
        tri: alvo.tri ?? "",
        email: alvo.email ?? "",
        esquadrao: alvo.esquadrao ?? "",
        posto: alvo.posto ?? "",
        deleted_by: autor?.war_name || autor?.full_name || "",
      });
    }

    // Preserva o histórico: solta os vínculos antes de remover o perfil.
    await supabaseAdmin.from("flight_schedule").update({ profile_id: null }).eq("profile_id", data.userId);
    await supabaseAdmin.from("annotator_flights").update({ al_profile_id: null }).eq("al_profile_id", data.userId);
    await supabaseAdmin.from("progression_log").update({ profile_id: null }).eq("profile_id", data.userId);
    await supabaseAdmin.from("duty_roster").update({ profile_id: null }).eq("profile_id", data.userId);
    await supabaseAdmin.from("availability_entries").delete().eq("profile_id", data.userId);
    await supabaseAdmin.from("diretoria_assignments").delete().eq("profile_id", data.userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);
    return { ok: true };
  });
