export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export const PRIORITY: Record<string, { label: string; tone: Tone }> = {
  INFORMACAO: { label: "INFORMAÇÃO", tone: "info" },
  ATENCAO: { label: "ATENÇÃO", tone: "warning" },
  SEGURANCA: { label: "SEGURANÇA", tone: "warning" },
  URGENTE: { label: "URGENTE", tone: "danger" },
};

export const PRIORITY_OPTIONS = ["INFORMACAO", "ATENCAO", "SEGURANCA", "URGENTE"];

export const WX_CLASS: Record<string, { label: string; tone: Tone }> = {
  RUIM: { label: "RUIM", tone: "danger" },
  REGULAR: { label: "REGULAR", tone: "warning" },
  BOA: { label: "BOA", tone: "success" },
  MUITO_BOA: { label: "MUITO BOA", tone: "success" },
  EXCELENTE: { label: "EXCELENTE", tone: "success" },
};

export const WX_CLASS_OPTIONS = ["RUIM", "REGULAR", "BOA", "MUITO_BOA", "EXCELENTE"];

export const DEFAULT_FUNCTIONS = [
  "Chefe de Pista (Manhã)",
  "Chefe de Pista (Tarde)",
  "Sombra (Manhã)",
  "Sombra (Tarde)",
  "Rebocador (Manhã)",
  "Rebocador (Tarde)",
  "Motorista",
  "Responsável pelo Briefing Meteorológico",
  "Ponta de Cabo",
  "Ponta de Cabo",
  "Material",
  "Material",
  "Anotador",
  "RP",
];

/**
 * Exibição da função sem numeração de vaga (Ponta de Cabo 1 → Ponta de Cabo).
 * Só remove sufixos precedidos de separador — nunca a última letra do nome
 * (Sombra e Chefe de Pista permanecem íntegros).
 */
export function funcaoLabel(funcao?: string | null) {
  const raw = (funcao ?? "").trim();
  return raw.replace(/(?:\s*[_-]\s*|\s+)(?:[12]|[AB])$/, "").trim() || raw;
}

/* ---------- Missões / PANE ---------- */

/** Missões tratadas automaticamente como PANE (prioridade no início da operação). */
export const PANE_MISSOES = ["PS-15", "PS-16", "PS-17", "PS-18", "RPS-02"];

/** Normaliza a missão: "ps 15" → "PS-15". */
export function normalizeMissao(value?: string | null) {
  const raw = (value ?? "").toUpperCase().replace(/\s+/g, "");
  const m = raw.match(/^(R?PS)-?(\d{1,2})$/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, "0")}`;
  return raw;
}

export function isPaneMissao(value?: string | null) {
  return PANE_MISSOES.includes(normalizeMissao(value));
}

/** Sequências de PANE: estágios em ordem a partir da missão atual. */
export const PANE_SEQUENCIAS: Record<string, string[]> = {
  "PS-15": ["PS-15", "PS-16", "PS-17", "PS-18"],
  "PS-16": ["PS-16", "PS-17", "PS-18"],
  "PS-17": ["PS-17", "PS-18"],
  "PS-18": ["PS-18"],
  // Readaptação: RPS-02 primeiro, RPS-01 depois (nunca invertido).
  "RPS-02": ["RPS-02", "RPS-01"],
};

export const SAFETY_KINDS: Record<string, { label: string; tone: Tone }> = {
  AVISO: { label: "Avisos de Segurança", tone: "danger" },
  CONDICAO: { label: "Condições de Atenção", tone: "warning" },
  ORIENTACAO: { label: "Orientações do Dia", tone: "info" },
  OCORRENCIA: { label: "Ocorrências / Observações", tone: "neutral" },
};

export const SAFETY_KIND_OPTIONS = ["AVISO", "CONDICAO", "ORIENTACAO", "OCORRENCIA"];

export function label(value?: string | null) {
  return (value ?? "").replace(/_/g, " ");
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function nowHHMM() {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
}

/** Hora Zulu oficial, sem depender do fuso configurado no aparelho. */
export function nowZuluHHMM() {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
}

export function formatDatePtBr(iso?: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function formatDateTime(ts?: string | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function minutesToHours(min?: number | null) {
  const m = min ?? 0;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
}

/** Horas de voo no formato operacional 137:50 */
export function minutesToClock(min?: number | null) {
  const m = Math.max(0, min ?? 0);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

export function hoursToMinutes(text: string) {
  const match = text.trim().match(/^(\d+)\s*[h:]\s*(\d{1,2})?$/i);
  if (match) {
    const h = Number(match[1] ?? 0);
    const m = Number(match[2] ?? 0);
    return h * 60 + m;
  }
  const num = Number(text.replace(",", "."));
  if (!Number.isNaN(num)) return Math.round(num * 60);
  return 0;
}

const NEUTRAL = { label: "—", tone: "neutral" as Tone };

export function priority(key?: string | null) {
  return PRIORITY[key ?? ""] ?? { ...NEUTRAL, label: label(key) };
}
export function wxClass(key?: string | null) {
  return WX_CLASS[key ?? ""] ?? { ...NEUTRAL, label: label(key) };
}
export function safetyKind(key?: string | null) {
  return SAFETY_KINDS[key ?? ""] ?? { ...NEUTRAL, label: label(key) };
}

/* ---------- Efetivo ---------- */

/** Esquadrões da AFA. Turma/posto (C1, C2...) é um dado separado. */
export const ESQUADROES = ["Drakon", "Perseu", "Uiraçu", "Athos"];

const ESQUADRAO_ALIASES: Record<string, string> = {
  drakon: "Drakon",
  "1": "Drakon",
  "1 esquadrao": "Drakon",
  perseu: "Perseu",
  "2": "Perseu",
  "2 esquadrao": "Perseu",
  uiracu: "Uiraçu",
  "3": "Uiraçu",
  "3 esquadrao": "Uiraçu",
  athos: "Athos",
  "4": "Athos",
  "4 esquadrao": "Athos",
};

/** Converte tanto o nome da turma quanto a numeração antiga para um único valor. */
export function canonicalEsquadrao(value?: string | null) {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  const key = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[º°ª]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return ESQUADRAO_ALIASES[key] ?? raw;
}

/** Nome do agrupamento usado na aba Efetivo. */
export function esquadraoOrdinalLabel(value?: string | null) {
  const canonical = canonicalEsquadrao(value);
  const index = ESQUADROES.indexOf(canonical);
  return index >= 0 ? `${index + 1}º Esquadrão` : canonical;
}

export const CARGOS = ["Presidente", "Supervisão", "Diretor", "Assessor"];

/** Cargo com acesso total de visualização (sem poderes administrativos). */
export const CARGO_SUPERVISAO = "Supervisão";

/** Opção usada quando o integrante não possui função em Diretoria/Assessoria. */
export const SEM_FUNCAO = "Sem função";

/** Posto / Graduação — exatamente as opções operacionais válidas. */
export const POSTOS = [
  "C1",
  "C2",
  "C3",
  "C4",
  "ASP",
  "2 TEN",
  "1 TEN",
  "CAP",
  "MAJ",
  "TCEL",
  "CEL",
  "BRIG",
];

/** Níveis operacionais do Voo a Vela e suas siglas de uso na planilha. */
export const NIVEIS_OPERACIONAIS = [
  { value: "Aluno", label: "AL" },
  { value: "Piloto Básico", label: "PB" },
  { value: "Piloto Operacional", label: "PO" },
  { value: "Instrutor", label: "IN" },
  { value: "Checador", label: "CH" },
  { value: "Piloto de Competição", label: "PC" },
] as const;

/** Tipos de cargo em uma Diretoria. */
export const DIRETORIA_TIPOS = { DIRETOR: "DIRETOR", ASSESSOR: "ASSESSOR" } as const;

export function diretoriaTipoLabel(tipo?: string | null) {
  return tipo === "ASSESSOR" ? "Assessor" : "Diretor";
}

/** Tipos de aeronave — usados pelos contadores da Planilha do Anotador. */
export const AIRCRAFT_TIPOS = [
  { value: "PLANADOR", label: "Planador" },
  { value: "REBOCADOR", label: "Rebocador / Ipanema" },
];

/** Modelos usados no controle estatístico da frota. */
export const AIRCRAFT_MODELOS = [
  "DG-1000 / DG-1001",
  "Duo Discus",
  "Planador CS",
  "Ipanema EMB-202",
  "Outro",
];

/** Situação do voo na Planilha do Anotador. */
export const FLIGHT_STATUS = ["GUARNECIDO", "EM VOO", "REALIZADO"];

/** Converte HH:MM em minutos (aceita 1230 e 12:30). */
export function hhmmToMinutes(value?: string | null) {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const m = raw.match(/^(\d{1,2}):?(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Tempo de voo (POUSO − DEP) no formato 00:35. */
export function flightDuration(dep?: string | null, land?: string | null) {
  const a = hhmmToMinutes(dep);
  const b = hhmmToMinutes(land);
  if (a === null || b === null) return { minutes: 0, text: "—" };
  const diff = (b - a + 1440) % 1440;
  return {
    minutes: diff,
    text: `${String(Math.floor(diff / 60)).padStart(2, "0")}:${String(diff % 60).padStart(2, "0")}`,
  };
}

export const TRI_SUGESTOES = ["AFF", "AGI", "CRB", "DGO"];

export const OPR_OPTIONS = ["", "Sim", "Não", "Em formação"];

/** Trigrama normalizado: 3 caracteres em maiúsculas. */
export function normalizeTri(value?: string | null) {
  return (value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 3);
}

/** Identificação operacional: "STK — STAINKI" (ou o que houver). */
export function personTag(
  p?: {
    tri?: string | null;
    war_name?: string | null;
    full_name?: string | null;
  } | null,
) {
  const nome = (p?.war_name || p?.full_name || "").trim();
  const tri = normalizeTri(p?.tri);
  if (tri && nome) return `${tri} — ${nome.toUpperCase()}`;
  return tri || nome || "—";
}

/** Ordem fixa dos esquadrões para agrupamento. */
export function esquadraoOrder(esq?: string | null) {
  const idx = ESQUADROES.indexOf(canonicalEsquadrao(esq));
  return idx === -1 ? ESQUADROES.length : idx;
}

/** Ordenação operacional: esquadrão → horas de voo (maior primeiro) → trigrama/nome. */
export function compareOperacional(
  a: {
    esquadrao?: string | null;
    flight_minutes?: number | null;
    tri?: string | null;
    war_name?: string | null;
    full_name?: string | null;
  },
  b: typeof a,
) {
  const e = esquadraoOrder(a.esquadrao) - esquadraoOrder(b.esquadrao);
  if (e !== 0) return e;
  const h = (b.flight_minutes ?? 0) - (a.flight_minutes ?? 0);
  if (h !== 0) return h;
  return personTag(a).localeCompare(personTag(b));
}

/* ---------- Disponibilidade ---------- */

export const AVAIL = {
  YES: "DISPONIVEL",
  NO: "INDISPONIVEL",
  NONE: "NAO_RESPONDEU",
} as const;

export type AvailStatus = (typeof AVAIL)[keyof typeof AVAIL];

export const AVAIL_LABEL: Record<string, { label: string; short: string; tone: Tone }> = {
  DISPONIVEL: { label: "Disponível", short: "✓", tone: "success" },
  INDISPONIVEL: { label: "Indisponível", short: "✕", tone: "danger" },
  NAO_RESPONDEU: { label: "Não respondeu", short: "—", tone: "neutral" },
};

export function availLabel(status?: string | null) {
  return AVAIL_LABEL[status ?? ""] ?? AVAIL_LABEL["NAO_RESPONDEU"]!;
}

/* ---------- Contas ---------- */

export const NIVEIS = { ADMIN: "administrador", SUPERVISOR: "operador", MEMBRO: "usuario" } as const;

export function nivelLabel(role?: string | null) {
  if (role === NIVEIS.ADMIN) return "ADMIN";
  if (role === NIVEIS.SUPERVISOR) return "SUPERVISOR";
  return "MEMBRO";
}

export const ACCOUNT_STATUS: Record<string, { label: string; tone: Tone }> = {
  ATIVO: { label: "ATIVO", tone: "success" },
  BLOQUEADO: { label: "BLOQUEADO", tone: "danger" },
  DESATIVADO: { label: "DESATIVADO", tone: "neutral" },
  FORMADO: { label: "FORMADO", tone: "info" },
};

/* ---------- Datas / semanas ---------- */

export function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function shortDate(iso?: string | null) {
  if (!iso) return "—";
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function weekdayName(iso: string) {
  const parts = iso.split("-").map(Number);
  const d = new Date(parts[0] ?? 2000, (parts[1] ?? 1) - 1, parts[2] ?? 1);
  return WEEKDAYS[d.getDay()] ?? "";
}

/** Sábado da semana que contém a data informada. */
export function saturdayOf(iso: string) {
  const parts = iso.split("-").map(Number);
  const d = new Date(parts[0] ?? 2000, (parts[1] ?? 1) - 1, parts[2] ?? 1);
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
  return toISO(d);
}

export function addDaysISO(iso: string, days: number) {
  const parts = iso.split("-").map(Number);
  const d = new Date(parts[0] ?? 2000, (parts[1] ?? 1) - 1, parts[2] ?? 1);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

/* ---------- Meteorologia ---------- */

export const FOG_MODES = { NONE: "NAO_HA", CHANCE: "CHANCE" } as const;

export function fogLabel(fog?: string | null, chance?: string | null) {
  if (fog === FOG_MODES.CHANCE) return `${(chance ?? "").trim() || "0"}%`;
  if (fog === FOG_MODES.NONE || !fog) return "Não há";
  return fog;
}

export function fogLongLabel(fog?: string | null, chance?: string | null) {
  if (fog === FOG_MODES.CHANCE) return `${(chance ?? "").trim() || "0"}% de chance`;
  return "Não há";
}

/* ---------- Bibliotecas ---------- */

export const DOC_CATEGORIES = [
  "Manuais",
  "Minutas de Voo",
  "Segurança de Voo",
  "Procedimentos",
  "Instrução",
  "Documentos Administrativos",
  "Outros",
];

export const RELPREV_CATEGORIES = [
  "Operação",
  "Material",
  "Meteorologia",
  "Pista",
  "Tráfego",
  "Outros",
];

/* ---------- Avisos: escopo persistente x temporário ---------- */

export const AVISO_SCOPE = { PERSISTENTE: "PERSISTENTE", TEMPORARIO: "TEMPORARIO" } as const;

export const TEMPORARIO_HINT = "Avisos válidos somente para a operação de hoje.";

/**
 * Um aviso persistente vigorou na operação da data informada se foi criado até
 * aquele dia e não havia sido arquivado antes dele.
 */
export function vigenteEm(
  item: { op_date?: string | null; scope?: string | null; archived_at?: string | null },
  date: string,
) {
  const criado = String(item.op_date ?? "");
  if (item.scope === AVISO_SCOPE.TEMPORARIO) return criado === date;
  if (criado > date) return false;
  if (!item.archived_at) return true;
  return String(item.archived_at).slice(0, 10) >= date;
}

/** Integrante disponível para NOVAS atividades operacionais. */
export function isAtivo(p?: { status?: string | null } | null) {
  return (p?.status ?? "ATIVO") === "ATIVO";
}

/* ---------- Planilha do Anotador: cores por situação ---------- */

/** Cor da linha conforme a situação do voo (laranja, verde, azul). */
export const FLIGHT_STATUS_STYLE: Record<string, { row: string; dot: string; label: string }> = {
  GUARNECIDO: {
    row: "border-l-4 border-orange-600 bg-orange-500/25 hover:bg-orange-500/35",
    dot: "bg-orange-600",
    label: "Guarnecido",
  },
  "EM VOO": {
    row: "border-l-4 border-emerald-600 bg-emerald-500/25 hover:bg-emerald-500/35",
    dot: "bg-emerald-600",
    label: "Em voo",
  },
  REALIZADO: {
    row: "border-l-4 border-blue-600 bg-blue-500/25 hover:bg-blue-500/35",
    dot: "bg-blue-600",
    label: "Realizado",
  },
};

export function flightStatusStyle(status?: string | null) {
  return (
    FLIGHT_STATUS_STYLE[(status ?? "").toUpperCase()] ?? {
      row: "odd:bg-background even:bg-muted/20",
      dot: "bg-muted-foreground",
      label: label(status) || "—",
    }
  );
}

/**
 * Minutos decorridos desde a decolagem até agora, para o painel de voos em andamento.
 *
 * Diferentemente do cálculo final DEP–POUSO, um horário de decolagem posterior ao
 * relógio atual não deve ser interpretado automaticamente como “ontem”. Isso evita
 * transformar, por exemplo, DEP 15:15 às 13:56 em 22:41 de voo.
 */
export function elapsedFrom(dep?: string | null, reference = nowZuluHHMM()) {
  const a = hhmmToMinutes(dep);
  const b = hhmmToMinutes(reference);
  if (a === null || b === null) return { minutes: 0, text: "—" };
  const rawDiff = b - a;
  // Uma diferença negativa pequena indica DEP futura; uma diferença superior a
  // 12 horas caracteriza, na prática operacional, a passagem pela meia-noite Z.
  const diff = rawDiff >= 0 ? rawDiff : Math.abs(rawDiff) > 720 ? rawDiff + 1440 : 0;
  return { minutes: diff, text: minutesToClock(diff) };
}

/* ---------- Calendário ---------- */

export const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Primeiro e último dia (ISO) do mês informado (month: 1-12). */
export function monthRange(year: number, month: number) {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  return { start: toISO(first), end: toISO(last) };
}

/** Grade do mês em semanas de 7 dias (inclui dias vizinhos para completar). */
export function monthMatrix(year: number, month: number) {
  const first = new Date(year, month - 1, 1);
  const start = new Date(first);
  start.setDate(start.getDate() - start.getDay());
  const weeks: { iso: string; inMonth: boolean }[][] = [];
  const cursor = new Date(start);
  for (let w = 0; w < 6; w += 1) {
    const week: { iso: string; inMonth: boolean }[] = [];
    for (let d = 0; d < 7; d += 1) {
      week.push({ iso: toISO(cursor), inMonth: cursor.getMonth() === month - 1 });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
    if (cursor.getMonth() !== month - 1 && weeks.length >= 5) break;
  }
  return weeks;
}

/** Categoria padrão das operações geradas automaticamente pelo sistema. */
export const CATEGORIA_OPERACAO = "Operação";
