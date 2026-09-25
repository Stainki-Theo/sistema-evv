/**
 * Categorias globais de missão e níveis operacionais.
 *
 * Fonte única usada por Panorama, Histórico, Quadro Operacional, Resumo
 * pós-operação, estatísticas e filtros. As listas são administráveis pelo
 * próprio site (Administração → Gerenciador de Categorias), sem alteração
 * de código.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isReboque, parseMissao } from "@/lib/missao";

export type MissionCategory = {
  id: string;
  key: string;
  label: string;
  cor: string;
  sort_order: number;
  active: boolean;
};

export type MissionOverride = {
  id: string;
  missao_base: string;
  category_key: string;
};

export type OperationalLevel = {
  id: string;
  nome: string;
  sort_order: number;
  active: boolean;
};

export const CATEGORIA_FALLBACK = "OUTRA";

/** Normaliza para comparação (sem acento, sem caixa) — evita duplicatas. */
export function normalizeCompare(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Corrige grafias antigas sem mudar o significado do nível operacional. */
export function operationalLevelLabel(value?: string | null) {
  const raw = (value ?? "").trim();
  if (normalizeCompare(raw) === "piloto basico") return "Piloto Básico";
  return raw;
}

/** Sigla de categoria de missão: sempre maiúscula e sem espaços nas pontas. */
export function normalizeCategoryKey(value?: string | null) {
  return (value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

/** Existe opção semelhante (mesma grafia ignorando caixa/acento)? */
export function findSimilar<T>(items: T[], label: (item: T) => string, candidate: string) {
  const key = normalizeCompare(candidate);
  if (!key) return undefined;
  return items.find((i) => normalizeCompare(label(i)) === key);
}

/* ---------- Consultas ---------- */

export function useMissionCategories() {
  return useQuery({
    queryKey: ["mission_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mission_categories")
        .select("*")
        .order("sort_order")
        .order("key");
      if (error) throw error;
      return (data ?? []) as MissionCategory[];
    },
  });
}

export function useMissionOverrides() {
  return useQuery({
    queryKey: ["mission_category_overrides"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mission_category_overrides")
        .select("*")
        .order("missao_base");
      if (error) throw error;
      return (data ?? []) as MissionOverride[];
    },
  });
}

export function useOperationalLevels() {
  return useQuery({
    queryKey: ["operational_levels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operational_levels")
        .select("*")
        .order("sort_order")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as OperationalLevel[];
    },
  });
}

/* ---------- Motor de classificação ---------- */

export type CategoriaResolver = {
  /** Categoria de uma missão (aceita "R1 PS-13"). */
  of: (missao?: string | null) => string;
  label: (key: string) => string;
  cor: (key: string) => string;
  categories: MissionCategory[];
};

export function makeResolver(
  categories?: MissionCategory[] | null,
  overrides?: MissionOverride[] | null,
): CategoriaResolver {
  const cats = (categories ?? []).slice();
  const byKey = new Map(cats.map((c) => [normalizeCategoryKey(c.key), c]));
  const overrideMap = new Map(
    (overrides ?? []).map((o) => [
      normalizeCategoryKey(o.missao_base),
      normalizeCategoryKey(o.category_key),
    ]),
  );
  // Prefixos mais longos primeiro: RPS antes de PS.
  const prefixes = cats
    .map((c) => normalizeCategoryKey(c.key))
    .filter((k) => k && k !== CATEGORIA_FALLBACK)
    .sort((a, b) => b.length - a.length);

  return {
    of(missao) {
      if (isReboque(missao)) return "REBOQUE";
      const { base } = parseMissao(missao);
      if (!base) return CATEGORIA_FALLBACK;
      const forced = overrideMap.get(base);
      if (forced) return forced;
      const hit = prefixes.find((p) => base.startsWith(p));
      return hit ?? CATEGORIA_FALLBACK;
    },
    label(key) {
      if (normalizeCategoryKey(key) === "REBOQUE") return "Reboque";
      const c = byKey.get(normalizeCategoryKey(key));
      return c?.label?.trim() || normalizeCategoryKey(key) || CATEGORIA_FALLBACK;
    },
    cor(key) {
      if (normalizeCategoryKey(key) === "REBOQUE") return "#2563eb";
      return byKey.get(normalizeCategoryKey(key))?.cor || "#475569";
    },
    categories: cats,
  };
}

/** Hook pronto: categorias + overrides já combinados. */
export function useCategoriaResolver() {
  const { data: categories } = useMissionCategories();
  const { data: overrides } = useMissionOverrides();
  return makeResolver(categories, overrides);
}

export type ResumoCategoria = {
  key: string;
  label: string;
  cor: string;
  total: number;
  missoes: { missao: string; total: number }[];
};

/**
 * Resumo por categoria preservando as missões reais.
 * Entrada: lista de missões como foram lançadas ("R1 PS-13", "AP-01"…).
 */
export function resumirMissoes(
  missoes: (string | null | undefined)[],
  resolver: CategoriaResolver,
): ResumoCategoria[] {
  const grupos = new Map<string, Map<string, number>>();
  for (const raw of missoes) {
    const texto = (raw ?? "").trim();
    if (!texto) continue;
    const { full } = parseMissao(texto);
    const nome = full || texto.toUpperCase();
    const key = resolver.of(texto);
    if (!grupos.has(key)) grupos.set(key, new Map());
    const inner = grupos.get(key)!;
    inner.set(nome, (inner.get(nome) ?? 0) + 1);
  }
  const ordem = new Map(
    resolver.categories.map((c, i) => [normalizeCategoryKey(c.key), c.sort_order * 1000 + i]),
  );
  return [...grupos.entries()]
    .map(([key, inner]) => ({
      key,
      label: resolver.label(key),
      cor: resolver.cor(key),
      total: [...inner.values()].reduce((a, b) => a + b, 0),
      missoes: [...inner.entries()]
        .map(([missao, total]) => ({ missao, total }))
        .sort((a, b) => a.missao.localeCompare(b.missao)),
    }))
    .sort((a, b) => {
      const oa = ordem.get(a.key) ?? 9_999_999;
      const ob = ordem.get(b.key) ?? 9_999_999;
      if (oa !== ob) return oa - ob;
      return a.key.localeCompare(b.key);
    });
}
