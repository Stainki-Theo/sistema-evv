import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarCheck, ChevronLeft, ChevronRight, Check, X, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeBase } from "@/lib/missao";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth, displayName } from "@/lib/auth";
import {
  useProfiles,
  useWeeks,
  useAvailability,
  ensureWeek,
  saveAvailability,
  addExtraDay,
  removeExtraDay,
} from "@/lib/data";
import {
  AVAIL,
  availLabel,
  addDaysISO,
  saturdayOf,
  shortDate,
  todayISO,
  weekdayName,
  minutesToClock,
  personTag,
  compareOperacional,
  ESQUADROES,
} from "@/lib/evv";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/_authenticated/disponibilidade")({
  head: () => ({
    meta: [
      { title: "Disponibilidade — EVV" },
      {
        name: "description",
        content:
          "Informe sua disponibilidade para a semana de operação e consulte a disponibilidade de todo o efetivo do voo a vela.",
      },
      { property: "og:title", content: "Disponibilidade — EVV" },
      {
        property: "og:description",
        content: "Disponibilidade semanal do efetivo do voo a vela, sem planilhas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DisponibilidadePage,
});

type Answer = { status: string; observacao: string };

function DisponibilidadePage() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const [weekStart, setWeekStart] = useState(saturdayOf(todayISO()));
  const { data: weeks } = useWeeks();
  const { data: profiles } = useProfiles();
  const week = (weeks ?? []).find((w) => w.week_start === weekStart);
  const { data: entries } = useAvailability(week?.id);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [saving, setSaving] = useState(false);
  const [showRoster, setShowRoster] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState("TODOS");
  const [esq, setEsq] = useState("TODOS");
  const [search, setSearch] = useState("");
  const [newDay, setNewDay] = useState("");
  const [proxima, setProxima] = useState(profile?.proxima_missao ?? "");
  const [savingProxima, setSavingProxima] = useState(false);

  useEffect(() => setProxima(profile?.proxima_missao ?? ""), [profile?.proxima_missao]);

  /** A próxima missão do perfil alimenta a escala automática. */
  async function saveProxima() {
    if (!profile?.id) return;
    setSavingProxima(true);
    const { error } = await supabase
      .from("profiles")
      .update({ proxima_missao: normalizeBase(proxima) || proxima.trim() })
      .eq("id", profile.id);
    setSavingProxima(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["profiles"] });
    toast.success("Próxima missão atualizada.");
  }




  const days = useMemo(() => {
    const stored = (week?.days ?? []) as string[];
    if (stored.length) return [...stored].sort();
    return [weekStart, addDaysISO(weekStart, 1)];
  }, [week?.id, weekStart]);

  const weekEnd = days[days.length - 1] ?? weekStart;

  useEffect(() => {
    const mine: Record<string, Answer> = {};
    for (const day of days) {
      const found = (entries ?? []).find(
        (e) => e.profile_id === profile?.id && e.op_date === day,
      );
      mine[day] = {
        status: found?.status ?? AVAIL.NONE,
        observacao: found?.observacao ?? "",
      };
    }
    setAnswers(mine);
  }, [entries, profile?.id, week?.id, weekStart]);

  const answered = days.some(
    (d) => (answers[d]?.status ?? AVAIL.NONE) !== AVAIL.NONE,
  );

  async function save() {
    if (!profile?.id) {
      toast.error("Perfil não carregado. Recarregue a página e tente novamente.");
      return;
    }
    setSaving(true);
    try {
      const created = await ensureWeek(weekStart, weekEnd, days);
      if (!created?.id) throw new Error("Não foi possível preparar a semana de operação.");
      await saveAvailability(
        created.id,
        profile.id,
        days.map((d) => ({
          op_date: d,
          status: answers[d]?.status ?? AVAIL.NONE,
          observacao: answers[d]?.observacao ?? "",
        })),
      );
      await qc.invalidateQueries({ queryKey: ["availability_weeks"] });
      await qc.invalidateQueries({ queryKey: ["availability"] });
      toast.success("Disponibilidade registrada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    }
    setSaving(false);
  }

  async function addDay() {
    if (!newDay) return;
    try {
      const wk = await ensureWeek(weekStart, weekEnd, days);
      if (!wk?.id) throw new Error("Semana não encontrada.");
      await addExtraDay(wk.id, (wk.days ?? days) as string[], newDay);
      await qc.invalidateQueries({ queryKey: ["availability_weeks"] });
      setNewDay("");
      toast.success("Dia extra adicionado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao adicionar o dia.");
    }
  }

  async function dropDay(day: string) {
    if (!week?.id) return;
    try {
      await removeExtraDay(week.id, (week.days ?? []) as string[], day);
      await qc.invalidateQueries({ queryKey: ["availability_weeks"] });
      await qc.invalidateQueries({ queryKey: ["availability"] });
      toast.success("Dia removido.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao remover o dia.");
    }
  }


  function statusOf(profileId: string, day: string) {
    return (
      (entries ?? []).find((e) => e.profile_id === profileId && e.op_date === day)?.status ??
      AVAIL.NONE
    );
  }
  function obsOf(profileId: string, day: string) {
    return (
      (entries ?? []).find((e) => e.profile_id === profileId && e.op_date === day)?.observacao ?? ""
    );
  }

  const counters = days.map((d) => ({
    day: d,
    yes: (profiles ?? []).filter((p) => statusOf(p.id, d) === AVAIL.YES).length,
    no: (profiles ?? []).filter((p) => statusOf(p.id, d) === AVAIL.NO).length,
    none: (profiles ?? []).filter((p) => statusOf(p.id, d) === AVAIL.NONE).length,
  }));

  const roster = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (profiles ?? []).filter((p) => {
      if (q && ![p.war_name, p.full_name, p.tri].join(" ").toLowerCase().includes(q)) return false;
      if (esq !== "TODOS" && (p.esquadrao || "") !== esq) return false;
      if (filter === "TODOS") return true;
      const statuses = days.map((d) => statusOf(p.id, d));
      if (filter === AVAIL.NONE) return statuses.every((s) => s === AVAIL.NONE);
      return statuses.includes(filter);
    });
    return [...list].sort(compareOperacional);
  }, [profiles, entries, search, filter, esq, days]);


  return (
    <>
      <PageHeader
        title="Disponibilidade"
        description={`Semana ${shortDate(weekStart)} – ${shortDate(weekEnd)}`}
        actions={
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label="Semana anterior"
              onClick={() => setWeekStart(addDaysISO(weekStart, -7))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-24 text-center font-mono text-sm">
              {shortDate(weekStart)} – {shortDate(weekEnd)}
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label="Próxima semana"
              onClick={() => setWeekStart(addDaysISO(weekStart, 7))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {/* MINHA DISPONIBILIDADE */}
      <Card className="mb-5 border-l-4 border-l-aviation">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
            <CalendarCheck className="h-4 w-4" /> Minha disponibilidade — {personTag(profile) || displayName(profile)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {days.map((day) => {
            const a = answers[day] ?? { status: AVAIL.NONE, observacao: "" };
            const isExtra = day !== weekStart && day !== addDaysISO(weekStart, 1);
            return (
              <div key={day} className="rounded border border-border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="font-semibold">
                    {weekdayName(day)} — {shortDate(day)}
                    {isExtra && (
                      <span className="ml-2 text-[11px] font-normal uppercase tracking-wider text-muted-foreground">
                        dia extra
                      </span>
                    )}
                  </p>
                  {isExtra && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger"
                      onClick={() => dropDay(day)}
                    >
                      Remover dia
                    </Button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={a.status === AVAIL.YES ? "default" : "outline"}
                    className={cn(a.status === AVAIL.YES && "bg-success hover:bg-success/90")}
                    onClick={() =>
                      setAnswers({ ...answers, [day]: { ...a, status: AVAIL.YES } })
                    }
                  >
                    <Check className="mr-1.5 h-4 w-4" /> Disponível
                  </Button>
                  <Button
                    size="sm"
                    variant={a.status === AVAIL.NO ? "default" : "outline"}
                    className={cn(a.status === AVAIL.NO && "bg-danger hover:bg-danger/90")}
                    onClick={() => setAnswers({ ...answers, [day]: { ...a, status: AVAIL.NO } })}
                  >
                    <X className="mr-1.5 h-4 w-4" /> Indisponível
                  </Button>
                </div>
                <div className="mt-2">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Observação (opcional)
                  </Label>
                  <Input
                    className="mt-1"
                    placeholder="ex.: Viagem, escala de serviço"
                    value={a.observacao}
                    onChange={(e) =>
                      setAnswers({ ...answers, [day]: { ...a, observacao: e.target.value } })
                    }
                  />
                </div>
              </div>
            );
          })}
          <div className="flex flex-wrap items-end gap-3 rounded border border-dashed border-border p-3">
            <div>
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Adicionar dia extra de operação
              </Label>
              <Input
                type="date"
                className="mt-1 w-44"
                value={newDay}
                onChange={(e) => setNewDay(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={addDay} disabled={!newDay}>
              + Adicionar dia
            </Button>
            <p className="text-xs text-muted-foreground">
              Use para feriados, dias úteis ou operações especiais desta semana.
            </p>
          </div>
          <div className="rounded border border-border p-3">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Minha próxima missão
            </Label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Input
                className="w-40"
                placeholder="ex.: PS-14"
                value={proxima}
                onChange={(e) => setProxima(e.target.value.toUpperCase())}
              />
              <Button variant="outline" onClick={saveProxima} disabled={savingProxima}>
                Salvar missão
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              A escala do dia é montada automaticamente a partir da sua disponibilidade e desta
              missão. Ela é atualizada sozinha quando o resultado do voo é lançado na Planilha do
              Anotador.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={save} disabled={saving || !profile?.id}>
              Salvar disponibilidade
            </Button>
            {answered && (
              <span className="text-sm font-semibold text-success">
                ✓ Disponibilidade registrada
              </span>
            )}
          </div>


        </CardContent>
      </Card>

      {/* CONTADORES */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        {counters.map((c) => (
          <Card key={c.day}>
            <CardContent className="p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {weekdayName(c.day)} — {shortDate(c.day)}
              </p>
              <div className="mt-1 flex flex-wrap gap-x-4 text-sm">
                <span className="font-semibold text-success">{c.yes} disponíveis</span>
                <span className="font-semibold text-danger">{c.no} indisponíveis</span>
                <span className="text-muted-foreground">{c.none} não responderam</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!showRoster ? (
        <Button variant="outline" onClick={() => setShowRoster(true)}>
          Ver disponibilidade do efetivo
        </Button>
      ) : (
        <Card>
          <CardHeader className="gap-3 pb-2">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
              Disponibilidade do efetivo
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-44">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Pesquisar integrante"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos</SelectItem>
                  <SelectItem value={AVAIL.YES}>Disponíveis</SelectItem>
                  <SelectItem value={AVAIL.NO}>Indisponíveis</SelectItem>
                  <SelectItem value={AVAIL.NONE}>Não responderam</SelectItem>
                </SelectContent>
              </Select>
              <Select value={esq} onValueChange={setEsq}>
                <SelectTrigger className="w-44">
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

              <Button variant="outline" size="sm" onClick={() => setExpanded((v) => !v)}>
                {expanded ? "Ocultar dados operacionais" : "Ver dados operacionais"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowRoster(false)}>
                Ocultar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 sm:p-0">
            {/* Tabela para desktop/tablet */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left">TRI / Nome de guerra</th>
                    <th className="p-3 text-left">Esquadrão</th>

                    {expanded && (
                      <>
                        <th className="p-3 text-left">Posto</th>
                        <th className="p-3 text-left">TRI</th>
                        <th className="p-3 text-left">Horas totais</th>
                        <th className="p-3 text-left">OPS</th>
                        <th className="p-3 text-left">PSO</th>
                        <th className="p-3 text-left">OPR DG</th>
                        <th className="p-3 text-left">OPR DUO</th>
                        <th className="p-3 text-left">OPR CS</th>
                        <th className="p-3 text-left">Próx. missão</th>
                      </>
                    )}
                    {days.map((d) => (
                      <th key={d} className="p-3 text-left">
                        {weekdayName(d).slice(0, 3).toUpperCase()} {shortDate(d)}
                        <span className="ml-2 font-normal normal-case">obs</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roster.map((p) => (
                    <tr key={p.id} className="border-b border-border/60">
                      <td className="p-3 font-medium">{personTag(p)}</td>
                      <td className="p-3 text-muted-foreground">{p.esquadrao || "—"}</td>

                      {expanded && (
                        <>
                          <td className="p-3">{p.posto || "—"}</td>
                          <td className="p-3">{p.tri || "—"}</td>
                          <td className="p-3 font-mono">{minutesToClock(p.flight_minutes)}</td>
                          <td className="p-3">{p.ops}</td>
                          <td className="p-3">{p.pso}</td>
                          <td className="p-3">{p.opr_dg || "—"}</td>
                          <td className="p-3">{p.opr_duo || "—"}</td>
                          <td className="p-3">{p.opr_cs || "—"}</td>
                          <td className="p-3">{p.proxima_missao || "—"}</td>
                        </>
                      )}
                      {days.map((d) => {
                        const s = statusOf(p.id, d);
                        return (
                          <td key={d} className="p-3">
                            <span
                              className={cn(
                                "font-bold",
                                s === AVAIL.YES && "text-success",
                                s === AVAIL.NO && "text-danger",
                                s === AVAIL.NONE && "text-muted-foreground",
                              )}
                            >
                              {availLabel(s).short}
                            </span>
                            <span className="ml-2 text-muted-foreground">
                              {obsOf(p.id, d) || "-"}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cards no celular */}
            <div className="space-y-3 p-4 md:hidden">
              {roster.map((p) => (
                <div key={p.id} className="rounded border border-border p-3">
                  <p className="font-semibold">{personTag(p)}</p>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    {p.esquadrao || "Sem esquadrão"}
                  </p>

                  <div className="mt-2 space-y-1 text-sm">
                    {days.map((d) => {
                      const s = statusOf(p.id, d);
                      return (
                        <div key={d} className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground">
                            {weekdayName(d)} {shortDate(d)}
                          </span>
                          <span className="flex items-center gap-2">
                            {obsOf(p.id, d) && (
                              <span className="text-xs text-muted-foreground">
                                {obsOf(p.id, d)}
                              </span>
                            )}
                            <StatusBadge tone={availLabel(s).tone}>
                              {availLabel(s).label}
                            </StatusBadge>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {expanded && (
                    <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
                      {p.posto || "—"} · TRI {p.tri || "—"} · {minutesToClock(p.flight_minutes)} ·
                      OPS {p.ops} • PSO {p.pso} · Próx. {p.proxima_missao || "—"}
                    </p>
                  )}
                </div>
              ))}
              {roster.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum integrante encontrado.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        Legenda: ✓ disponível · ✕ indisponível · — não respondeu
      </p>
    </>
  );
}
