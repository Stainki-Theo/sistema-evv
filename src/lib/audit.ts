import { supabase } from "@/integrations/supabase/client";

/**
 * Log de alterações do EVV.
 *
 * Registra automaticamente quem mudou o quê, em qual área, com o valor
 * anterior e o novo — e permite desfazer a alteração revertendo também os
 * efeitos em cadeia (ex.: progressão de missão).
 */

/** Tabelas que podem ser revertidas pelo log (lista fechada por segurança). */
export const AUDIT_TABLES = [
  "annotator_flights",
  "annotator_activations",
  "flight_schedule",
  "duty_roster",
  "weather_observations",
  "announcements",
  "safety_entries",
  "availability_entries",
  "calendar_events",
  "op_days",
  "profiles",
] as const;

export type AuditTable = (typeof AUDIT_TABLES)[number];

export const AREA_LABEL: Record<string, string> = {
  ANOTADOR: "Planilha do Anotador",
  ESCALA: "Escala do Dia",
  FUNCOES: "Funções",
  METEOROLOGIA: "Meteorologia",
  AVISOS: "Avisos",
  SEGURANCA: "Segurança de Voo",
  DISPONIBILIDADE: "Disponibilidade",
  CALENDARIO: "Calendário",
  OPERACAO: "Operação",
  EFETIVO: "Efetivo",
  PROGRESSAO: "Progressão",
};

export const AUDIT_ACTIONS = { INSERT: "INSERT", UPDATE: "UPDATE", DELETE: "DELETE" } as const;

export const ACTION_LABEL: Record<string, string> = {
  INSERT: "Criação",
  UPDATE: "Alteração",
  DELETE: "Exclusão",
};

export type ChangeEntry = {
  area: keyof typeof AREA_LABEL | string;
  /** Tabela do registro alterado (usada para desfazer). */
  entity: AuditTable | string;
  entityId: string;
  entityLabel?: string;
  action?: keyof typeof AUDIT_ACTIONS;
  field?: string;
  fieldLabel?: string;
  oldValue?: string | number | null;
  newValue?: string | number | null;
  opDate?: string | null;
  /** Dados extras para desfazer (snapshot, efeitos em cadeia). */
  details?: Record<string, unknown>;
};

export type Actor = { id?: string | null | undefined; tag?: string | null | undefined };

function text(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  return String(value);
}

/** Grava uma ou mais alterações no log (falha silenciosa: nunca bloqueia a operação). */
export async function logChanges(entries: ChangeEntry[], actor: Actor) {
  const rows = entries
    .filter((e) => e.action !== "UPDATE" || text(e.oldValue) !== text(e.newValue))
    .map((e) => ({
      area: String(e.area),
      entity: String(e.entity),
      entity_id: e.entityId,
      entity_label: e.entityLabel ?? "",
      action: e.action ?? "UPDATE",
      field: e.field ?? "",
      field_label: e.fieldLabel ?? e.field ?? "",
      old_value: text(e.oldValue),
      new_value: text(e.newValue),
      details: (e.details ?? {}) as never,
      op_date: e.opDate ?? null,
      user_id: actor.id ?? null,
      user_tag: actor.tag ?? "",
    }));
  if (!rows.length) return;
  const { error } = await supabase.from("change_log").insert(rows);
  if (error) console.error("change_log", error.message);
}

export async function logChange(entry: ChangeEntry, actor: Actor) {
  await logChanges([entry], actor);
}

/** Campos numéricos: precisam voltar como número ao desfazer. */
const NUMERIC_FIELDS = new Set(["qtd", "sort_order", "ordem", "flight_minutes", "ops", "pso"]);

function parseValue(field: string, value: string) {
  if (NUMERIC_FIELDS.has(field)) return Number(value) || 0;
  if (value === "") return field.endsWith("_id") ? null : "";
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

export type ChangeRow = {
  id: string;
  area: string;
  entity: string;
  entity_id: string;
  entity_label: string;
  action: string;
  field: string;
  field_label: string;
  old_value: string;
  new_value: string;
  details: Record<string, unknown> | null;
  op_date: string | null;
  user_tag: string;
  reverted_at: string | null;
  reverted_by: string;
  created_at: string;
};

/** Descreve, em português, o que será feito ao desfazer a alteração. */
export function undoDescription(row: ChangeRow) {
  const alvo = row.entity_label || row.entity;
  if (row.action === AUDIT_ACTIONS.INSERT) return `O registro “${alvo}” será excluído.`;
  if (row.action === AUDIT_ACTIONS.DELETE) return `O registro “${alvo}” será recriado.`;
  const anterior = row.old_value || "vazio";
  const extra = row.details?.["progression"]
    ? " A progressão de missão do integrante também será revertida."
    : "";
  return `“${row.field_label || row.field}” volta para “${anterior}”.${extra}`;
}

/**
 * Desfaz a alteração registrada, tratando os efeitos em cadeia.
 * Devolve a mensagem de resultado para exibição.
 */
export async function undoChange(
  row: ChangeRow,
  actor: Actor,
  reverterProgressao?: (input: {
    data: { profileId: string; proximaAnterior: string; opDate: string; missao: string };
  }) => Promise<unknown>,
) {
  if (row.reverted_at) throw new Error("Esta alteração já foi desfeita.");
  if (!AUDIT_TABLES.includes(row.entity as AuditTable))
    throw new Error("Esta alteração não pode ser desfeita automaticamente.");

  const table = row.entity as AuditTable;

  if (row.action === AUDIT_ACTIONS.INSERT) {
    const { error } = await supabase.from(table).delete().eq("id", row.entity_id);
    if (error) throw new Error(error.message);
  } else if (row.action === AUDIT_ACTIONS.DELETE) {
    const snapshot = row.details?.["snapshot"];
    if (!snapshot) throw new Error("Sem dados suficientes para recriar o registro.");
    const { error } = await supabase.from(table).insert(snapshot as never);
    if (error) throw new Error(error.message);
  } else {
    if (!row.field) throw new Error("Alteração sem campo identificado.");
    const { error } = await supabase
      .from(table)
      .update({ [row.field]: parseValue(row.field, row.old_value) } as never)
      .eq("id", row.entity_id);
    if (error) throw new Error(error.message);
  }

  // Efeito em cadeia: resultado do voo alimentou a progressão do integrante.
  const progression = row.details?.["progression"] as
    | { profileId: string; proximaAnterior: string; opDate: string; missao: string }
    | undefined;
  if (progression?.profileId && reverterProgressao) {
    await reverterProgressao({ data: progression });
  }

  const { error: markError } = await supabase
    .from("change_log")
    .update({
      reverted_at: new Date().toISOString(),
      reverted_by: actor.tag ?? "",
    } as never)
    .eq("id", row.id);
  if (markError) throw new Error(markError.message);

  return progression?.profileId
    ? "Alteração desfeita e progressão de missão revertida."
    : "Alteração desfeita.";
}
