/**
 * Estatísticas operacionais calculadas a partir do histórico real:
 * planilha do Anotador (voos, pousos, resultados) e escala de serviço.
 *
 * Nada aqui é digitado à mão: OPS, pousos e serviços são derivados dos
 * lançamentos já existentes no sistema.
 */

import { flightDuration } from "@/lib/evv";
import { categoriaDe, isReboque, parseMissao, RESULTADO } from "@/lib/missao";

export type FlightLike = {
  op_date: string;
  dep_time: string;
  land_time: string;
  missao: string;
  al_1p: string;
  in_2p: string;
  aeronave: string;
  resultado: string;
  al_profile_id?: string | null;
};

export type DutyLike = {
  op_date: string;
  funcao: string;
  profile_id?: string | null;
  responsavel: string;
};

export type ProfileLike = {
  id: string;
  tri?: string | null;
  war_name?: string | null;
  full_name?: string | null;
};

export type PessoaStats = {
  /** Operações distintas em que a pessoa voou. */
  ops: number;
  /** Pousos de planador (reboques não contam como pouso do aluno). */
  pousos: number;
  /** Minutos de voo lançados na planilha. */
  minutos: number;
  aprovados: number;
  naoAprovados: number;
  /** Pousos por categoria de missão: PS, RPS, AP, X, OUTRA (fallback local). */
  porCategoria: Record<string, number>;
  /** Contagem por missão-base (PS-13, X1…). */
  porMissao: Record<string, number>;
  /** Missões reais lançadas (com prefixo de repetição), uma entrada por pouso — usadas para o resumo por categoria global e sua expansão. */
  missoes: string[];
  ultimaOperacao: string;
};

export type ServicoStats = {
  total: number;
  porFuncao: Record<string, number>;
  ultimaOperacao: string;
};

function chave(value?: string | null) {
  return (value ?? "").trim().toUpperCase();
}

/** Índice de apelidos (TRI, nome de guerra, nome completo) → id do integrante. */
export function buildProfileIndex(profiles?: ProfileLike[] | null) {
  const index = new Map<string, string>();
  for (const p of profiles ?? []) {
    for (const key of [p.tri, p.war_name, p.full_name]) {
      const k = chave(key);
      if (k && !index.has(k)) index.set(k, p.id);
    }
  }
  return index;
}

function emptyStats(): PessoaStats {
  return {
    ops: 0,
    pousos: 0,
    minutos: 0,
    aprovados: 0,
    naoAprovados: 0,
    porCategoria: {},
    porMissao: {},
    missoes: [],
    ultimaOperacao: "",
  };
}

/** Estatísticas de voo por integrante, a partir de toda a planilha do Anotador. */
export function statsPorPessoa(
  flights?: FlightLike[] | null,
  profiles?: ProfileLike[] | null,
  /** Resolver global de categorias (opcional); sem ele usa a classificação local fixa. */
  categoriaOf?: (missao?: string | null) => string,
): Map<string, PessoaStats> {
  const index = buildProfileIndex(profiles);
  const result = new Map<string, PessoaStats>();
  const opsSet = new Map<string, Set<string>>();

  const bump = (id: string) => {
    const atual = result.get(id) ?? emptyStats();
    result.set(id, atual);
    return atual;
  };

  for (const f of flights ?? []) {
    const alId = f.al_profile_id || index.get(chave(f.al_1p)) || "";
    const inId = index.get(chave(f.in_2p)) || "";
    const { minutes } = flightDuration(f.dep_time, f.land_time);
    const pousou = !!(f.land_time ?? "").trim();
    const reboque = isReboque(f.missao);
    const { base, full } = parseMissao(f.missao);
    const categoria = categoriaOf ? categoriaOf(f.missao) : base ? categoriaDe(base) : "OUTRA";

    for (const id of [alId, inId]) {
      if (!id) continue;
      const s = bump(id);
      if (!opsSet.has(id)) opsSet.set(id, new Set());
      opsSet.get(id)!.add(f.op_date);
      if (f.op_date > s.ultimaOperacao) s.ultimaOperacao = f.op_date;
    }

    if (!alId) continue;
    const s = bump(alId);
    s.minutos += minutes;
    if (pousou && !reboque) {
      s.pousos += 1;
      s.porCategoria[categoria] = (s.porCategoria[categoria] ?? 0) + 1;
      if (base) s.porMissao[base] = (s.porMissao[base] ?? 0) + 1;
      if (full) s.missoes.push(full);
    }
    if (f.resultado === RESULTADO.APROVADO) s.aprovados += 1;
    if (f.resultado === RESULTADO.NAO_APROVADO) s.naoAprovados += 1;
  }

  for (const [id, dias] of opsSet) {
    const s = result.get(id);
    if (s) s.ops = dias.size;
  }
  return result;
}

/** Serviços cumpridos por integrante, a partir da escala de funções. */
export function servicosPorPessoa(
  duties?: DutyLike[] | null,
  profiles?: ProfileLike[] | null,
): Map<string, ServicoStats> {
  const index = buildProfileIndex(profiles);
  const result = new Map<string, ServicoStats>();
  for (const d of duties ?? []) {
    const id = d.profile_id || index.get(chave(d.responsavel)) || "";
    if (!id) continue;
    const atual =
      result.get(id) ?? ({ total: 0, porFuncao: {}, ultimaOperacao: "" } as ServicoStats);
    atual.total += 1;
    const funcao = (d.funcao || "Serviço").trim();
    atual.porFuncao[funcao] = (atual.porFuncao[funcao] ?? 0) + 1;
    if (d.op_date > atual.ultimaOperacao) atual.ultimaOperacao = d.op_date;
    result.set(id, atual);
  }
  return result;
}

/** Categorias em ordem de exibição, com rótulo legível. */
export const CATEGORIAS_MISSAO = [
  { key: "PS", label: "Pré-solo (PS)" },
  { key: "RPS", label: "Revalidação (RPS)" },
  { key: "AP", label: "Aperfeiçoamento (AP)" },
  { key: "X", label: "Cross-country (X)" },
  { key: "REBOQUE", label: "Reboque" },
  { key: "OUTRA", label: "Outras" },
] as const;
