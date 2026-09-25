import {
  compareMissao,
  isPane,
  joinMissao,
  paneStages,
  parseMissao,
  type MissionSeq,
} from "@/lib/missao";
import { compareOperacional, personTag } from "@/lib/evv";

export type EscalaPerson = {
  id: string;
  tri?: string | null;
  war_name?: string | null;
  full_name?: string | null;
  esquadrao?: string | null;
  flight_minutes?: number | null;
  status?: string | null;
  proxima_missao?: string | null;
  missao?: string | null;
};

export type AutoRow = {
  profile_id: string;
  aluno: string;
  instrutor: string;
  missao: string;
  observacao: string;
  pane: boolean;
};

/** Fonte única de verdade da próxima missão do integrante. */
export function proximaDoIntegrante(p: EscalaPerson) {
  return parseMissao(p.proxima_missao || p.missao);
}

/**
 * Linhas automáticas da escala de um dia.
 *
 * - o integrante entra no PRIMEIRO dia em que está disponível; dias seguintes
 *   só recebem entrada depois que houver resultado registrado (nunca presumir
 *   aprovação);
 * - PANE primeiro (estágios intercalados entre tripulantes), depois PS em ordem
 *   decrescente, depois AP e por fim as demais missões.
 */
export function buildAutoRows({
  day,
  days,
  people,
  availableDays,
  progressedDays = () => [],
  seq,
}: {
  day: string;
  days: string[];
  people: EscalaPerson[];
  availableDays: (personId: string) => string[];
  /** Dias em que o integrante já teve resultado registrado na planilha. */
  progressedDays?: (personId: string) => string[];
  seq?: Map<string, MissionSeq> | undefined;
}): AutoRow[] {
  const ordered = [...new Set(days)].sort();
  const eligible = people
    .filter((p) => (p.status ?? "ATIVO") === "ATIVO")
    .filter((p) => !!proximaDoIntegrante(p).base)
    .filter((p) => {
      const avail = availableDays(p.id)
        .filter((d) => ordered.includes(d))
        .sort();
      if (!avail.includes(day)) return false;
      if (avail[0] === day) return true;
      // Dias posteriores só entram com progressão registrada em dia anterior.
      return progressedDays(p.id).some((d) => d < day);
    })
    .sort(compareOperacional);

  const paneCrews: { person: EscalaPerson; stages: string[] }[] = [];
  const normais: { person: EscalaPerson; missao: string; base: string }[] = [];

  for (const person of eligible) {
    const { rep, base } = proximaDoIntegrante(person);
    if (isPane(base, seq)) {
      const stages = paneStages(base, seq).map((s, i) => (i === 0 ? joinMissao(rep, s) : s));
      paneCrews.push({ person, stages });
    } else {
      normais.push({ person, missao: joinMissao(rep, base), base });
    }
  }

  normais.sort((a, b) => compareMissao(a.base, b.base, seq) || compareOperacional(a.person, b.person));

  const rows: AutoRow[] = [];
  const maxStages = paneCrews.reduce((max, c) => Math.max(max, c.stages.length), 0);
  for (let stage = 0; stage < maxStages; stage += 1) {
    for (const crew of paneCrews) {
      const missao = crew.stages[stage];
      if (!missao) continue;
      rows.push(toRow(crew.person, missao, seq));
    }
  }
  for (const item of normais) rows.push(toRow(item.person, item.missao, seq));
  return rows;
}

function toRow(person: EscalaPerson, missao: string, seq?: Map<string, MissionSeq>): AutoRow {
  const { base } = parseMissao(missao);
  const pane = isPane(base, seq);
  return {
    profile_id: person.id,
    aluno: personTag(person),
    instrutor: "",
    missao,
    observacao: pane ? "PANE" : "",
    pane,
  };
}
