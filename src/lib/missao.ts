/**
 * Missões operacionais do EVV: repetições (R1/R2/R3/RN), categorias,
 * prioridade da escala e sequência operacional configurável.
 */

export type MissionSeq = {
  missao: string;
  proxima: string;
  pane: boolean;
  categoria: string;
};

export const RESULTADO = {
  PENDENTE: "PENDENTE",
  APROVADO: "APROVADO",
  NAO_APROVADO: "NAO_APROVADO",
  ABORTADO: "ABORTADO",
} as const;

export const RESULTADO_OPTIONS = [
  { value: RESULTADO.PENDENTE, label: "Pendente" },
  { value: RESULTADO.APROVADO, label: "Aprovado" },
  { value: RESULTADO.NAO_APROVADO, label: "Não aprovado" },
  { value: RESULTADO.ABORTADO, label: "Abortado" },
];

export function resultadoLabel(value?: string | null) {
  return RESULTADO_OPTIONS.find((o) => o.value === value)?.label ?? "Pendente";
}

/** Missões consideradas PANE quando não houver configuração no banco. */
export const PANE_FALLBACK = ["PS-15", "PS-16", "PS-17", "PS-18", "RPS-02"];

const REP_ORDER = ["", "R1", "R2", "R3", "RN"];

export type ParsedMissao = {
  /** Prefixo de repetição: "", R1, R2, R3 ou RN. */
  rep: string;
  /** Missão base normalizada: PS-13, RPS-02, X1, AP… */
  base: string;
  /** Texto completo exibido na escala: "R1 PS-13". */
  full: string;
};

/** Normaliza a missão base: "ps 13" → "PS-13"; "x1" → "X1". */
export function normalizeBase(value?: string | null) {
  const raw = (value ?? "").toUpperCase().replace(/\s+/g, "");
  const m = raw.match(/^(R?PS)-?(\d{1,2})$/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, "0")}`;
  return raw;
}

/** Separa o prefixo de repetição da missão base. */
export function parseMissao(value?: string | null): ParsedMissao {
  const raw = (value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  const m = raw.match(/^(R[123N])\s*[-–]?\s*(.+)$/);
  if (m && normalizeBase(m[2]) && !/^R?PS/.test(m[1]!)) {
    const base = normalizeBase(m[2]);
    return { rep: m[1]!, base, full: `${m[1]} ${base}` };
  }
  const base = normalizeBase(raw);
  return { rep: "", base, full: base };
}

export function joinMissao(rep: string, base: string) {
  return rep ? `${rep} ${base}` : base;
}

/** R1 → R2 → R3 → RN → RN (nunca R4). */
export function nextRepeticao(rep: string) {
  const idx = REP_ORDER.indexOf(rep);
  if (idx === -1) return "RN";
  return REP_ORDER[Math.min(idx + 1, REP_ORDER.length - 1)]!;
}

export function categoriaDe(base: string) {
  if (isReboque(base)) return "REBOQUE";
  if (base.startsWith("RPS")) return "RPS";
  if (base.startsWith("PS")) return "PS";
  if (base.startsWith("AP")) return "AP";
  if (base.startsWith("X")) return "X";
  return "OUTRA";
}

export function seqMap(rows?: MissionSeq[] | null) {
  const map = new Map<string, MissionSeq>();
  for (const r of rows ?? []) map.set(normalizeBase(r.missao), { ...r, missao: normalizeBase(r.missao) });
  return map;
}

export function isPane(base: string, seq?: Map<string, MissionSeq>) {
  const cfg = seq?.get(base);
  if (cfg) return cfg.pane;
  return PANE_FALLBACK.includes(base);
}

/** Próxima missão-base conforme a sequência operacional configurada. */
export function proximaBase(base: string, seq?: Map<string, MissionSeq>) {
  const cfg = seq?.get(base);
  if (cfg) return normalizeBase(cfg.proxima) || "";
  // Sem configuração o sistema não inventa a missão seguinte.
  return "";
}

/**
 * Estágios executados na mesma operação a partir de uma missão de PANE.
 * PS-15 → PS-15..PS-18; RPS-02 → RPS-02, RPS-01.
 */
export function paneStages(base: string, seq?: Map<string, MissionSeq>) {
  const stages = [base];
  let atual = base;
  for (let i = 0; i < 8; i += 1) {
    if (!isPane(atual, seq)) break;
    const next = proximaBase(atual, seq) || fallbackNext(atual);
    if (!next) break;
    const continua = isPane(next, seq) || categoriaDe(next) === "RPS";
    if (!continua) break;
    stages.push(next);
    atual = next;
  }
  return stages;
}

function fallbackNext(base: string) {
  const m = base.match(/^(R?PS)-(\d{2})$/);
  if (!m) return "";
  const n = Number(m[2]) + 1;
  if (m[1] === "RPS") return n === 3 ? "" : `RPS-${String(n).padStart(2, "0")}`;
  return `PS-${String(n).padStart(2, "0")}`;
}

/** Grupo de prioridade: 0 PANE · 1 PS · 2 AP · 3 outras. */
export function prioridadeGrupo(base: string, seq?: Map<string, MissionSeq>) {
  if (isPane(base, seq)) return 0;
  const cat = categoriaDe(base);
  if (cat === "PS" || cat === "RPS") return 1;
  if (cat === "AP") return 2;
  return 3;
}

/** Número da PS para ordenação decrescente (PS-19 antes de PS-04). */
export function missaoNumero(base: string) {
  const m = base.match(/-(\d{1,2})$/) ?? base.match(/(\d{1,2})$/);
  return m ? Number(m[1]) : 0;
}

/** Ordenação da escala: grupo de prioridade → PS mais alta primeiro → texto. */
export function compareMissao(a: string, b: string, seq?: Map<string, MissionSeq>) {
  const ga = prioridadeGrupo(a, seq);
  const gb = prioridadeGrupo(b, seq);
  if (ga !== gb) return ga - gb;
  const n = missaoNumero(b) - missaoNumero(a);
  if (n !== 0) return n;
  return a.localeCompare(b);
}

/** Reboque é sempre creditado ao rebocador/Ipanema. */
export function isReboque(missao?: string | null) {
  return /REBOQUE/i.test((missao ?? "").trim());
}
