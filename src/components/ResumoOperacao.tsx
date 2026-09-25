import { useMemo } from "react";
import { ClipboardList } from "lucide-react";
import {
  useActivations,
  useAircraft,
  useAnnotatorFlights,
  useAnnouncements,
  useSafety,
  useWeather,
} from "@/lib/data";
import { resumoOperacao } from "@/lib/resumo";
import { useCategoriaResolver } from "@/lib/categorias";
import { MissoesResumo } from "@/components/MissoesResumo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Resumo pós-operação: consolidação automática do dia a partir do que já foi
 * lançado na Planilha do Anotador, meteorologia, avisos e segurança de voo.
 */
export function ResumoOperacao({ date, variant = "card" }: { date: string; variant?: "card" | "board" }) {
  const { data: flights } = useAnnotatorFlights(date);
  const { data: activations } = useActivations(date);
  const { data: weather } = useWeather(date);
  const { data: announcements } = useAnnouncements(date);
  const { data: safety } = useSafety(date);
  const { data: aircraft } = useAircraft();
  const resolver = useCategoriaResolver();

  const tipoPorAeronave = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of aircraft ?? []) map.set(a.identificacao.toUpperCase(), a.tipo);
    return map;
  }, [aircraft]);

  const resumo = useMemo(
    () =>
      resumoOperacao({
        flights: flights as never,
        activations: activations as never,
        weather: (weather ?? [])[0] ?? null,
        announcements: (announcements ?? []).filter((a) => a.active),
        safety: (safety ?? []).filter((s) => s.active),
        tipoPorAeronave,
        categoriaResolver: resolver,
      }),
    [flights, activations, weather, announcements, safety, tipoPorAeronave, resolver],
  );

  const board = variant === "board";
  const box = board ? "rounded bg-navy/40 p-2.5" : "rounded border border-border p-2.5";
  const muted = board ? "opacity-70" : "text-muted-foreground";

  const body = (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Voos" value={String(resumo.voos)} board={board} />
        <Metric label="Concluídos" value={String(resumo.voosRealizados)} board={board} />
        <Metric label="H. Planador" value={resumo.horasPlanador} board={board} />
        <Metric label="H. Ipanema" value={resumo.horasIpanema} board={board} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className={box}>
          <p className={`text-[10px] font-bold uppercase tracking-wider ${muted}`}>Aeronaves</p>
          {resumo.aeronaves.length ? (
            <ul className="mt-1 space-y-0.5 text-sm">
              {resumo.aeronaves.map((a) => (
                <li key={a.aeronave} className="flex justify-between gap-2">
                  <span>{a.aeronave}</span>
                  <span className="font-mono">
                    {a.voos} voo(s) · {a.horas}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={`text-sm ${muted}`}>Sem lançamentos.</p>
          )}
        </div>
        <div className={box}>
          <p className={`text-[10px] font-bold uppercase tracking-wider ${muted}`}>Missões</p>
          <MissoesResumo resumo={resumo.missoesPorCategoria} empty="Sem missões lançadas." />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className={box}>
          <p className={`text-[10px] font-bold uppercase tracking-wider ${muted}`}>Acionamentos</p>
          {resumo.acionamentos.length ? (
            <ul className="mt-1 space-y-0.5 text-sm">
              {resumo.acionamentos.map((a) => (
                <li key={`${a.ordem}-${a.hora}`} className="flex justify-between gap-2">
                  <span>{a.ordem}º</span>
                  <span className="font-mono">{a.hora || "—"}</span>
                  <span className={`truncate ${muted}`}>{a.observacao}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={`text-sm ${muted}`}>Nenhum acionamento.</p>
          )}
        </div>
        <div className={box}>
          <p className={`text-[10px] font-bold uppercase tracking-wider ${muted}`}>
            Meteorologia e avisos
          </p>
          <ul className="mt-1 space-y-0.5 text-sm">
            <li className="flex justify-between gap-2">
              <span>Condição</span>
              <span className="font-semibold">{resumo.wx?.label ?? "—"}</span>
            </li>
            {resumo.wx?.detalhe && <li className={muted}>{resumo.wx.detalhe}</li>}
            <li className="flex justify-between gap-2">
              <span>1ª decolagem / últ. pouso</span>
              <span className="font-mono">
                {resumo.primeiraDecolagem} / {resumo.ultimoPouso}
              </span>
            </li>
            <li className="flex justify-between gap-2">
              <span>Avisos / segurança</span>
              <span className="font-mono">
                {resumo.avisos} / {resumo.seguranca}
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className={box}>
        <p className={`text-[10px] font-bold uppercase tracking-wider ${muted}`}>Destaques</p>
        {resumo.destaques.length ? (
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm">
            {resumo.destaques.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        ) : (
          <p className={`text-sm ${muted}`}>Sem destaques registrados nesta operação.</p>
        )}
      </div>
    </div>
  );

  if (board) {
    return (
      <div className="rounded bg-navy-soft/40 p-4">
        <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest opacity-70">
          <ClipboardList className="h-4 w-4" /> Resumo pós-operação
        </h2>
        {body}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
          <ClipboardList className="h-4 w-4" /> Resumo pós-operação
        </CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}

function Metric({ label, value, board }: { label: string; value: string; board: boolean }) {
  return (
    <div
      className={`rounded px-3 py-2 ${board ? "bg-navy/40" : "border border-border bg-muted/30"}`}
    >
      <div
        className={`text-[10px] font-bold uppercase tracking-wider ${board ? "opacity-70" : "text-muted-foreground"}`}
      >
        {label}
      </div>
      <div className="font-mono text-xl font-bold">{value}</div>
    </div>
  );
}
