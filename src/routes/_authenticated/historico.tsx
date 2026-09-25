import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { ResumoOperacao } from "@/components/ResumoOperacao";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useDay, useDuties, useFlights, useWeather, useAnnouncements, useSafety } from "@/lib/data";
import { todayISO, formatDatePtBr, wxClass, priority, safetyKind } from "@/lib/evv";

export const Route = createFileRoute("/_authenticated/historico")({
  head: () => ({
    meta: [
      { title: "Histórico — EVV" },
      {
        name: "description",
        content: "Consulta de operações anteriores: escala, funções, meteorologia, avisos e segurança.",
      },
      { property: "og:title", content: "Histórico — EVV" },
      { property: "og:description", content: "Registro das operações do voo a vela por data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistoricoPage,
});

function HistoricoPage() {
  const [date, setDate] = useState(todayISO());
  const { data: day } = useDay(date);
  const { data: duties } = useDuties(date);
  const { data: flights } = useFlights(date);
  const { data: weather } = useWeather(date);
  const { data: announcements } = useAnnouncements(date);
  const { data: safety } = useSafety(date);

  const wx = weather?.[0];

  return (
    <>
      <PageHeader
        title="Histórico"
        description={`Operação de ${formatDatePtBr(date)}`}
        actions={
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-40"
          />
        }
      />

      <div className="mb-4">
        <ResumoOperacao date={date} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
              Escala de voos · briefing {day?.briefing_time?.slice(0, 5) || "—"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(flights ?? []).length ? (
              <ul className="divide-y divide-border text-sm">
                {flights!.map((f, i) => (
                  <li key={f.id} className="grid grid-cols-[2rem_4rem_minmax(0,1fr)] gap-2 py-2">
                    <span className="font-mono text-muted-foreground">{i + 1}</span>
                    <span className="font-mono">{f.time_planned?.slice(0, 5) || "—"}</span>
                    <span>
                      <span className="font-semibold">{f.aluno || "—"}</span>
                      <span className="text-muted-foreground">
                        {f.instrutor ? ` · ${f.instrutor}` : ""}
                        {f.missao ? ` · ${f.missao}` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Sem voos registrados.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
              Funções
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(duties ?? []).length ? (
              <ul className="divide-y divide-border text-sm">
                {duties!.map((d) => (
                  <li key={d.id} className="flex justify-between gap-3 py-1.5">
                    <span className="text-muted-foreground">{d.funcao}</span>
                    <span className="font-medium">{d.responsavel || "—"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Sem funções registradas.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
              Meteorologia
            </CardTitle>
            {wx && (
              <StatusBadge tone={wxClass(wx.classification).tone}>
                {wxClass(wx.classification).label}
              </StatusBadge>
            )}
          </CardHeader>
          <CardContent>
            {wx ? (
              <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
                <Row k="Vento" v={`${wx.wind_dir || "—"}/${wx.wind_speed || "—"}`} />
                <Row k="Máxima prevista" v={wx.temp_max ? `${wx.temp_max} °C` : ""} />
                <Row k="TIC" v={[wx.tic_temp && `${wx.tic_temp} °C`, wx.tic_time].filter(Boolean).join(" · ")} />
                <Row k="Topo das térmicas" v={wx.thermals_top ? `${wx.thermals_top} m` : ""} />
                <Row k="Chuva" v={wx.rain_chance ? `${wx.rain_chance}%` : ""} />
                <Row k="Neblina" v={wx.fog_chance ? `${wx.fog_chance}%${wx.fog_obs ? ` · ${wx.fog_obs}` : ""}` : "Não há"} />
                <Row k="Últ. planador no solo" v={wx.last_glider_ground} />
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">Sem boletim.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
              Avisos e segurança
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(safety ?? []).map((s) => (
              <div key={s.id} className="rounded border border-border bg-muted/40 p-2.5">
                <StatusBadge tone={safetyKind(s.kind).tone}>{safetyKind(s.kind).label}</StatusBadge>
                <p className="mt-1 text-sm font-semibold">{s.title}</p>
                <p className="text-sm text-muted-foreground">{s.content}</p>
              </div>
            ))}
            {(announcements ?? []).map((a) => (
              <div key={a.id} className="rounded border border-border bg-muted/40 p-2.5">
                <StatusBadge tone={priority(a.priority).tone}>{priority(a.priority).label}</StatusBadge>
                <p className="mt-1 text-sm font-semibold">{a.title}</p>
                <p className="text-sm text-muted-foreground">{a.message}</p>
              </div>
            ))}
            {!(safety ?? []).length && !(announcements ?? []).length && (
              <p className="text-sm text-muted-foreground">Nenhum registro.</p>
            )}
          </CardContent>
        </Card>
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
