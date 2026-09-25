import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, CloudSun, ShieldAlert, Megaphone, ListOrdered, ExternalLink, PlaneTakeoff } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth, displayName } from "@/lib/auth";
import {
  useDay,
  useDuties,
  useFlights,
  useWeather,
  useAnnouncements,
  useSafety,
  useSetting,
  saveBriefingTime,
} from "@/lib/data";
import {
  todayISO,
  formatDatePtBr,
  wxClass,
  priority,
  safetyKind,
  funcaoLabel,
} from "@/lib/evv";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Home — EVV Operações do Voo a Vela" },
      {
        name: "description",
        content:
          "Resumo da operação do dia: horário do briefing, sua função, resumo meteorológico e escala de voos.",
      },
      { property: "og:title", content: "Home — EVV Operações do Voo a Vela" },
      {
        property: "og:description",
        content: "Briefing, funções, meteorologia e escala do dia em uma única tela.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function Home() {
  const [date, setDate] = useState(todayISO());
  const { profile } = useAuth();
  const qc = useQueryClient();
  const { data: day } = useDay(date);
  const { data: duties } = useDuties(date);
  const { data: flights } = useFlights(date);
  const { data: weather } = useWeather(date);
  const { data: announcements } = useAnnouncements(date);
  const { data: safety } = useSafety(date);
  const { data: relprev } = useSetting("relprev_url");
  const [editing, setEditing] = useState(false);
  const [time, setTime] = useState("");

  const wx = weather?.[0];
  const me = displayName(profile).toUpperCase();
  const myDuties = (duties ?? []).filter(
    (d) =>
      (profile?.id && d.profile_id === profile.id) ||
      (d.responsavel && d.responsavel.toUpperCase() === me),
  );
  const myFlights = (flights ?? []).filter(
    (f) => f.aluno.toUpperCase() === me || f.instrutor.toUpperCase() === me,
  );
  const activeNotices = (announcements ?? []).filter((a) => a.active);
  const activeSafety = (safety ?? []).filter((s) => s.active);
  const filledDutyCount = (duties ?? []).filter(
    (d) => Boolean(d.profile_id || d.responsavel?.trim()),
  ).length;
  const dutyTotal = (duties ?? []).length;

  async function save() {
    try {
      await saveBriefingTime(date, time || "07:30");
      await qc.invalidateQueries({ queryKey: ["day", date] });
      setEditing(false);
      toast.success("Horário do briefing atualizado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    }
  }

  return (
    <>
      <PageHeader
        title="Visão geral da operação"
        description={formatDatePtBr(date)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-40"
              aria-label="Data da operação"
            />
            {relprev ? (
              <Button asChild variant="outline" size="sm">
                <a href={relprev} target="_blank" rel="noreferrer">
                  RELPREV <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </a>
              </Button>
            ) : null}
          </div>
        }
      />

      <section className="evv-operation-hero">
        <div>
          <p><i /> OPERAÇÃO DO DIA</p>
          <h2>{(flights ?? []).length ? "Planejamento em andamento" : "Aguardando lançamento da escala"}</h2>
          <span>Briefing às <strong>{day?.briefing_time?.slice(0, 5) || "07:30"}</strong> · <strong>{filledDutyCount}/{dutyTotal}</strong> funções preenchidas</span>
        </div>
        <div className="evv-hero-metrics">
          <span><PlaneTakeoff /><b>{(flights ?? []).length}</b><small>voos previstos</small></span>
          <span><CloudSun /><b>{wx ? wxClass(wx.classification).label : "—"}</b><small>condição WX</small></span>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-l-4 border-l-aviation">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
              <Clock className="h-4 w-4" /> Briefing
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editing ? (
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={time || day?.briefing_time || "07:30"}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-32"
                />
                <Button size="sm" onClick={save}>
                  Salvar
                </Button>
              </div>
            ) : (
              <div className="flex items-end gap-3">
                <div className="font-mono text-4xl font-bold tracking-tight">
                  {day?.briefing_time?.slice(0, 5) || "07:30"}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setTime(day?.briefing_time?.slice(0, 5) || "07:30");
                    setEditing(true);
                  }}
                >
                  Alterar
                </Button>
              </div>
            )}
            <p className="mt-2 text-sm text-muted-foreground">Horário de apresentação no hangar.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
              Minha função em {formatDatePtBr(date)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-wide">{displayName(profile)}</div>
            {myDuties.length ? (
              <ul className="mt-2 space-y-1 text-sm">
                {myDuties.map((d) => (
                  <li key={d.id} className="font-semibold">
                    {funcaoLabel(d.funcao)}
                    {d.observacao ? (
                      <span className="font-normal text-muted-foreground"> — {d.observacao}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Nenhuma função atribuída nesta data.</p>
            )}
            {myFlights.length ? (
              <ul className="mt-3 space-y-1 border-t border-border pt-2 text-sm">
                {myFlights.map((f) => (
                  <li key={f.id}>
                    <span className="font-mono">{f.time_planned?.slice(0, 5) || "—"}</span>{" "}
                    {f.aluno} / {f.instrutor}
                  </li>
                ))}
              </ul>
            ) : null}
            <Link to="/funcoes" className="mt-3 inline-block text-sm text-primary underline">
              Ver todas as funções
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
              <CloudSun className="h-4 w-4" /> Resumo WX
            </CardTitle>
            {wx && <StatusBadge tone={wxClass(wx.classification).tone}>{wxClass(wx.classification).label}</StatusBadge>}
          </CardHeader>
          <CardContent>
            {wx ? (
              <>
                <div className="text-2xl font-bold">
                  {wx.wind_dir || "—"}/{wx.wind_speed || "—"} kt
                  {wx.wind_gust ? (
                    <span className="text-base font-medium text-muted-foreground">
                      {" "}
                      rajada {wx.wind_gust}
                    </span>
                  ) : null}
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-sm">
                  <Row k="Temperatura" v={wx.temperature} />
                  <Row k="Máxima prevista" v={wx.temp_max} />
                  <Row k="TIC" v={[wx.tic_temp, wx.tic_time].filter(Boolean).join(" · ")} />
                  <Row k="Térmicas" v={wx.thermals_strength} />
                  <Row k="Topo térmicas" v={wx.thermals_top} />
                  <Row k="Chuva" v={wx.rain_chance} />
                  <Row k="Neblina" v={wx.fog} />
                  <Row k="Visibilidade" v={wx.visibility} />
                  <Row k="Teto" v={wx.ceiling || wx.cloud_base} />
                  <Row k="Últ. planador no solo" v={wx.last_glider_ground} />

                </dl>
                <Link to="/meteorologia" className="mt-3 inline-block text-sm text-primary underline">
                  Ver boletim completo
                </Link>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sem boletim meteorológico para esta data.{" "}
                <Link to="/meteorologia" className="text-primary underline">
                  Lançar
                </Link>
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
              <ListOrdered className="h-4 w-4" /> Escala do dia
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(flights ?? []).length ? (
              <ul className="divide-y divide-border">
                {flights!.map((f, i) => (
                  <li key={f.id} className="grid grid-cols-[2rem_4rem_minmax(0,1fr)] gap-2 py-2 text-sm">
                    <span className="font-mono text-muted-foreground">{i + 1}</span>
                    <span className="font-mono">{f.time_planned?.slice(0, 5) || "—"}</span>
                    <span className="min-w-0">
                      <span className="font-semibold">{f.aluno || "—"}</span>
                      <span className="text-muted-foreground">
                        {f.instrutor ? ` · Instrutor ${f.instrutor}` : ""}
                        {f.missao ? ` · ${f.missao}` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Escala de voos ainda não lançada.</p>
            )}
            <Link to="/escala" className="mt-3 inline-block text-sm text-primary underline">
              Editar escala
            </Link>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
                <ShieldAlert className="h-4 w-4" /> Segurança de voo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {activeSafety.length ? (
                activeSafety.slice(0, 4).map((s) => (
                  <div key={s.id} className="rounded border border-border bg-muted/40 p-2.5">
                    <StatusBadge tone={safetyKind(s.kind).tone}>{safetyKind(s.kind).label}</StatusBadge>
                    <p className="mt-1.5 text-sm font-semibold">{s.title}</p>
                    <p className="text-sm text-muted-foreground">{s.content}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum item de segurança hoje.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
                <Megaphone className="h-4 w-4" /> Avisos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {activeNotices.length ? (
                activeNotices.slice(0, 4).map((a) => (
                  <div key={a.id} className="rounded border border-border bg-muted/40 p-2.5">
                    <StatusBadge tone={priority(a.priority).tone}>{priority(a.priority).label}</StatusBadge>
                    <p className="mt-1.5 text-sm font-semibold">{a.title}</p>
                    <p className="text-sm text-muted-foreground">{a.message}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum aviso ativo.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v?: string | null }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="truncate text-right font-medium">{v || "—"}</dd>
    </>
  );
}
