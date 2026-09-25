import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Merge, Pencil, Plus, Power, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { ComboCreate } from "@/components/ComboCreate";
import { useAuth, displayName } from "@/lib/auth";
import { logChange } from "@/lib/audit";
import { useAllAnnotatorFlights } from "@/lib/data";
import { parseMissao } from "@/lib/missao";
import {
  CATEGORIA_FALLBACK,
  findSimilar,
  makeResolver,
  normalizeCategoryKey,
  useMissionCategories,
  useMissionOverrides,
} from "@/lib/categorias";

const AREAS_IMPACTADAS = [
  "Panorama Geral",
  "Histórico",
  "Quadro Operacional",
  "Resumo pós-operação",
  "Filtros e estatísticas",
];

type Pendente = {
  titulo: string;
  atual: string;
  novo: string;
  registros: number;
  run: () => Promise<void>;
};

/**
 * Gerenciador das categorias GLOBAIS de missão: criar, renomear, mesclar,
 * desativar e ajustar manualmente o agrupamento de missões.
 * Toda alteração mostra o impacto antes de confirmar e é registrada no log.
 */
export function CategoriaMissaoManager({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const { data: categories } = useMissionCategories();
  const { data: overrides } = useMissionOverrides();
  const { data: flights } = useAllAnnotatorFlights();

  const resolver = useMemo(() => makeResolver(categories, overrides), [categories, overrides]);
  const autor = { id: profile?.id, tag: displayName(profile) };

  const [nova, setNova] = useState({ key: "", label: "", cor: "#1d4ed8" });
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState({ key: "", label: "", cor: "" });
  const [merge, setMerge] = useState({ de: "", para: "" });
  const [ajuste, setAjuste] = useState({ missao: "", categoria: "" });
  const [pendente, setPendente] = useState<Pendente | null>(null);

  /** Missões reais lançadas na planilha, agrupadas por categoria atual. */
  const missoesPorCategoria = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const f of flights ?? []) {
      const { base } = parseMissao(f.missao);
      if (!base) continue;
      const key = resolver.of(f.missao);
      if (!map.has(key)) map.set(key, new Map());
      const inner = map.get(key)!;
      inner.set(base, (inner.get(base) ?? 0) + 1);
    }
    return map;
  }, [flights, resolver]);

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["mission_categories"] });
    await qc.invalidateQueries({ queryKey: ["mission_category_overrides"] });
  };

  function confirmar(p: Pendente) {
    setPendente(p);
  }

  async function criar() {
    const key = normalizeCategoryKey(nova.key);
    if (!key) return;
    const similar = findSimilar(categories ?? [], (c) => c.key, key);
    if (similar) {
      const ok = window.confirm(
        `Já existe uma categoria semelhante ("${similar.key}"). Deseja realmente criar uma nova?`,
      );
      if (!ok) return;
    }
    confirmar({
      titulo: "Criar categoria de missão",
      atual: "—",
      novo: key,
      registros: 0,
      run: async () => {
        const { data, error } = await supabase
          .from("mission_categories")
          .insert({
            key,
            label: nova.label.trim() || key,
            cor: nova.cor,
            sort_order: (categories?.length ?? 0) + 1,
          })
          .select()
          .single();
        if (error) throw new Error(error.message);
        await logChange(
          {
            area: "CONFIGURACOES",
            entity: "mission_categories",
            entityId: data.id,
            entityLabel: key,
            action: "INSERT",
            newValue: key,
          },
          autor,
        );
        setNova({ key: "", label: "", cor: "#1d4ed8" });
      },
    });
  }

  async function renomear(cat: { id: string; key: string; label: string }) {
    const key = normalizeCategoryKey(rascunho.key);
    if (!key) return;
    const registros = missoesPorCategoria.get(normalizeCategoryKey(cat.key))
      ? [...missoesPorCategoria.get(normalizeCategoryKey(cat.key))!.values()].reduce(
          (a, b) => a + b,
          0,
        )
      : 0;
    confirmar({
      titulo: "Renomear categoria de missão",
      atual: `${cat.key} — ${cat.label}`,
      novo: `${key} — ${rascunho.label.trim() || key}`,
      registros,
      run: async () => {
        const { error } = await supabase
          .from("mission_categories")
          .update({ key, label: rascunho.label.trim() || key, cor: rascunho.cor } as never)
          .eq("id", cat.id);
        if (error) throw new Error(error.message);
        if (key !== normalizeCategoryKey(cat.key)) {
          await supabase
            .from("mission_category_overrides")
            .update({ category_key: key } as never)
            .eq("category_key", normalizeCategoryKey(cat.key));
        }
        await logChange(
          {
            area: "CONFIGURACOES",
            entity: "mission_categories",
            entityId: cat.id,
            entityLabel: key,
            action: "UPDATE",
            field: "key",
            oldValue: cat.key,
            newValue: key,
          },
          autor,
        );
        setEditando(null);
      },
    });
  }

  async function alternar(cat: { id: string; key: string; active: boolean }) {
    const { error } = await supabase
      .from("mission_categories")
      .update({ active: !cat.active } as never)
      .eq("id", cat.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logChange(
      {
        area: "CONFIGURACOES",
        entity: "mission_categories",
        entityId: cat.id,
        entityLabel: cat.key,
        action: "UPDATE",
        field: "active",
        oldValue: cat.active ? "Ativa" : "Desativada",
        newValue: cat.active ? "Desativada" : "Ativa",
      },
      autor,
    );
    await invalidate();
  }

  async function mesclar() {
    const de = normalizeCategoryKey(merge.de);
    const para = normalizeCategoryKey(merge.para);
    if (!de || !para || de === para) {
      toast.error("Selecione duas categorias diferentes.");
      return;
    }
    const bases = [...(missoesPorCategoria.get(de)?.keys() ?? [])];
    const registros = [...(missoesPorCategoria.get(de)?.values() ?? [])].reduce((a, b) => a + b, 0);
    confirmar({
      titulo: "Mesclar categorias de missão",
      atual: de,
      novo: para,
      registros,
      run: async () => {
        // As missões individuais são preservadas: muda apenas a categoria-base.
        for (const base of bases) {
          const { error } = await supabase
            .from("mission_category_overrides")
            .upsert({ missao_base: base, category_key: para }, { onConflict: "missao_base" });
          if (error) throw new Error(error.message);
        }
        await supabase
          .from("mission_category_overrides")
          .update({ category_key: para } as never)
          .eq("category_key", de);
        const origem = (categories ?? []).find((c) => normalizeCategoryKey(c.key) === de);
        if (origem && de !== CATEGORIA_FALLBACK) {
          await supabase
            .from("mission_categories")
            .update({ active: false } as never)
            .eq("id", origem.id);
        }
        await logChange(
          {
            area: "CONFIGURACOES",
            entity: "mission_categories",
            entityId: origem?.id ?? de,
            entityLabel: de,
            action: "UPDATE",
            field: "merge",
            oldValue: de,
            newValue: para,
            details: { missoes: bases, registros },
          },
          autor,
        );
        setMerge({ de: "", para: "" });
      },
    });
  }

  async function ajustarMissao() {
    const base = normalizeCategoryKey(ajuste.missao);
    const cat = normalizeCategoryKey(ajuste.categoria);
    if (!base || !cat) return;
    const { error } = await supabase
      .from("mission_category_overrides")
      .upsert({ missao_base: base, category_key: cat }, { onConflict: "missao_base" });
    if (error) {
      toast.error(error.message);
      return;
    }
    await logChange(
      {
        area: "CONFIGURACOES",
        entity: "mission_category_overrides",
        entityId: base,
        entityLabel: base,
        action: "UPDATE",
        field: "categoria",
        oldValue: resolver.of(base),
        newValue: cat,
      },
      autor,
    );
    setAjuste({ missao: "", categoria: "" });
    await invalidate();
    toast.success(`${base} agrupada em ${cat}.`);
  }

  const opcoes = (categories ?? []).map((c) => ({
    value: normalizeCategoryKey(c.key),
    label: `${c.key} — ${c.label}`,
    cor: c.cor,
  }));

  const basesConhecidas = useMemo(() => {
    const set = new Set<string>();
    for (const inner of missoesPorCategoria.values()) for (const b of inner.keys()) set.add(b);
    return [...set].sort();
  }, [missoesPorCategoria]);

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
            Categorias de missão (global)
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Usadas no Panorama, Histórico, Quadro Operacional, Resumo pós-operação e estatísticas.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {canEdit && (
            <div className="flex flex-wrap items-end gap-2">
              <Input
                value={nova.key}
                placeholder="Sigla (ex.: VT)"
                className="w-32 font-mono uppercase"
                onChange={(e) => setNova({ ...nova, key: e.target.value })}
              />
              <Input
                value={nova.label}
                placeholder="Nome (ex.: Voo de travessia)"
                className="w-56"
                onChange={(e) => setNova({ ...nova, label: e.target.value })}
              />
              <input
                type="color"
                aria-label="Cor da categoria"
                value={nova.cor}
                onChange={(e) => setNova({ ...nova, cor: e.target.value })}
                className="h-9 w-12 rounded border border-input bg-background"
              />
              <Button size="sm" onClick={criar}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Criar categoria
              </Button>
            </div>
          )}

          <ul className="divide-y divide-border/60 rounded border border-border">
            {(categories ?? []).map((c) => {
              const key = normalizeCategoryKey(c.key);
              const total = [...(missoesPorCategoria.get(key)?.values() ?? [])].reduce(
                (a, b) => a + b,
                0,
              );
              const emEdicao = editando === c.id;
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-2 p-2 text-sm">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: c.cor }}
                  />
                  {emEdicao ? (
                    <>
                      <Input
                        value={rascunho.key}
                        className="h-8 w-28 font-mono uppercase"
                        onChange={(e) => setRascunho({ ...rascunho, key: e.target.value })}
                      />
                      <Input
                        value={rascunho.label}
                        className="h-8 w-52"
                        onChange={(e) => setRascunho({ ...rascunho, label: e.target.value })}
                      />
                      <input
                        type="color"
                        aria-label="Cor"
                        value={rascunho.cor || "#475569"}
                        onChange={(e) => setRascunho({ ...rascunho, cor: e.target.value })}
                        className="h-8 w-12 rounded border border-input bg-background"
                      />
                      <Button size="sm" variant="outline" onClick={() => renomear(c)}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditando(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="font-mono font-bold">{c.key}</span>
                      <span className="truncate text-muted-foreground">{c.label}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {total} lançamento(s)
                      </span>
                      {!c.active && <StatusBadge tone="neutral">Desativada</StatusBadge>}
                      {canEdit && (
                        <div className="ml-auto flex items-center gap-1">
                          <button
                            type="button"
                            aria-label="Editar categoria"
                            onClick={() => {
                              setEditando(c.id);
                              setRascunho({ key: c.key, label: c.label, cor: c.cor });
                            }}
                            className="grid h-8 w-8 place-items-center rounded hover:bg-muted"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={c.active ? "Desativar" : "Reativar"}
                            onClick={() => alternar(c)}
                            className="grid h-8 w-8 place-items-center rounded hover:bg-muted"
                          >
                            <Power className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>

          {canEdit && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 rounded border border-border p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Mesclar categorias
                </p>
                <ComboCreate
                  value={merge.de}
                  options={opcoes}
                  placeholder="Categoria de origem"
                  onSelect={(v) => setMerge({ ...merge, de: v })}
                />
                <ComboCreate
                  value={merge.para}
                  options={opcoes}
                  placeholder="Categoria de destino"
                  onSelect={(v) => setMerge({ ...merge, para: v })}
                />
                <Button size="sm" variant="outline" onClick={mesclar}>
                  <Merge className="mr-1 h-3.5 w-3.5" /> Mesclar
                </Button>
              </div>

              <div className="space-y-2 rounded border border-border p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Agrupamento manual de missão
                </p>
                <ComboCreate
                  value={ajuste.missao}
                  options={basesConhecidas.map((b) => ({ value: b }))}
                  placeholder="Missão (ex.: AP-X1)"
                  allowCreate
                  onSelect={(v) => setAjuste({ ...ajuste, missao: v })}
                  onCreate={(v) => setAjuste({ ...ajuste, missao: normalizeCategoryKey(v) })}
                />
                <ComboCreate
                  value={ajuste.categoria}
                  options={opcoes}
                  placeholder="Categoria"
                  onSelect={(v) => setAjuste({ ...ajuste, categoria: v })}
                />
                <Button size="sm" variant="outline" onClick={ajustarMissao}>
                  Aplicar agrupamento
                </Button>
              </div>
            </div>
          )}

          {!!(overrides ?? []).length && (
            <div className="rounded border border-border p-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Agrupamentos manuais ativos
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(overrides ?? []).map((o) => (
                  <span
                    key={o.id}
                    className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px]"
                  >
                    {o.missao_base} → {o.category_key}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!pendente} onOpenChange={(o) => !o && setPendente(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar alteração</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p className="font-semibold text-foreground">{pendente?.titulo}</p>
                <p>
                  Categoria atual: <span className="font-mono">{pendente?.atual}</span>
                </p>
                <p>
                  Nova categoria: <span className="font-mono">{pendente?.novo}</span>
                </p>
                <p>
                  Registros afetados:{" "}
                  <span className="font-mono">{pendente?.registros ?? 0}</span>
                </p>
                <p>Esta alteração poderá afetar:</p>
                <ul className="list-disc pl-5">
                  {AREAS_IMPACTADAS.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const p = pendente;
                setPendente(null);
                if (!p) return;
                try {
                  await p.run();
                  await invalidate();
                  toast.success("Alteração aplicada.");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Falha ao aplicar.");
                }
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
}
