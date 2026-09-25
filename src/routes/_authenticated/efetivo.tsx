import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProfiles, useDiretorias, useFases, useCurrentSquadrons } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { usePermissoes } from "@/lib/permissoes";
import { logChange } from "@/lib/audit";
import { ComboCreate } from "@/components/ComboCreate";
import { findSimilar, useOperationalLevels } from "@/lib/categorias";
import { cn } from "@/lib/utils";
import {
  minutesToHours,
  hoursToMinutes,
  CARGOS,
  NIVEIS_OPERACIONAIS,
  OPR_OPTIONS,
  normalizeTri,

} from "@/lib/evv";

export const Route = createFileRoute("/_authenticated/efetivo")({
  head: () => ({
    meta: [
      { title: "Efetivo — EVV" },
      {
        name: "description",
        content:
          "Cadastro único do efetivo do voo a vela: esquadrão, posto, fase, horas de voo, qualificações e diretoria.",
      },
      { property: "og:title", content: "Efetivo — EVV" },
      {
        property: "og:description",
        content: "Esquadrões, fases, horas de voo e diretoria do voo a vela em um cadastro único.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EfetivoPage,
});

const SEM_ESQUADRAO = "Sem esquadrão";
/** Radix Select não aceita valor "" — usamos um sentinela e gravamos "" no banco. */
const NONE = "__none__";
const META_PREFIX = "gaivotometro:meta:";
type GaivotometroMeta = { profile_id: string; publicado: boolean; titulos: string; formado_em: string; foto_x: number; foto_y: number; foto_zoom: number };

async function listGaivotometroMeta(): Promise<GaivotometroMeta[]> {
  const { data, error } = await supabase.from("app_settings").select("key,value").like("key", `${META_PREFIX}%`);
  if (error) throw error;
  return (data ?? []).flatMap((row) => {
    try {
      const parsed = JSON.parse(row.value ?? "{}");
      return [{ profile_id: row.key.slice(META_PREFIX.length), publicado: Boolean(parsed.publicado), titulos: String(parsed.titulos ?? ""), formado_em: String(parsed.formado_em ?? ""), foto_x: Number(parsed.foto_x) || 0, foto_y: Number(parsed.foto_y) || 0, foto_zoom: Math.max(1, Number(parsed.foto_zoom) || 1) }];
    } catch {
      return [];
    }
  });
}

async function saveGaivotometroMeta(data: GaivotometroMeta) {
  const normalized = { ...data, publicado: true, titulos: data.titulos.trim() };
  const { error } = await supabase.from("app_settings").upsert(
    { key: `${META_PREFIX}${data.profile_id}`, value: JSON.stringify(normalized) },
    { onConflict: "key" },
  );
  if (error) throw error;
  return normalized;
}

function EfetivoPage() {
  const qc = useQueryClient();
  const { profile, isAdmin } = useAuth();
  const { canManageOps } = usePermissoes();
  const { data: profiles, isLoading } = useProfiles();
  const { data: currentSquadrons } = useCurrentSquadrons();
  const { data: niveis } = useOperationalLevels();
  const { data: diretorias } = useDiretorias();
  const { data: fases } = useFases();
  const { data: gaivotometroMeta } = useQuery({
    queryKey: ["gaivotometro-meta"],
    queryFn: () => listGaivotometroMeta(),
  });
  const [search, setSearch] = useState("");
  const [novaDiretoria, setNovaDiretoria] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const diretoriaNames = (diretorias ?? []).map((d) => d.nome);

  async function update(id: string, patch: Record<string, unknown>) {
    if (!isAdmin && id !== profile?.id) {
      toast.error("Somente o administrador pode editar o cadastro de outro integrante.");
      return;
    }
    const { error } = await supabase.from("profiles").update(patch as never).eq("id", id);
    if (error) {
      toast.error("Não foi possível salvar: " + error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["profiles"] });
    toast.success("Salvo.");
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const active = (profiles ?? []).filter((p) => p.status === "ATIVO");
    if (!q) return active;
    return active.filter((p) =>
      [p.war_name, p.full_name, p.gaivota, p.nivel_operacional, p.esquadrao, p.cargo, p.fase]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [profiles, search]);

  const byEsquadrao = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const p of filtered) {
      const key = p.esquadrao?.trim() || SEM_ESQUADRAO;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return map;
  }, [filtered]);

  const esquadroes = useMemo(
    () => [...byEsquadrao.keys()].sort((a, b) => {
      if (a === SEM_ESQUADRAO) return 1;
      if (b === SEM_ESQUADRAO) return -1;
      const ai = currentSquadrons.indexOf(a);
      const bi = currentSquadrons.indexOf(b);
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      return a.localeCompare(b);
    }),
    [byEsquadrao, currentSquadrons],
  );

  async function updateGaivotometro(profileId: string, patch: { titulos?: string }) {
    const current = gaivotometroMeta?.find((meta) => meta.profile_id === profileId);
    try {
      await saveGaivotometroMeta({
        profile_id: profileId,
        publicado: true,
        titulos: patch.titulos ?? current?.titulos ?? "",
        formado_em: current?.formado_em ?? new Date().toISOString().slice(0, 10),
        foto_x: current?.foto_x ?? 0,
        foto_y: current?.foto_y ?? 0,
        foto_zoom: current?.foto_zoom ?? 1,
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["gaivotometro-meta"] }),
        qc.invalidateQueries({ queryKey: ["profiles"] }),
        qc.invalidateQueries({ queryKey: ["profiles", "ativos"] }),
      ]);
      toast.success("Títulos atualizados.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível atualizar o Gaivotômetro.");
    }
  }

  async function addDiretoria() {
    const nome = novaDiretoria.trim();
    if (!nome) return;
    const { error } = await supabase
      .from("diretorias")
      .insert({ nome, sort_order: (diretorias?.length ?? 0) + 1 });
    if (error) {
      toast.error(error.message);
      return;
    }
    setNovaDiretoria("");
    await qc.invalidateQueries({ queryKey: ["diretorias"] });
  }

  async function removeDiretoria(id: string) {
    const { error } = await supabase.from("diretorias").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["diretorias"] });
  }

  return (
    <>
      <PageHeader
        title="Efetivo"
        description="Cadastro único do integrante — usado em Disponibilidade, Panorama e Escala"
        actions={
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Pesquisar militar"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        }
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <Tabs defaultValue="esquadroes">
          <TabsList className="mb-4">
            <TabsTrigger value="esquadroes">Esquadrões</TabsTrigger>
            <TabsTrigger value="diretoria">Diretoria</TabsTrigger>
          </TabsList>

          <TabsContent value="esquadroes" className="space-y-5">
            {esquadroes.map((esq) => {
              const people = byEsquadrao.get(esq) ?? [];
              if (people.length === 0) return null;
              return (
                <section key={esq}>
                  <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-aviation">
                    {esq === SEM_ESQUADRAO ? esq : currentSquadrons.includes(esq) ? `${currentSquadrons.indexOf(esq) + 1}º Esquadrão` : esq} · {people.length}
                  </h2>
                  <Card>
                    <CardContent className="overflow-x-auto p-0">
                      <table className="w-full min-w-[62rem] text-sm">
                        <thead className="border-b border-border bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
                          <tr>
                            <th className="px-2 py-2 text-left">Nível</th>
                            <th className="px-2 py-2 text-left">Nome de guerra</th>
                            <th className="px-2 py-2 text-left">TRI</th>
                            <th className="px-2 py-2 text-left">Gaivota</th>
                            <th className="px-2 py-2 text-left">Fase</th>
                            <th className="px-2 py-2 text-left">Horas</th>
                            <th className="px-2 py-2 text-left">Missão</th>
                            <th className="px-2 py-2 text-left">Próxima</th>
                            <th className="px-2 py-2 text-left">OPS</th>
                            <th className="px-2 py-2 text-left">PSO</th>
                            <th className="px-2 py-2 text-left" />
                          </tr>
                        </thead>
                        <tbody>
                          {people.map((p) => (
                            <Fragment key={p.id}>
                              <tr className="border-b border-border/60">
                                <td className="px-1 py-1">
                                  <Select
                                    value={p.nivel_operacional || NONE}
                                    onValueChange={(v) => update(p.id, { nivel_operacional: v === NONE ? "" : v })}
                                  >
                                    <SelectTrigger className="h-8 border-transparent bg-transparent px-2 focus:border-input">
                                      <SelectValue placeholder="—" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value={NONE}>—</SelectItem>
                                      {NIVEIS_OPERACIONAIS.map((nivel) => (
                                        <SelectItem key={nivel.value} value={nivel.value}>{nivel.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </td>
                                <td className="px-1 py-1">
                                  <CellInput
                                    defaultValue={p.war_name}
                                    onCommit={(v) => update(p.id, { war_name: v })}
                                  />
                                </td>
                                <td className="px-1 py-1 w-16">
                                  <CellInput
                                    className="uppercase"
                                    defaultValue={p.tri}
                                    onCommit={(v) => update(p.id, { tri: normalizeTri(v) })}
                                  />
                                </td>
                                <td className="px-1 py-1 w-20">
                                  <CellInput
                                    defaultValue={p.gaivota}
                                    onCommit={(v) => update(p.id, { gaivota: v })}
                                  />
                                </td>
                                <td className="px-1 py-1">
                                  <CompactSelect
                                    value={p.fase || NONE}
                                    onChange={(v) => update(p.id, { fase: v === NONE ? "" : v })}
                                    options={(fases ?? []).map((f) => f.nome)}
                                    noneLabel="Sem fase"
                                  />
                                </td>
                                <td className="px-1 py-1 w-20">
                                  <CellInput
                                    defaultValue={minutesToHours(p.flight_minutes)}
                                    onCommit={(v) =>
                                      update(p.id, { flight_minutes: hoursToMinutes(v) })
                                    }
                                  />
                                </td>
                                <td className="px-1 py-1 w-24">
                                  <CellInput
                                    defaultValue={p.missao}
                                    onCommit={(v) => update(p.id, { missao: v })}
                                  />
                                </td>
                                <td className="px-1 py-1 w-24">
                                  <CellInput
                                    defaultValue={p.proxima_missao}
                                    onCommit={(v) => update(p.id, { proxima_missao: v })}
                                  />
                                </td>
                                <td className="px-1 py-1 w-14">
                                  <CellInput
                                    defaultValue={String(p.ops)}
                                    onCommit={(v) => update(p.id, { ops: Number(v) || 0 })}
                                  />
                                </td>
                                <td className="px-1 py-1 w-14">
                                  <CellInput
                                    defaultValue={String(p.pso)}
                                    onCommit={(v) => update(p.id, { pso: Number(v) || 0 })}
                                  />
                                </td>
                                <td className="px-1 py-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpanded((e) => ({ ...e, [p.id]: !e[p.id] }))
                                    }
                                    className="rounded px-2 py-1 text-[11px] uppercase tracking-wider text-aviation hover:bg-muted"
                                  >
                                    {expanded[p.id] ? "Fechar" : "Detalhes"}
                                  </button>
                                </td>
                              </tr>
                              {expanded[p.id] && (
                                <tr className="border-b border-border/60 bg-muted/30">
                                  <td colSpan={11} className="p-3">
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                      <Field label="Nome completo">
                                        <Input
                                          defaultValue={p.full_name}
                                          onBlur={(e) => update(p.id, { full_name: e.target.value })}
                                        />
                                      </Field>
                                      <Field label="Nome do esquadrão">
                                        <Select
                                          value={p.esquadrao || "__none__"}
                                          onValueChange={(value) => update(p.id, { esquadrao: value === "__none__" ? "" : value })}
                                        >
                                          <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="__none__">Não informado</SelectItem>
                                            {currentSquadrons.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                                          </SelectContent>
                                        </Select>
                                      </Field>
                                      <Field label="Nível operacional">
                                        <ComboCreate
                                          value={p.nivel_operacional}
                                          options={(niveis ?? []).map((n) => ({ value: n.nome, label: n.nome }))}
                                          placeholder="Selecionar"
                                          allowCreate={canManageOps}
                                          onSelect={(v) => update(p.id, { nivel_operacional: v })}
                                          onCreate={async (label) => {
                                            const nome = label.trim();
                                            if (!nome) return;
                                            const similar = findSimilar(niveis ?? [], (n) => n.nome, nome);
                                            if (similar && similar.nome !== nome) {
                                              if (!window.confirm(`Já existe um nível semelhante ("${similar.nome}"). Deseja realmente criar um novo?`)) return;
                                            } else if (similar) {
                                              return;
                                            }
                                            const { data, error } = await supabase
                                              .from("operational_levels")
                                              .insert({ nome, sort_order: (niveis?.length ?? 0) + 1 } as never)
                                              .select()
                                              .single();
                                            if (error) return;
                                            await logChange(
                                              {
                                                area: "CONFIGURACOES",
                                                entity: "operational_levels",
                                                entityId: (data as { id: string }).id,
                                                entityLabel: nome,
                                                action: "INSERT",
                                                newValue: nome,
                                              },
                                              { id: profile?.id, tag: profile?.war_name || profile?.full_name },
                                            );
                                            await update(p.id, { nivel_operacional: nome });
                                          }}
                                        />
                                      </Field>
                                      <OprField
                                        label="OPR DG"
                                        value={p.opr_dg}
                                        onChange={(v) => update(p.id, { opr_dg: v })}
                                      />
                                      <OprField
                                        label="OPR DUO"
                                        value={p.opr_duo}
                                        onChange={(v) => update(p.id, { opr_duo: v })}
                                      />
                                      <OprField
                                        label="OPR CS"
                                        value={p.opr_cs}
                                        onChange={(v) => update(p.id, { opr_cs: v })}
                                      />
                                      <div className="sm:col-span-2">
                                        <Field label="Observação">
                                          <Input
                                            defaultValue={p.observacao}
                                            onBlur={(e) =>
                                              update(p.id, { observacao: e.target.value })
                                            }
                                          />
                                        </Field>
                                      </div>
                                      {canManageOps && (
                                        <div className="rounded-xl border border-border bg-card p-3 sm:col-span-2 lg:col-span-4">
                                          <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div>
                                              <p className="text-sm font-semibold">Gaivotômetro</p>
                                              <p className="text-xs text-muted-foreground">Todos os integrantes aparecem na galeria. Use este campo para registrar títulos e destaques.</p>
                                            </div>
                                          </div>
                                          <div className="mt-3">
                                            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Títulos e destaques</Label>
                                            <Input
                                              className="mt-1"
                                              key={gaivotometroMeta?.find((meta) => meta.profile_id === p.id)?.titulos ?? ""}
                                              defaultValue={gaivotometroMeta?.find((meta) => meta.profile_id === p.id)?.titulos ?? ""}
                                              placeholder="Ex.: Instrutor, recordista de horas, Diretor de Operações"
                                              onBlur={(e) => void updateGaivotometro(p.id, { titulos: e.target.value })}
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                </section>
              );
            })}
            {filtered.length === 0 && (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum militar encontrado.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="diretoria" className="space-y-5">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
                  Diretorias cadastradas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {(diretorias ?? []).map((d) => (
                    <span
                      key={d.id}
                      className="flex items-center gap-1 rounded border border-border px-2 py-1 text-sm"
                    >
                      {d.nome}
                      <button
                        type="button"
                        aria-label={`Remover ${d.nome}`}
                        onClick={() => removeDiretoria(d.id)}
                        className="text-danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Nova diretoria (ex.: Operações)"
                    value={novaDiretoria}
                    onChange={(e) => setNovaDiretoria(e.target.value)}
                    className="max-w-xs"
                  />
                  <Button size="sm" onClick={addDiretoria}>
                    <Plus className="mr-1.5 h-4 w-4" /> Adicionar
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              {filtered.map((p) => (
                <Card key={p.id}>
                  <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Militar">
                      <Input readOnly value={p.war_name || p.full_name} />
                    </Field>
                    <Field label="Cargo no Voo a Vela">
                      <Select
                        value={p.cargo || NONE}
                        onValueChange={(v) =>
                          update(
                            p.id,
                            v === NONE
                              ? { cargo: "", diretoria: "" }
                              : v === "Presidente"
                                ? { cargo: v, diretoria: "" }
                                : { cargo: v },
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sem cargo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Sem cargo</SelectItem>
                          {CARGOS.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Diretoria">
                      {p.cargo === "Diretor" || p.cargo === "Assessor" ? (
                        <Select
                          value={p.diretoria || NONE}
                          onValueChange={(v) =>
                            update(p.id, { diretoria: v === NONE ? "" : v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Nenhuma" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>Nenhuma</SelectItem>
                            {diretoriaNames.map((d) => (
                              <SelectItem key={d} value={d}>
                                {d}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          readOnly
                          value={
                            p.cargo === "Presidente"
                              ? "Presidência (sem diretoria)"
                              : "Selecione um cargo"
                          }
                        />
                      )}
                    </Field>
                    <Field label="Gaivota (nº)">
                      <Input
                        defaultValue={p.gaivota}
                        onBlur={(e) => update(p.id, { gaivota: e.target.value })}
                      />
                    </Field>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </>
  );
}

function OprField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
        <SelectTrigger>
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>—</SelectItem>
          {OPR_OPTIONS.filter(Boolean).map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function CellInput({
  defaultValue,
  onCommit,
  className,
}: {
  defaultValue: string;
  onCommit: (value: string) => void;
  className?: string;
}) {
  return (
    <Input
      defaultValue={defaultValue}
      onBlur={(e) => {
        if (e.target.value !== defaultValue) onCommit(e.target.value);
      }}
      className={cn("h-8 border-transparent bg-transparent px-2 focus:border-input", className)}
    />
  );
}

function CompactSelect({
  value,
  onChange,
  options,
  noneLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  noneLabel: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 border-transparent bg-transparent px-2 focus:border-input">
        <SelectValue placeholder={noneLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{noneLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
