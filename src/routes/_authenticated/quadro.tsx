import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plane, CloudSun, Clock, ShieldAlert } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { StatusBadge } from "@/components/StatusBadge";
import { ResumoOperacao } from "@/components/ResumoOperacao";
import { useDay, useDuties, useFlights, useWeather, useAnnouncements, useSafety } from "@/lib/data";
import {
  todayISO,
  formatDatePtBr,
  wxClass,
  priority,
  safetyKind,
  nowHHMM,
  funcaoLabel,
} from "@/lib/evv";

export const Route = createFileRoute("/_authenticated/quadro")({
  head: () => ({
    meta: [
      { title: "Quadro Operacional — EVV" },
      {
        name: "description",
        content: "Visão de quadro para monitor e tablet com escala, funções, WX e avisos do dia.",
      },
      { property: "og:title", content: "Quadro Operacional — EVV" },
      { property: "og:description", content: "Painel de parede da operação, atualizado automaticamente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QuadroPage,
});

function QuadroPage() {
  const date = todayISO();
  const qc = useQueryClient();
  const { data: day } = useDay(date);
  const { data: duties } = useDuties(date);
  const { data: flights } = useFlights(date);
  const { data: weather } = useWeather(date);
  const { data: announcements } = useAnnouncements(date);
  const { data: safety } = useSafety(date);
  const [clock, setClock] = useState(nowHHMM());

  useEffect(() => {
    const t = setInterval(() => {
      setClock(nowHHMM());
      void qc.invalidateQueries();
    }, 30000);
    return () => clearInterval(t);
  }, [qc]);

  const wx = weather?.[0];
  const notices = (announcements ?? []).filter((a) => a.active);
  const safetyItems = (safety ?? []).filter((s) => s.active);

  return (
    <div className="-m-4 min-h-screen bg-navy p-6 text-navy-foreground sm:-m-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-navy-soft pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quadro Operacional</h1>
          <p className="text-sm opacity-70">{formatDatePtBr(date)}</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider opacity-70">Briefing</div>
            <div className="font-mono text-2xl font-bold">
              {day?.briefing_time?.slice(0, 5) || "07:30"}
            </div>
          </div>
          <div className="flex items-center gap-2 font-mono text-4xl font-bold">
            <Clock className="h-7 w-7 opacity-70" />
            {clock}
          </div>
        </div>
      </header>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest opacity-70">
            <Plane className="h-4 w-4" /> Escala de voos
          </h2>
          <div className="overflow-hidden rounded bg-navy-soft/40">
            {(flights ?? []).length ? (
              <table className="w-full text-left">
                <thead className="bg-navy-soft/60 text-[11px] uppercase tracking-wider opacity-80">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Hora</th>
                    <th className="px-3 py-2">Aluno / Piloto</th>
                    <th className="px-3 py-2">Instrutor</th>
                    <th className="px-3 py-2">Missão</th>
                  </tr>
                </thead>
                <tbody>
                  {flights!.map((f, i) => (
                    <tr key={f.id} className="border-t border-navy-soft/60 text-lg">
                      <td className="px-3 py-2 font-mono opacity-60">{i + 1}</td>
                      <td className="px-3 py-2 font-mono">{f.time_planned?.slice(0, 5) || "—"}</td>
                      <td className="px-3 py-2 font-semibold">{f.aluno || "—"}</td>
                      <td className="px-3 py-2">{f.instrutor || "—"}</td>
                      <td className="px-3 py-2 opacity-80">{f.missao || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="p-6 text-center text-sm opacity-70">Escala não lançada.</p>
            )}
          </div>

          <h2 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-widest opacity-70">
            Funções do dia
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {(duties ?? []).map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 rounded bg-navy-soft/40 px-3 py-2"
              >
                <span className="text-sm opacity-80">{funcaoLabel(d.funcao)}</span>
                <span className="font-semibold">{d.responsavel || "—"}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-5">
          <div className="rounded bg-navy-soft/40 p-4">
            <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest opacity-70">
              <CloudSun className="h-4 w-4" /> Meteorologia
            </h2>
            {wx ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-2xl font-bold">
                    {wx.wind_dir || "—"}/{wx.wind_speed || "—"}
                  </span>
                  <StatusBadge tone={wxClass(wx.classification).tone}>
                    {wxClass(wx.classification).label}
                  </StatusBadge>
                </div>
                <dl className="mt-2 space-y-1 text-sm opacity-90">
                  <Line k="Máxima prevista" v={wx.temp_max ? `${wx.temp_max} °C` : ""} />
                  <Line k="TIC" v={[wx.tic_temp && `${wx.tic_temp} °C`, wx.tic_time].filter(Boolean).join(" · ")} />
                  <Line k="Topo das térmicas" v={wx.thermals_top ? `${wx.thermals_top} m` : ""} />
                  <Line k="Chuva" v={wx.rain_chance ? `${wx.rain_chance}%` : ""} />
                  <Line k="Neblina" v={wx.fog_chance ? `${wx.fog_chance}%${wx.fog_obs ? ` · ${wx.fog_obs}` : ""}` : "Não há"} />
                  <Line k="Últ. planador no solo" v={wx.last_glider_ground} />
                </dl>
              </>
            ) : (
              <p className="text-sm opacity-70">Sem boletim.</p>
            )}
          </div>

          <div className="rounded bg-navy-soft/40 p-4">
            <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest opacity-70">
              <ShieldAlert className="h-4 w-4" /> Segurança e avisos
            </h2>
            <div className="space-y-2">
              {safetyItems.map((s) => (
                <div key={s.id} className="rounded bg-navy/40 p-2.5">
                  <StatusBadge tone={safetyKind(s.kind).tone}>{safetyKind(s.kind).label}</StatusBadge>
                  <p className="mt-1 text-sm font-semibold">{s.title}</p>
                  <p className="text-sm opacity-80">{s.content}</p>
                </div>
              ))}
              {notices.map((a) => (
                <div key={a.id} className="rounded bg-navy/40 p-2.5">
                  <StatusBadge tone={priority(a.priority).tone}>{priority(a.priority).label}</StatusBadge>
                  <p className="mt-1 text-sm font-semibold">{a.title}</p>
                  <p className="text-sm opacity-80">{a.message}</p>
                </div>
              ))}
              {!safetyItems.length && !notices.length && (
                <p className="text-sm opacity-70">Nada a destacar.</p>
              )}
            </div>
          </div>
        </section>
      </div>

      <div className="mt-5">
        <ResumoOperacao date={date} variant="board" />
      </div>
    </div>
  );
}

function Line({ k, v }: { k: string; v?: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="opacity-70">{k}</dt>
      <dd className="font-medium">{v || "—"}</dd>
    </div>
  );
}
