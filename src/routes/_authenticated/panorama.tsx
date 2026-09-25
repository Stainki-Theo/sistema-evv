import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, ChevronDown, ChevronRight } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { PhotoAvatar } from "@/components/PhotoAvatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useProfiles,
  useWeeks,
  useAvailability,
  useAllAnnotatorFlights,
  useAllDuties,
  useAircraft,
} from "@/lib/data";
import {
  statsPorPessoa,
  servicosPorPessoa,
  type PessoaStats,
  type ServicoStats,
} from "@/lib/estatisticas";
import { useAuth } from "@/lib/auth";
import { usePermissoes } from "@/lib/permissoes";
import { operationalLevelLabel, useCategoriaResolver, useOperationalLevels, resumirMissoes } from "@/lib/categorias";
import { MissoesResumo } from "@/components/MissoesResumo";
import { CategoriaMissaoManager } from "@/components/admin/CategoriaMissaoManager";
import {
  AVAIL,
  ESQUADROES,
  minutesToClock,
  saturdayOf,
  shortDate,
  todayISO,
  personTag,
  formatDatePtBr,
  flightDuration,
} from "@/lib/evv";

export const Route = createFileRoute("/_authenticated/panorama")({
  head: () => ({
    meta: [
      { title: "Panorama Geral — EVV" },
      {
        name: "description",
        content:
          "Situação operacional do efetivo do voo a vela: esquadrão, nível operacional, missão, horas de voo, OPS, pousos, serviços e confirmação semanal.",
      },
      { property: "og:title", content: "Panorama Geral — EVV" },
      {
        property: "og:description",
        content: "Panorama operacional do esquadrão de voo a vela em uma única tela.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PanoramaPage,
});

const SORTS = [
  { key: "nome", label: "Nome" },
  { key: "esquadrao", label: "Esquadrão" },
  { key: "nivel", label: "Nível operacional" },
  { key: "horas", label: "Horas de voo" },
  { key: "ops", label: "OPS" },
  { key: "pousos", label: "Pousos" },
  { key: "servicos", label: "Serviços" },
];

const VAZIO: PessoaStats = {
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

function PanoramaPage() {
  const qc = useQueryClient();
  const { profile, isAdmin } = useAuth();
  const { canManageOps } = usePermissoes();
  const resolver = useCategoriaResolver();
  const [mostrarGerenciador, setMostrarGerenciador] = useState(false);
  const { data: profiles } = useProfiles();
  const { data: niveis } = useOperationalLevels();
  const { data: weeks } = useWeeks();
  const { data: flights } = useAllAnnotatorFlights();
  const { data: aircraft } = useAircraft();
  const { data: duties } = useAllDuties();
  const weekStart = saturdayOf(todayISO());
  const week = (weeks ?? []).find((w) => w.week_start === weekStart);
  const { data: entries } = useAvailability(week?.id);

  const [search, setSearch] = useState("");
  const [esq, setEsq] = useState("TODOS");
  const [nivel, setNivel] = useState("TODOS");
  const [conf, setConf] = useState("TODOS");
  const [sort, setSort] = useState("nome");
  const [aberto, setAberto] = useState<Record<string, boolean>>({});
  const [frotaMode, setFrotaMode] = useState("AERONAVE");
  const [frotaFrom, setFrotaFrom] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [frotaTo, setFrotaTo] = useState(todayISO());

  /** OPS, pousos, horas e categorias vêm da planilha do Anotador — nada é digitado. */
  const stats = useMemo(
    () => statsPorPessoa(flights, profiles, resolver.of),
    [flights, profiles, resolver],
  );
  const servicos = useMemo(() => servicosPorPessoa(duties, profiles), [duties, profiles]);
  const statsDe = (id: string) => stats.get(id) ?? VAZIO;
  const servicoDe = (id: string): ServicoStats =>
    servicos.get(id) ?? { total: 0, porFuncao: {}, ultimaOperacao: "" };

  const days = useMemo(() => {
    const stored = (week?.days ?? []) as string[];
    return stored.length ? [...stored].sort() : [];
  }, [week?.id]);

  function respondeu(profileId: string) {
    return (entries ?? []).some((e) => e.profile_id === profileId && e.status !== AVAIL.NONE);
  }

  const total = (profiles ?? []).length;
  const responderam = (profiles ?? []).filter((p) => respondeu(p.id)).length;
  const dayCount = (day: string) =>
    (entries ?? []).filter((e) => e.op_date === day && e.status === AVAIL.YES).length;

  async function update(id: string, patch: Record<string, unknown>) {
    if (!isAdmin && id !== profile?.id) {
      toast.error("Somente o administrador pode editar o cadastro de outro integrante.");
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update(patch as never)
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["profiles"] });
  }

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (profiles ?? []).filter((p) => {
      if (q && ![p.war_name, p.full_name].join(" ").toLowerCase().includes(q)) return false;
      if (esq !== "TODOS" && p.esquadrao !== esq) return false;
      if (nivel !== "TODOS" && p.nivel_operacional !== nivel) return false;
      if (conf === "CONFIRMADOS" && !respondeu(p.id)) return false;
      if (conf === "PENDENTES" && respondeu(p.id)) return false;
      return true;
    });
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sort) {
        case "esquadrao":
          return (a.esquadrao || "").localeCompare(b.esquadrao || "");
        case "nivel":
          return operationalLevelLabel(a.nivel_operacional).localeCompare(operationalLevelLabel(b.nivel_operacional));
        case "horas":
          return (b.flight_minutes ?? 0) - (a.flight_minutes ?? 0);
        case "ops":
          return statsDe(b.id).ops - statsDe(a.id).ops;
        case "pousos":
          return statsDe(b.id).pousos - statsDe(a.id).pousos;
        case "servicos":
          return servicoDe(b.id).total - servicoDe(a.id).total;
        default:
          return (a.war_name || a.full_name || "").localeCompare(b.war_name || b.full_name || "");
      }
    });
    return sorted;
  }, [profiles, entries, search, esq, nivel, conf, sort, stats, servicos]);

  /** Resumo do esquadrão por categoria de missão (pousos realizados). */
  const resumoMissoes = useMemo(() => {
    const todas: string[] = [];
    for (const p of rows) todas.push(...statsDe(p.id).missoes);
    return resumirMissoes(todas, resolver);
  }, [rows, stats, resolver]);

  const frotaStats = useMemo(() => {
    const modelos = new Map(
      (aircraft ?? []).map((a) => [
        a.identificacao.toUpperCase(),
        a.modelo || "Modelo não informado",
      ]),
    );
    const totals = new Map<string, number>();
    for (const f of flights ?? []) {
      if (f.op_date < frotaFrom || f.op_date > frotaTo) continue;
      const matricula = (f.aeronave || "Não informada").trim();
      const key =
        frotaMode === "MODELO"
          ? (modelos.get(matricula.toUpperCase()) ?? "Modelo não informado")
          : matricula;
      const minutes = flightDuration(f.dep_time, f.land_time).minutes;
      if (minutes) totals.set(key, (totals.get(key) ?? 0) + minutes);
    }
    return [...totals.entries()]
      .map(([nome, minutos]) => ({ nome, minutos, horas: Number((minutos / 60).toFixed(1)) }))
      .sort((a, b) => b.minutos - a.minutos);
  }, [aircraft, flights, frotaFrom, frotaTo, frotaMode]);

  const frotaMensal = useMemo(() => {
    const totals = new Map<string, number>();
    for (const f of flights ?? []) {
      if (f.op_date < frotaFrom || f.op_date > frotaTo) continue;
      const month = f.op_date.slice(0, 7);
      const minutes = flightDuration(f.dep_time, f.land_time).minutes;
      if (minutes) totals.set(month, (totals.get(month) ?? 0) + minutes);
    }
    return [...totals.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, minutes]) => ({
        mes: `${month.slice(5, 7)}/${month.slice(0, 4)}`,
        horas: Number((minutes / 60).toFixed(1)),
      }));
  }, [flights, frotaFrom, frotaTo]);

  return (
    <>
      <PageHeader
        title="Panorama Geral"
        description={`Situação operacional do efetivo — semana ${shortDate(weekStart)}`}
      />

      {/* Indicadores */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Indicator label="Efetivo" value={total} />
        <Indicator label="Responderam" value={responderam} tone="success" />
        <Indicator label="Pendentes" value={total - responderam} tone="warning" />
        <Indicator
          label={days[0] ? `Disponíveis ${shortDate(days[0])}` : "Disponíveis sábado"}
          value={days[0] ? dayCount(days[0]) : 0}
        />
        <Indicator
          label={days[1] ? `Disponíveis ${shortDate(days[1])}` : "Disponíveis domingo"}
          value={days[1] ? dayCount(days[1]) : 0}
        />
      </div>

      <Card className="mb-5">
        <CardHeader className="gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Controle estatístico da frota</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Horas consolidadas das operações encerradas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={frotaMode} onValueChange={setFrotaMode}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AERONAVE">Por aeronave</SelectItem>
                <SelectItem value="MODELO">Por modelo</SelectItem>
              </SelectContent>
            </Select>
            <Input
              className="w-40"
              type="date"
              value={frotaFrom}
              onChange={(e) => setFrotaFrom(e.target.value)}
            />
            <Input
              className="w-40"
              type="date"
              value={frotaTo}
              onChange={(e) => setFrotaTo(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {frotaStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum voo encerrado no período.</p>
          ) : (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(18rem,.8fr)]">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={frotaStats}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="nome" />
                    <YAxis unit="h" />
                    <Tooltip formatter={(v) => `${Number(v).toLocaleString("pt-BR")} h`} />
                    <Bar
                      dataKey="horas"
                      name="Horas de voo"
                      fill="var(--color-aviation)"
                      radius={[5, 5, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="divide-y divide-border rounded border border-border">
                {frotaStats.map((item) => (
                  <div
                    key={item.nome}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <span className="font-medium">{item.nome}</span>
                    <span className="font-mono font-bold">{minutesToClock(item.minutos)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {frotaMensal.length > 0 && (
            <div className="mt-6 border-t border-border pt-5">
              <p className="mb-3 text-sm font-semibold">Horas voadas por mês</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={frotaMensal}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="mes" />
                    <YAxis unit="h" />
                    <Tooltip formatter={(v) => `${Number(v).toLocaleString("pt-BR")} h`} />
                    <Bar
                      dataKey="horas"
                      name="Horas de voo"
                      fill="var(--color-chart-2)"
                      radius={[5, 5, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Estatísticas por categoria de missão */}
      <Card className="mb-5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
            Pousos / Missões por categoria
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MissoesResumo
            resumo={resumoMissoes}
            className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3"
          />
        </CardContent>
      </Card>

      {canManageOps && (
        <Card className="mb-5">
          <CardHeader className="pb-2">
            <button
              type="button"
              onClick={() => setMostrarGerenciador((v) => !v)}
              className="flex w-full items-center justify-between text-left"
            >
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                Gerenciar categorias de missão
              </CardTitle>
              {mostrarGerenciador ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </CardHeader>
          {mostrarGerenciador && (
            <CardContent>
              <CategoriaMissaoManager canEdit />
            </CardContent>
          )}
        </Card>
      )}

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-48">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Pesquisar integrante"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={esq} onValueChange={setEsq}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos os esquadrões</SelectItem>
            {ESQUADROES.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={nivel} onValueChange={setNivel}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos os níveis</SelectItem>
            {(niveis ?? []).filter((n) => n.active !== false).map((n) => (
              <SelectItem key={n.id} value={n.nome}>
                {operationalLevelLabel(n.nome)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={conf} onValueChange={setConf}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Confirmação: todos</SelectItem>
            <SelectItem value="CONFIRMADOS">Confirmados</SelectItem>
            <SelectItem value="PENDENTES">Pendentes</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((s) => (
              <SelectItem key={s.key} value={s.key}>
                Ordenar: {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabela desktop/tablet */}
      <Card className="hidden md:block">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3 text-left">TRI / Nome de guerra</th>
                <th className="p-3 text-left">Esquadrão</th>
                <th className="p-3 text-left">Nível operacional</th>
                <th className="p-3 text-left">Missão</th>
                <th className="p-3 text-left">Horas de voo</th>
                <th className="p-3 text-left">OPS</th>
                <th className="p-3 text-left">Pousos</th>
                <th className="p-3 text-left">Serviços</th>
                <th className="p-3 text-left">Confirmação semanal</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const s = statsDe(p.id);
                const serv = servicoDe(p.id);
                const open = !!aberto[p.id];
                return (
                  <Fragment key={p.id}>
                    <tr className="border-b border-border/60">
                      <td className="p-3 font-medium">
                        <button
                          type="button"
                          onClick={() => setAberto((a) => ({ ...a, [p.id]: !a[p.id] }))}
                          className="flex items-center gap-2 text-left hover:text-aviation"
                        >
                          {open ? (
                            <ChevronDown className="h-4 w-4 shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0" />
                          )}
                          <PhotoAvatar
                            path={p.avatar_path}
                            alt={`Foto de ${personTag(p)}`}
                            fallback={p.tri}
                            className="h-8 w-8"
                          />
                          {personTag(p)}
                        </button>
                      </td>
                      <td className="p-3 text-muted-foreground">{p.esquadrao || "—"}</td>
                      <td className="p-3">
                        <Select
                          value={p.nivel_operacional || "—"}
                          onValueChange={(v) => update(p.id, { nivel_operacional: v === "—" ? "" : v })}
                        >
                          <SelectTrigger className="h-8 w-44">
                            <SelectValue placeholder="Sem nível" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="—">Sem nível</SelectItem>
                            {(niveis ?? []).filter((n) => n.active !== false).map((n) => (
                              <SelectItem key={n.id} value={n.nome}>
                                {operationalLevelLabel(n.nome)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3">
                        <Input
                          className="h-8 w-28"
                          defaultValue={p.missao}
                          placeholder="ex.: RPD-02"
                          onBlur={(e) => update(p.id, { missao: e.target.value })}
                        />
                      </td>
                      <td className="p-3 font-mono">{minutesToClock(p.flight_minutes)}</td>
                      <td className="p-3 font-mono font-bold">{s.ops}</td>
                      <td className="p-3 font-mono font-bold">{s.pousos}</td>
                      <td className="p-3 font-mono font-bold">{serv.total}</td>
                      <td className="p-3">
                        {respondeu(p.id) ? (
                          <StatusBadge tone="success">✓ Confirmado</StatusBadge>
                        ) : (
                          <StatusBadge tone="neutral">○ Pendente</StatusBadge>
                        )}
                      </td>
                    </tr>
                    {open && (
                      <tr className="border-b border-border bg-muted/30">
                        <td colSpan={9} className="p-4">
                          <Detalhe p={p} s={s} serv={serv} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Cards no celular */}
      <div className="space-y-3 md:hidden">
        {rows.map((p) => {
          const s = statsDe(p.id);
          const serv = servicoDe(p.id);
          return (
            <Card key={p.id}>
              <CardHeader className="flex-row items-center gap-3 pb-1">
                <PhotoAvatar
                  path={p.avatar_path}
                  alt={`Foto de ${personTag(p)}`}
                  fallback={p.tri}
                  className="h-11 w-11"
                />
                <div className="min-w-0">
                  <CardTitle className="truncate text-base">{personTag(p)}</CardTitle>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    {p.esquadrao || "Sem esquadrão"}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {p.nivel_operacional ? (
                    <StatusBadge tone="info">{operationalLevelLabel(p.nivel_operacional)}</StatusBadge>
                  ) : (
                    <StatusBadge tone="neutral">Sem nível</StatusBadge>
                  )}
                  <span className="text-sm font-medium">{p.missao || "—"}</span>
                </div>
                <p className="font-mono text-sm">{minutesToClock(p.flight_minutes)} de voo</p>
                <p className="text-sm text-muted-foreground">
                  OPS {s.ops} • Pousos {s.pousos} • Serviços {serv.total}
                </p>
                {respondeu(p.id) ? (
                  <StatusBadge tone="success">✓ Confirmado</StatusBadge>
                ) : (
                  <StatusBadge tone="neutral">○ Pendente</StatusBadge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {rows.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum integrante encontrado.
          </CardContent>
        </Card>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        OPS, pousos, categorias de missão e serviços são calculados automaticamente pela planilha do
        Anotador e pela escala de funções — não há digitação manual. A confirmação semanal vem da
        aba Disponibilidade.{" "}
        {!week && (
          <Button variant="link" className="h-auto p-0 text-xs" asChild>
            <a href="/disponibilidade">Abrir a semana de disponibilidade</a>
          </Button>
        )}
      </p>
    </>
  );
}

function Detalhe({
  p,
  s,
  serv,
}: {
  p: { avatar_path: string; tri: string; proxima_missao: string; nivel_operacional: string };
  s: PessoaStats;
  serv: ServicoStats;
}) {
  const resolver = useCategoriaResolver();
  const resumo = useMemo(() => resumirMissoes(s.missoes, resolver), [s.missoes, resolver]);
  const funcoes = Object.entries(serv.porFuncao).sort((a, b) => b[1] - a[1]);
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="flex items-start gap-3">
        <PhotoAvatar
          path={p.avatar_path}
          alt="Foto do integrante"
          fallback={p.tri}
          className="h-20 w-20"
        />
        <div className="text-xs text-muted-foreground">
          <p>Próxima missão: {p.proxima_missao || "—"}</p>
          <p>Nível: {operationalLevelLabel(p.nivel_operacional) || "—"}</p>
          <p>Horas na planilha: {minutesToClock(s.minutos)}</p>
          <p>Última operação: {s.ultimaOperacao ? formatDatePtBr(s.ultimaOperacao) : "—"}</p>
          <p className="mt-1">
            Aprovados {s.aprovados} · não aprovados {s.naoAprovados}
          </p>
        </div>
      </div>
      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Missões por categoria
        </p>
        <MissoesResumo resumo={resumo} empty="Nenhuma missão lançada." />
      </div>
      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Serviços cumpridos
        </p>
        {funcoes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum serviço registrado.</p>
        ) : (
          <ul className="space-y-0.5 text-sm">
            {funcoes.slice(0, 8).map(([f, q]) => (
              <li key={f} className="flex justify-between gap-3">
                <span className="truncate text-muted-foreground">{f}</span>
                <span className="font-mono font-semibold">{q}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Indicator({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "warning";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p
          className={
            tone === "success"
              ? "text-3xl font-bold text-success"
              : tone === "warning"
                ? "text-3xl font-bold text-warning-foreground"
                : "text-3xl font-bold"
          }
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
