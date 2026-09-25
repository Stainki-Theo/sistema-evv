import { flightDuration, minutesToClock, wxClass } from "@/lib/evv";
import { isReboque, RESULTADO } from "@/lib/missao";
import type { ResumoCategoria, CategoriaResolver } from "@/lib/categorias";
import { resumirMissoes } from "@/lib/categorias";

/**
 * Resumo pós-operação: consolidação automática do que já foi lançado na
 * Planilha do Anotador, na meteorologia e nos avisos — sem duplicar dados.
 */

type Flight = {
  dep_time: string;
  land_time: string;
  missao: string;
  al_1p: string;
  in_2p: string;
  aeronave: string;
  callsign: string;
  status: string;
  resultado: string;
  observacoes: string;
};

type Activation = { ordem: number; hora: string; observacao: string };

type Weather = {
  classification?: string | null;
  wind_dir?: string | null;
  wind_speed?: string | null;
  temperature?: string | null;
  thermals_strength?: string | null;
  thermals_top?: string | null;
  ceiling?: string | null;
  cloud_base?: string | null;
  last_glider_ground?: string | null;
} | null;

export type ResumoOperacao = {
  voos: number;
  voosRealizados: number;
  minutosPlanador: number;
  minutosIpanema: number;
  minutosTotal: number;
  horasPlanador: string;
  horasIpanema: string;
  horasTotal: string;
  aeronaves: { aeronave: string; voos: number; horas: string }[];
  missoes: { missao: string; total: number; aprovados: number; naoAprovados: number }[];
  /** Missões agrupadas pela categoria global, com as missões reais para expansão. */
  missoesPorCategoria: ResumoCategoria[];
  integrantes: { nome: string; voos: number; horas: string }[];
  acionamentos: Activation[];
  primeiraDecolagem: string;
  ultimoPouso: string;
  avisos: number;
  seguranca: number;
  wx: { label: string; detalhe: string } | null;
  destaques: string[];
};

export function resumoOperacao(input: {
  flights?: Flight[] | null;
  activations?: Activation[] | null;
  weather?: Weather;
  announcements?: { title: string; priority?: string | null }[] | null;
  safety?: { title: string; kind?: string | null }[] | null;
  tipoPorAeronave?: Map<string, string>;
  /** Resolver global de categorias de missão (Panorama/Histórico/Quadro). */
  categoriaResolver?: CategoriaResolver;
}): ResumoOperacao {
  const flights = input.flights ?? [];
  const activations = input.activations ?? [];

  let minutosPlanador = 0;
  let minutosIpanema = 0;
  const porAeronave = new Map<string, { voos: number; minutes: number }>();
  const porMissao = new Map<string, { total: number; aprovados: number; naoAprovados: number }>();
  const porIntegrante = new Map<string, { voos: number; minutes: number }>();
  const deps: string[] = [];
  const lands: string[] = [];

  for (const f of flights) {
    const { minutes } = flightDuration(f.dep_time, f.land_time);
    const tipo = input.tipoPorAeronave?.get((f.aeronave || "").toUpperCase());
    if (isReboque(f.missao) || tipo === "REBOCADOR") minutosIpanema += minutes;
    else minutosPlanador += minutes;

    if (f.dep_time?.trim()) deps.push(f.dep_time.trim());
    if (f.land_time?.trim()) lands.push(f.land_time.trim());

    const aeronave = (f.aeronave || "").trim();
    if (aeronave) {
      const cur = porAeronave.get(aeronave) ?? { voos: 0, minutes: 0 };
      porAeronave.set(aeronave, { voos: cur.voos + 1, minutes: cur.minutes + minutes });
    }

    const missao = (f.missao || "").trim().toUpperCase();
    if (missao) {
      const cur = porMissao.get(missao) ?? { total: 0, aprovados: 0, naoAprovados: 0 };
      porMissao.set(missao, {
        total: cur.total + 1,
        aprovados: cur.aprovados + (f.resultado === RESULTADO.APROVADO ? 1 : 0),
        naoAprovados: cur.naoAprovados + (f.resultado === RESULTADO.NAO_APROVADO ? 1 : 0),
      });
    }

    for (const nome of [f.al_1p, f.in_2p]) {
      const key = (nome || "").trim();
      if (!key) continue;
      const cur = porIntegrante.get(key) ?? { voos: 0, minutes: 0 };
      porIntegrante.set(key, { voos: cur.voos + 1, minutes: cur.minutes + minutes });
    }
  }

  const missoesPorCategoria = input.categoriaResolver
    ? resumirMissoes(
        flights.map((f) => f.missao),
        input.categoriaResolver,
      )
    : [];

  const voosRealizados = flights.filter((f) => f.status === "REALIZADO").length;
  const minutosTotal = minutosPlanador + minutosIpanema;
  const wx = input.weather;
  const aprovados = flights.filter((f) => f.resultado === RESULTADO.APROVADO).length;
  const naoAprovados = flights.filter((f) => f.resultado === RESULTADO.NAO_APROVADO).length;

  const destaques: string[] = [];
  if (flights.length) {
    destaques.push(
      `${flights.length} voo(s) lançados, ${voosRealizados} concluídos, ${minutesToClock(minutosTotal)} de tempo somado.`,
    );
  }
  if (aprovados || naoAprovados) {
    destaques.push(`${aprovados} missão(ões) aprovada(s) e ${naoAprovados} não aprovada(s).`);
  }
  if (activations.length) destaques.push(`${activations.length} acionamento(s) registrados.`);
  const obs = flights.filter((f) => (f.observacoes || "").trim());
  for (const f of obs.slice(0, 5)) {
    destaques.push(`${f.aeronave || "Voo"} — ${f.observacoes.trim()}`);
  }

  return {
    voos: flights.length,
    voosRealizados,
    minutosPlanador,
    minutosIpanema,
    minutosTotal,
    horasPlanador: minutesToClock(minutosPlanador),
    horasIpanema: minutesToClock(minutosIpanema),
    horasTotal: minutesToClock(minutosTotal),
    aeronaves: [...porAeronave.entries()]
      .map(([aeronave, v]) => ({ aeronave, voos: v.voos, horas: minutesToClock(v.minutes) }))
      .sort((a, b) => b.voos - a.voos),
    missoes: [...porMissao.entries()]
      .map(([missao, v]) => ({ missao, ...v }))
      .sort((a, b) => b.total - a.total),
    missoesPorCategoria,
    integrantes: [...porIntegrante.entries()]
      .map(([nome, v]) => ({ nome, voos: v.voos, horas: minutesToClock(v.minutes) }))
      .sort((a, b) => b.voos - a.voos),
    acionamentos: activations,
    primeiraDecolagem: deps.sort()[0] ?? "—",
    ultimoPouso: lands.sort().at(-1) ?? "—",
    avisos: (input.announcements ?? []).length,
    seguranca: (input.safety ?? []).length,
    wx: wx
      ? {
          label: wxClass(wx.classification).label,
          detalhe: [
            wx.wind_dir && wx.wind_speed ? `${wx.wind_dir}/${wx.wind_speed}` : "",
            wx.temperature ? `${wx.temperature}` : "",
            wx.thermals_top ? `topo ${wx.thermals_top}` : "",
            wx.last_glider_ground ? `últ. no solo ${wx.last_glider_ground}` : "",
          ]
            .filter(Boolean)
            .join(" · "),
        }
      : null,
    destaques,
  };
}
