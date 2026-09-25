import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Radio,
  Timer,
  CircleCheckBig,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  GripVertical,
} from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { SearchCombo, type ComboOption } from "@/components/SearchCombo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  useAnnotatorFlights,
  useActivations,
  useAircraft,
  useCallsigns,
  useProfiles,
  useDuties,
  useMissionSequence,
  useOperationClosed,
} from "@/lib/data";
import { registrarResultado } from "@/lib/progressao.functions";
import { finalizeOperation, reopenControlledOperation } from "@/lib/operation.functions";
import { isReboque, RESULTADO, RESULTADO_OPTIONS, resultadoLabel } from "@/lib/missao";
import { computeProxima } from "@/lib/progressao";
import { useAuth, displayName } from "@/lib/auth";
import { usePermissoes } from "@/lib/permissoes";
import { logChange } from "@/lib/audit";
import {
  todayISO,
  formatDatePtBr,
  flightDuration,
  minutesToClock,
  personTag,
  isAtivo,
  FLIGHT_STATUS,
  flightStatusStyle,
  elapsedFrom,
  nowHHMM,
  nowZuluHHMM,
} from "@/lib/evv";

/** Rótulos das colunas usados no Log de Alterações. */
const FIELD_LABELS: Record<string, string> = {
  qtd: "QTD",
  dep_time: "Hora de decolagem",
  land_time: "Hora do pouso",
  missao: "Missão",
  al_1p: "AL/1P",
  in_2p: "IN/2P",
  aeronave: "Aeronave",
  callsign: "Código de chamada",
  status: "Situação",
  resultado: "Resultado",
  observacoes: "Observações",
  hora: "Hora do acionamento",
  observacao: "Observação",
};

export const Route = createFileRoute("/_authenticated/anotador")({
  head: () => ({
    meta: [
      { title: "Planilha do Anotador — EVV" },
      {
        name: "description",
        content:
          "Planilha operacional do anotador: decolagem, pouso, missão, tripulação, aeronave, tempo de voo, contadores e acionamentos.",
      },
      { property: "og:title", content: "Planilha do Anotador — EVV" },
      {
        property: "og:description",
        content: "Registro de voos da operação com cálculo automático de tempo e contadores.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AnotadorPage,
});

type FlightRow = NonNullable<ReturnType<typeof useAnnotatorFlights>["data"]>[number];

type PendingResultado = {
  row: FlightRow;
  resultado: string;
  proxima: string;
  proximaAtual: string;
  profileId: string | null;
};

function AnotadorPage() {
  const qc = useQueryClient();
  const { profile, refresh } = useAuth();
  const { canManageOps } = usePermissoes();
  const [date, setDate] = useState(todayISO());
  const { data: duties } = useDuties(date);
  const { data: closedValue } = useOperationClosed(date);
  const { data: flights, isLoading } = useAnnotatorFlights(date);
  const { data: activations } = useActivations(date);
  const { data: aircraft } = useAircraft();
  const { data: callsigns } = useCallsigns();
  const { data: profiles } = useProfiles();
  const { data: sequence } = useMissionSequence();
  const registrarProgressao = useServerFn(registrarResultado);
  const [pending, setPending] = useState<PendingResultado | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [closing, setClosing] = useState(false);
  const [confirmReopen, setConfirmReopen] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [selectedCrewId, setSelectedCrewId] = useState("");
  const [clock, setClock] = useState(() => ({
    brasilia: nowHHMM(),
    zulu: nowZuluHHMM(),
  }));
  const operationClosed = closedValue === "true";
  const isDailyController = (duties ?? []).some(
    (d) =>
      d.profile_id === profile?.id &&
      ["Chefe de Pista (Manhã)", "Chefe de Pista (Tarde)", "Sombra (Manhã)", "Sombra (Tarde)", "Anotador"].includes(d.funcao),
  );
  const canControlOperation = canManageOps || isDailyController;
  const finalizeOnServer = useServerFn(finalizeOperation);
  const reopenOnServer = useServerFn(reopenControlledOperation);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const actor = { id: profile?.id, tag: displayName(profile) };

  const rows: FlightRow[] = flights ?? [];

  // Painel "Operação Agora": o tempo de voo corre sozinho.
  useEffect(() => {
    const updateClock = () =>
      setClock({
        brasilia: nowHHMM(),
        zulu: nowZuluHHMM(),
      });
    updateClock();
    const t = setInterval(updateClock, 30000);
    return () => clearInterval(t);
  }, []);

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["annotator_flights", date] });
    await qc.invalidateQueries({ queryKey: ["annotator_activations", date] });
  };

  function requireOpen() {
    if (!operationClosed) return true;
    toast.error("Esta operação já foi encerrada e está consolidada no histórico.");
    return false;
  }

  /** Aeronaves ativas + as já usadas no histórico do dia (aeronave desativada continua visível). */
  const aircraftOptions: ComboOption[] = useMemo(() => {
    const list = (aircraft ?? []).filter((a) => a.active);
    const used = new Set(rows.map((r) => r.aeronave).filter(Boolean));
    const extra = (aircraft ?? []).filter((a) => !a.active && used.has(a.identificacao));
    return [...list, ...extra].map((a) => ({
      value: a.identificacao,
      hint: a.tipo === "REBOCADOR" ? "Rebocador" : "Planador",
    }));
  }, [aircraft, rows]);

  const callsignOptions: ComboOption[] = useMemo(() => {
    const used = new Set(rows.map((r) => r.callsign).filter(Boolean));
    return (callsigns ?? [])
      .filter((c) => c.active || used.has(c.nome))
      .map((c) => ({ value: c.nome }));
  }, [callsigns, rows]);

  /** Somente integrantes ativos entram como sugestão; os já lançados continuam visíveis. */
  const peopleOptions: ComboOption[] = useMemo(() => {
    const used = new Set(rows.flatMap((r) => [r.al_1p, r.in_2p]).filter(Boolean));
    return (profiles ?? [])
      .filter((p) => isAtivo(p) || used.has(p.tri || p.war_name || p.full_name))
      .map((p) => ({
        value: p.tri || p.war_name || p.full_name,
        label: personTag(p),
        hint: p.esquadrao || "",
      }));
  }, [profiles, rows]);

  /** Resolve o integrante lançado em AL/1P para registrar a progressão. */
  const profilePorTag = useMemo(() => {
    const map = new Map<string, { id: string; proxima: string }>();
    for (const p of profiles ?? []) {
      const entry = { id: p.id, proxima: p.proxima_missao || p.missao || "" };
      for (const key of [p.tri, p.war_name, p.full_name, personTag(p)]) {
        const k = (key ?? "").trim().toUpperCase();
        if (k) map.set(k, entry);
      }
    }
    return map;
  }, [profiles]);

  const tipoPorAeronave = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of aircraft ?? []) map.set(a.identificacao.toUpperCase(), a.tipo);
    return map;
  }, [aircraft]);

  const callsignPorAeronave = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of aircraft ?? []) if (a.callsign) map.set(a.identificacao, a.callsign);
    return map;
  }, [aircraft]);

  const counters = useMemo(() => {
    let planador = 0;
    let ipanema = 0;
    let saidasPlanador = 0;
    let reboques = 0;
    for (const r of rows) {
      const reboque = isReboque(r.missao);
      const tipo = tipoPorAeronave.get((r.aeronave || "").toUpperCase());
      const decolou = !!(r.dep_time || "").trim();
      // REBOQUE não é missão/saída de planador: entra apenas na conta do rebocador.
      if (decolou) {
        if (reboque) reboques += 1;
        else if (tipo !== "REBOCADOR") saidasPlanador += 1;
      }

      const { minutes } = flightDuration(r.dep_time, r.land_time);
      if (!minutes) continue;
      // REBOQUE na missão é sempre creditado ao rebocador (Ipanema).
      if (reboque || tipo === "REBOCADOR") ipanema += minutes;
      else planador += minutes;
    }
    return { planador, ipanema, saidasPlanador, reboques };
  }, [rows, tipoPorAeronave]);

  /** Painel Operação Agora: voos em andamento e próximas saídas guarnecidas. */
  const emVoo = useMemo(
    () => rows.filter((r) => (r.status || "").toUpperCase() === "EM VOO"),
    [rows],
  );
  const proximas = useMemo(
    () => rows.filter((r) => (r.status || "").toUpperCase() === "GUARNECIDO"),
    [rows],
  );

  const selectedCrewSummary = useMemo(() => {
    const selected = (profiles ?? []).find((p) => p.id === selectedCrewId);
    if (!selected) return { minutes: 0, flights: 0, active: 0 };
    const aliases = new Set(
      [selected.tri, selected.war_name, selected.full_name, personTag(selected)]
        .map((value) => (value ?? "").trim().toUpperCase())
        .filter(Boolean),
    );
    let minutes = 0;
    let flights = 0;
    let active = 0;
    for (const row of rows) {
      const al = (row.al_1p || "").trim().toUpperCase();
      const instrutor = (row.in_2p || "").trim().toUpperCase();
      if (row.al_profile_id !== selected.id && !aliases.has(al) && !aliases.has(instrutor))
        continue;
      const status = (row.status || "").toUpperCase();
      const duration = row.land_time
        ? flightDuration(row.dep_time, row.land_time)
        : status === "EM VOO"
          ? elapsedFrom(row.dep_time, clock.zulu)
          : { minutes: 0, text: "—" };
      if (row.dep_time) flights += 1;
      if (status === "EM VOO") active += 1;
      minutes += duration.minutes;
    }
    return { minutes, flights, active };
  }, [profiles, selectedCrewId, rows, clock.zulu]);

  async function applyOrder(nextRows: FlightRow[]) {
    if (!requireOpen()) return;
    const results = await Promise.all(
      nextRows.map((row, index) =>
        supabase
          .from("annotator_flights")
          .update({ sort_order: index + 1, qtd: index + 1 } as never)
          .eq("id", row.id),
      ),
    );
    const failed = results.find((result) => result.error)?.error;
    if (failed) {
      toast.error(failed.message);
      return;
    }
    await invalidate();
  }

  async function moveFlight(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    await applyOrder(arrayMove(rows, index, target));
  }

  async function reorderFlights(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    const oldIndex = rows.findIndex((row) => row.id === event.active.id);
    const newIndex = rows.findIndex((row) => row.id === event.over?.id);
    if (oldIndex < 0 || newIndex < 0) return;
    await applyOrder(arrayMove(rows, oldIndex, newIndex));
  }

  async function addFlight() {
    if (!requireOpen()) return;
    const sort = rows.length + 1;
    const { data, error } = await supabase
      .from("annotator_flights")
      .insert({
        op_date: date,
        sort_order: sort,
        qtd: sort,
        status: "GUARNECIDO",
        resultado: RESULTADO.PENDENTE,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    await logChange(
      {
        area: "ANOTADOR",
        entity: "annotator_flights",
        entityId: data.id,
        entityLabel: `Voo ${sort}`,
        action: "INSERT",
        newValue: `Voo ${sort} guarnecido`,
        opDate: date,
      },
      actor,
    );
    await invalidate();
  }

  async function update(id: string, patch: Record<string, string | number>) {
    if (!requireOpen()) return;
    const before = rows.find((r) => r.id === id);
    const { error } = await supabase
      .from("annotator_flights")
      .update(patch as never)
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (before) {
      const label = `Voo ${before.qtd || ""} · ${before.al_1p || before.aeronave || "sem tripulação"}`;
      for (const [field, value] of Object.entries(patch)) {
        await logChange(
          {
            area: "ANOTADOR",
            entity: "annotator_flights",
            entityId: id,
            entityLabel: label,
            field,
            fieldLabel: FIELD_LABELS[field] ?? field,
            oldValue: (before as Record<string, unknown>)[field] as string,
            newValue: value,
            opDate: date,
          },
          actor,
        );
      }
    }
    await invalidate();
  }

  /** AL/1P lançado: guarda o vínculo com o perfil para a progressão automática. */
  async function setAluno(row: FlightRow, value: string) {
    if (!requireOpen()) return;
    const found = profilePorTag.get(value.trim().toUpperCase());
    const patch: Record<string, string> = { al_1p: value };
    if (!row.missao && found?.proxima) patch["missao"] = found.proxima;
    const { error } = await supabase
      .from("annotator_flights")
      .update({ ...patch, al_profile_id: found?.id ?? null } as never)
      .eq("id", row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logChange(
      {
        area: "ANOTADOR",
        entity: "annotator_flights",
        entityId: row.id,
        entityLabel: `Voo ${row.qtd || ""}`,
        field: "al_1p",
        fieldLabel: FIELD_LABELS["al_1p"] ?? "AL/1P",
        oldValue: row.al_1p,
        newValue: value,
        opDate: date,
      },
      actor,
    );
    await invalidate();
  }

  /** Abre a confirmação antes de lançar Aprovado / Não aprovado. */
  function askResultado(row: FlightRow, resultado: string) {
    // REBOQUE não é missão de instrução: não gera resultado nem progressão.
    if (isReboque(row.missao)) return;
    if (resultado === RESULTADO.PENDENTE) {
      void update(row.id, { resultado });
      return;
    }
    if (resultado === RESULTADO.ABORTADO) {
      void update(row.id, { resultado });
      toast.success("Voo registrado como abortado, sem alterar a próxima missão.");
      return;
    }
    const profileId =
      row.al_profile_id || profilePorTag.get((row.al_1p || "").trim().toUpperCase())?.id || null;
    const proximaAtual = profileId
      ? (profiles ?? []).find((p) => p.id === profileId)?.proxima_missao || ""
      : "";
    const proxima = computeProxima(row.missao, resultado, (sequence ?? []) as never);
    setPending({ row, resultado, proxima, proximaAtual, profileId });
  }

  /** Resultado do voo alimenta a próxima missão do integrante e a escala futura. */
  async function confirmResultado() {
    if (!pending) return;
    if (!requireOpen()) {
      setPending(null);
      return;
    }
    const { row, resultado, proxima, proximaAtual, profileId } = pending;
    setPending(null);
    await update(row.id, { resultado });

    if (!profileId) {
      toast.warning(
        "Resultado registrado na planilha, mas o AL/1P não está vinculado a um integrante — a progressão não foi atualizada.",
      );
      return;
    }
    if (!row.missao.trim()) {
      toast.warning("Informe a missão realizada para atualizar a progressão.");
      return;
    }
    try {
      const r = await registrarProgressao({
        data: {
          profileId,
          opDate: date,
          missao: row.missao,
          resultado,
          registradoPor: displayName(profile),
        },
      });
      // Log com o efeito em cadeia, para permitir desfazer a progressão.
      await logChange(
        {
          area: "PROGRESSAO",
          entity: "annotator_flights",
          entityId: row.id,
          entityLabel: `${row.al_1p || "Integrante"} · ${row.missao}`,
          field: "resultado",
          fieldLabel: "Resultado do voo",
          oldValue: row.resultado || RESULTADO.PENDENTE,
          newValue: resultado,
          opDate: date,
          details: {
            progression: {
              profileId,
              proximaAnterior: proximaAtual,
              opDate: date,
              missao: row.missao,
            },
          },
        },
        actor,
      );
      await qc.invalidateQueries({ queryKey: ["profiles"] });
      await qc.invalidateQueries({ queryKey: ["progression_log"] });
      toast.success(
        r.proxima
          ? `${resultadoLabel(resultado)}: próxima missão agora é ${r.proxima}.`
          : `${resultadoLabel(resultado)} registrado.`,
      );
    } catch (e) {
      console.warn("A progressão automática não pôde ser sincronizada.", e);
      toast.success(`${resultadoLabel(resultado)} registrado na planilha.`);
    }
    void proxima;
  }

  async function removeFlight(id: string) {
    if (!requireOpen()) return;
    const before = rows.find((r) => r.id === id);
    const { error } = await supabase.from("annotator_flights").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logChange(
      {
        area: "ANOTADOR",
        entity: "annotator_flights",
        entityId: id,
        entityLabel: `Voo ${before?.qtd ?? ""} · ${before?.al_1p ?? ""}`,
        action: "DELETE",
        oldValue: `${before?.missao ?? ""} ${before?.aeronave ?? ""}`.trim(),
        opDate: date,
        details: { snapshot: before },
      },
      actor,
    );
    await invalidate();
  }

  async function addActivation() {
    if (!requireOpen()) return;
    const { error } = await supabase.from("annotator_activations").insert({
      op_date: date,
      ordem: (activations?.length ?? 0) + 1,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    await invalidate();
  }

  async function updateActivation(id: string, patch: Record<string, string>) {
    if (!requireOpen()) return;
    const before = (activations ?? []).find((a) => a.id === id);
    const { error } = await supabase
      .from("annotator_activations")
      .update(patch as never)
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    for (const [field, value] of Object.entries(patch)) {
      await logChange(
        {
          area: "ANOTADOR",
          entity: "annotator_activations",
          entityId: id,
          entityLabel: `${before?.ordem ?? ""}º acionamento`,
          field,
          fieldLabel: FIELD_LABELS[field] ?? field,
          oldValue: (before as Record<string, unknown> | undefined)?.[field] as string,
          newValue: value,
          opDate: date,
        },
        actor,
      );
    }
    await invalidate();
  }

  async function removeActivation(id: string) {
    if (!requireOpen()) return;
    const before = (activations ?? []).find((a) => a.id === id);
    const { error } = await supabase.from("annotator_activations").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logChange(
      {
        area: "ANOTADOR",
        entity: "annotator_activations",
        entityId: id,
        entityLabel: `${before?.ordem ?? ""}º acionamento`,
        action: "DELETE",
        oldValue: before?.hora ?? "",
        opDate: date,
        details: { snapshot: before },
      },
      actor,
    );
    await invalidate();
  }

  async function finishOperation() {
    setClosing(true);
    try {
      const result = await finalizeOnServer({ data: { opDate: date } });
      const credits = result.profilesCredited ?? 0;
      const pitocadorEntries = result.pitocadorEntries ?? 0;
      await logChange(
        {
          area: "ANOTADOR",
          entity: "op_days",
          entityLabel: `Operação de ${formatDatePtBr(date)}`,
          action: "UPDATE",
          field: "status",
          fieldLabel: "Situação da operação",
          oldValue: "ABERTA",
          newValue: "ENCERRADA",
          opDate: date,
        },
        actor,
      );
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["setting", `operation_closed:${date}`] }),
        qc.invalidateQueries({ queryKey: ["annotator_flights", "todos"] }),
        qc.invalidateQueries({ queryKey: ["duty_roster", "todos"] }),
        qc.invalidateQueries({ queryKey: ["profiles"] }),
        qc.invalidateQueries({ queryKey: ["flight_credit_notice"] }),
        qc.invalidateQueries({ queryKey: ["pitocador"] }),
        refresh(),
      ]);
      setConfirmClose(false);
      toast.success(
        credits || pitocadorEntries
          ? `Operação encerrada: ${credits} tripulante${credits === 1 ? "" : "s"} com horas creditadas e ${pitocadorEntries} voo${pitocadorEntries === 1 ? "" : "s"} enviado${pitocadorEntries === 1 ? "" : "s"} ao Pitocador.`
          : "Operação encerrada. Os resultados foram consolidados no histórico.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível encerrar a operação.");
    } finally {
      setClosing(false);
    }
  }

  async function reopenCurrentOperation() {
    setReopening(true);
    try {
      const result = await reopenOnServer({ data: { opDate: date } });
      await logChange(
        {
          area: "ANOTADOR",
          entity: "op_days",
          entityLabel: `Operação de ${formatDatePtBr(date)}`,
          action: "UPDATE",
          field: "status",
          fieldLabel: "Situação da operação",
          oldValue: "ENCERRADA",
          newValue: "ABERTA",
          opDate: date,
        },
        actor,
      );
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["setting", `operation_closed:${date}`] }),
        qc.invalidateQueries({ queryKey: ["annotator_flights", "todos"] }),
        qc.invalidateQueries({ queryKey: ["duty_roster", "todos"] }),
        qc.invalidateQueries({ queryKey: ["profiles"] }),
        qc.invalidateQueries({ queryKey: ["flight_credit_notice"] }),
        qc.invalidateQueries({ queryKey: ["pitocador"] }),
        refresh(),
      ]);
      setConfirmReopen(false);
      const pessoas = result.profiles_reversed ?? 0;
      const fichas = result.pitocador_entries_removed ?? 0;
      toast.success(
        `Operação reaberta. ${pessoas} crédito${pessoas === 1 ? "" : "s"} de horas e ${fichas} ficha${fichas === 1 ? "" : "s"} do Pitocador foram retirados até o próximo encerramento.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível reabrir a operação.");
    } finally {
      setReopening(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Planilha do Anotador"
        description={`Operação de ${formatDatePtBr(date)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-40"
            />
            {canControlOperation && (
              <Button
                size="sm"
                variant={operationClosed ? "outline" : "destructive"}
                onClick={() => (operationClosed ? setConfirmReopen(true) : setConfirmClose(true))}
              >
                {operationClosed ? (
                  <RotateCcw className="mr-1.5 h-4 w-4" />
                ) : (
                  <CircleCheckBig className="mr-1.5 h-4 w-4" />
                )}
                {operationClosed ? "Reabrir operação" : "Encerrar operação"}
              </Button>
            )}
            <Button size="sm" onClick={addFlight} disabled={operationClosed}>
              <Plus className="mr-1.5 h-4 w-4" /> Voo
            </Button>
          </div>
        }
      />

      {operationClosed && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm font-medium text-success">
          <CircleCheckBig className="h-4 w-4" />
          Operação encerrada e consolidada. Os lançamentos deste dia já alimentam o Panorama e os
          históricos. Reabra a operação para fazer correções.
        </div>
      )}

      <Card className="mb-4 border-aviation/40">
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider">
            <Radio className="h-4 w-4 text-success" /> Operação agora
          </CardTitle>
          <span className="font-mono text-sm text-muted-foreground">
            {clock.brasilia} BRT · {clock.zulu}Z
          </span>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-success">
              Em voo ({emVoo.length})
            </p>
            {emVoo.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum voo em andamento.</p>
            ) : (
              <ul className="space-y-1.5">
                {emVoo.map((r) => {
                  const decorrido = elapsedFrom(r.dep_time, clock.zulu);
                  return (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded border border-success/40 bg-success/10 px-2.5 py-2"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">
                          {r.al_1p || "—"}
                          {r.in_2p ? ` / ${r.in_2p}` : ""}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {r.missao || "missão —"} · {r.aeronave || "aeronave —"} ·{" "}
                          {r.callsign || "callsign —"}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block font-mono text-xs text-muted-foreground">
                          DEP {r.dep_time || "—"}
                        </span>
                        <span className="flex items-center gap-1 font-mono text-lg font-bold">
                          <Timer className="h-4 w-4 opacity-70" />
                          {decorrido.text}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-warning">
              Próximas saídas ({proximas.length})
            </p>
            {proximas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum voo guarnecido.</p>
            ) : (
              <ul className="space-y-1.5">
                {proximas.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-warning/40 bg-warning/10 px-2.5 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">
                        {r.al_1p || "—"}
                        {r.in_2p ? ` / ${r.in_2p}` : ""}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {r.missao || "missão —"} · {r.aeronave || "aeronave —"} ·{" "}
                        {r.callsign || "callsign —"}
                      </span>
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">Voo {r.qtd}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <Label
              htmlFor="crew-hours"
              className="text-xs uppercase tracking-wider text-muted-foreground"
            >
              Horas do tripulante nesta operação
            </Label>
            <select
              id="crew-hours"
              value={selectedCrewId}
              onChange={(event) => setSelectedCrewId(event.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-aviation focus:ring-1 focus:ring-aviation sm:max-w-md"
            >
              <option value="">Selecionar tripulante</option>
              {[...(profiles ?? [])]
                .sort((a, b) => personTag(a).localeCompare(personTag(b), "pt-BR"))
                .map((person) => (
                  <option key={person.id} value={person.id}>
                    {personTag(person)}
                  </option>
                ))}
            </select>
          </div>
          <div className="rounded-lg border border-aviation/30 bg-aviation/10 px-4 py-2.5 sm:min-w-64">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Total no dia</p>
            <div className="flex items-baseline justify-between gap-4">
              <strong className="font-mono text-2xl">
                {minutesToClock(selectedCrewSummary.minutes)}
              </strong>
              <span className="text-xs text-muted-foreground">
                {selectedCrewSummary.flights} voo(s)
                {selectedCrewSummary.active > 0 ? ` · ${selectedCrewSummary.active} em voo` : ""}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contadores e acionamentos ficam no topo; a planilha usa a largura total. */}
      <div className="flex flex-col-reverse gap-4">
        <Card className="min-w-0">
          <CardContent className="p-0">
            {isLoading ? (
              <p className="p-4 text-sm text-muted-foreground">Carregando…</p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={reorderFlights}
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[70rem] border-collapse text-sm">
                    <thead className="bg-muted/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        {[
                          "QTD",
                          "H. DEP (Z)",
                          "H. POUSO (Z)",
                          "TEMPO VOO",
                          "MISSÃO",
                          "AL/1P",
                          "IN/2P",
                          "AERONAVE",
                          "CÓD. CHAMADA",
                          "STATUS",
                          "RESULTADO",
                          "OBSERVAÇÕES",
                          "ORDEM / AÇÕES",
                        ].map((h) => (
                          <th key={h} className="border border-border px-1.5 py-1.5 text-left">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <SortableContext
                      items={rows.map((row) => row.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <tbody className="font-mono">
                        {rows.map((r, rowIndex) => {
                          const tempo = flightDuration(r.dep_time, r.land_time);
                          const estilo = flightStatusStyle(r.status);
                          return (
                            <SortableAnnotatorRow key={r.id} id={r.id} className={estilo.row}>
                              {(dragHandle) => (
                                <>
                                  <Cell className="w-12">
                                    <input
                                      defaultValue={r.qtd}
                                      onBlur={(e) =>
                                        update(r.id, { qtd: Number(e.target.value) || 0 })
                                      }
                                      className="h-8 w-10 rounded-sm border border-input bg-background px-1 text-center text-sm"
                                    />
                                  </Cell>
                                  <Cell className="w-24">
                                    <TimeInput
                                      value={r.dep_time}
                                      onCommit={(v) => update(r.id, { dep_time: v })}
                                    />
                                  </Cell>
                                  <Cell className="w-24">
                                    <TimeInput
                                      value={r.land_time}
                                      onCommit={(v) => update(r.id, { land_time: v })}
                                    />
                                  </Cell>
                                  <Cell className="w-20 text-center font-bold">{tempo.text}</Cell>
                                  <Cell className="w-24">
                                    <PlainInput
                                      value={r.missao}
                                      onCommit={(v) => update(r.id, { missao: v })}
                                    />
                                  </Cell>
                                  <Cell className="min-w-40">
                                    <SearchCombo
                                      value={r.al_1p}
                                      options={peopleOptions}
                                      placeholder="TRI / nome"
                                      onCommit={(v) => setAluno(r, v)}
                                    />
                                  </Cell>

                                  <Cell className="min-w-40">
                                    <SearchCombo
                                      value={r.in_2p}
                                      options={peopleOptions}
                                      placeholder="TRI / nome"
                                      onCommit={(v) => update(r.id, { in_2p: v })}
                                    />
                                  </Cell>
                                  <Cell className="w-28">
                                    <SearchCombo
                                      value={r.aeronave}
                                      options={aircraftOptions}
                                      placeholder="ex.: 8121"
                                      onCommit={(v) => {
                                        const sugerido = callsignPorAeronave.get(v);
                                        update(
                                          r.id,
                                          sugerido && !r.callsign
                                            ? { aeronave: v, callsign: sugerido }
                                            : { aeronave: v },
                                        );
                                      }}
                                    />
                                  </Cell>
                                  <Cell className="w-32">
                                    <SearchCombo
                                      value={r.callsign}
                                      options={callsignOptions}
                                      placeholder="ex.: gai 21"
                                      onCommit={(v) => update(r.id, { callsign: v })}
                                    />
                                  </Cell>
                                  <Cell className="w-28">
                                    <SearchCombo
                                      value={r.status}
                                      options={FLIGHT_STATUS.map((s) => ({ value: s }))}
                                      onCommit={(v) => update(r.id, { status: v })}
                                    />
                                  </Cell>
                                  <Cell className="w-36">
                                    {isReboque(r.missao) ? (
                                      <span
                                        title="REBOQUE não gera progressão operacional"
                                        className="grid h-8 w-full place-items-center rounded-sm border border-dashed border-input bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground"
                                      >
                                        não aplicável
                                      </span>
                                    ) : (
                                      <select
                                        value={r.resultado || RESULTADO.PENDENTE}
                                        aria-label="Resultado do voo"
                                        onChange={(e) => askResultado(r, e.target.value)}
                                        className="h-8 w-full min-w-0 rounded-sm border border-input bg-background px-1 text-sm outline-none focus:border-aviation focus:ring-1 focus:ring-aviation"
                                      >
                                        {RESULTADO_OPTIONS.map((o) => (
                                          <option key={o.value} value={o.value}>
                                            {o.label}
                                          </option>
                                        ))}
                                      </select>
                                    )}
                                  </Cell>

                                  <Cell className="min-w-48">
                                    <PlainInput
                                      value={r.observacoes}
                                      onCommit={(v) => update(r.id, { observacoes: v })}
                                    />
                                  </Cell>
                                  <Cell className="w-40">
                                    <div className="flex items-center justify-end gap-0.5">
                                      {dragHandle}
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        title="Subir este voo"
                                        aria-label="Subir este voo"
                                        disabled={operationClosed || rowIndex === 0}
                                        onClick={() => void moveFlight(rowIndex, -1)}
                                      >
                                        <ArrowUp className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        title="Descer este voo"
                                        aria-label="Descer este voo"
                                        disabled={operationClosed || rowIndex === rows.length - 1}
                                        onClick={() => void moveFlight(rowIndex, 1)}
                                      >
                                        <ArrowDown className="h-4 w-4" />
                                      </Button>
                                      <button
                                        type="button"
                                        aria-label="Remover voo"
                                        onClick={() => removeFlight(r.id)}
                                        className="grid h-8 w-8 place-items-center rounded hover:bg-muted"
                                      >
                                        <Trash2 className="h-3.5 w-3.5 text-danger" />
                                      </button>
                                    </div>
                                  </Cell>
                                </>
                              )}
                            </SortableAnnotatorRow>
                          );
                        })}
                        {rows.length === 0 && (
                          <tr>
                            <td
                              colSpan={13}
                              className="border border-border p-6 text-center text-sm text-muted-foreground"
                            >
                              Nenhum voo lançado nesta data. Clique em “Voo” para começar.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </SortableContext>
                  </table>
                </div>
              </DndContext>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
                Contadores
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Counter label="H. Planador" value={minutesToClock(counters.planador)} />
              <Counter label="H. Ipanema" value={minutesToClock(counters.ipanema)} />
              <Counter label="Saídas planador" value={String(counters.saidasPlanador)} />
              <Counter label="Reboques" value={String(counters.reboques)} />
              <p className="text-xs text-muted-foreground">
                Somas por tipo de aeronave cadastrado na Administração. REBOQUE conta apenas em H.
                Ipanema e reboques — não entra nas saídas de planador.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
                Acionamentos
              </CardTitle>
              <Button size="sm" variant="outline" onClick={addActivation}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {(activations ?? []).map((a) => (
                <div key={a.id} className="rounded border border-border p-2">
                  <div className="flex items-center gap-2">
                    <span className="w-14 shrink-0 text-xs font-bold uppercase text-muted-foreground">
                      {a.ordem}º
                    </span>
                    <TimeInput
                      value={a.hora}
                      onCommit={(v) => updateActivation(a.id, { hora: v })}
                    />
                    <button
                      type="button"
                      aria-label="Remover acionamento"
                      onClick={() => removeActivation(a.id)}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded hover:bg-muted"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-danger" />
                    </button>
                  </div>
                  <div className="mt-1.5">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Observação
                    </Label>
                    <PlainInput
                      value={a.observacao}
                      placeholder="ex.: 2 toques sem reboque"
                      onCommit={(v) => updateActivation(a.id, { observacao: v })}
                    />
                  </div>
                </div>
              ))}
              {(activations ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum acionamento registrado.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirmar {resultadoLabel(pending?.resultado).toLowerCase()}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Este lançamento atualiza a progressão do integrante e a alimentação automática das
              próximas escalas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5 rounded border border-border bg-muted/40 p-3 text-sm">
            <Line k="Integrante" v={pending?.row.al_1p || "não vinculado"} />
            <Line k="Missão realizada" v={pending?.row.missao || "não informada"} />
            <Line k="Resultado" v={resultadoLabel(pending?.resultado)} />
            <Line k="Próxima missão atual" v={pending?.proximaAtual || "—"} />
            <Line k="Próxima missão após confirmar" v={pending?.proxima || "sem alteração"} />
            {!pending?.profileId && (
              <p className="text-xs text-warning">
                O AL/1P não está vinculado a um integrante: o resultado ficará apenas na planilha.
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmResultado}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar a operação de {formatDatePtBr(date)}?</AlertDialogTitle>
            <AlertDialogDescription>
              Os voos, pousos, missões, horas e serviços deste dia passarão a compor o Panorama e os
              históricos oficiais. Revise a planilha antes de confirmar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={closing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={closing} onClick={finishOperation}>
              {closing ? "Encerrando…" : "Encerrar e consolidar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmReopen} onOpenChange={setConfirmReopen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reabrir a operação de {formatDatePtBr(date)}?</AlertDialogTitle>
            <AlertDialogDescription>
              Os voos deste dia serão retirados temporariamente do Panorama, dos históricos e do
              Pitocador. As horas creditadas também serão estornadas. Ao encerrar novamente, os
              dados corrigidos serão consolidados uma única vez.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reopening}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={reopening} onClick={reopenCurrentOperation}>
              {reopening ? "Reabrindo…" : "Reabrir e retirar consolidação"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SortableAnnotatorRow({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: (dragHandle: React.ReactNode) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`${className ?? ""} ${isDragging ? "relative z-20 opacity-70 shadow-xl" : ""}`}
    >
      {children(
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Segure e arraste para mudar a ordem"
          aria-label="Arrastar voo para mudar a ordem"
          className="cursor-grab touch-none active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </Button>,
      )}
    </tr>
  );
}

function Cell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`border border-border px-1 py-1 ${className ?? ""}`}>{children}</td>;
}

function Counter({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between rounded border border-border px-3 py-2">
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-lg font-bold">{value}</span>
    </div>
  );
}

function PlainInput({
  value,
  placeholder,
  onCommit,
}: {
  value: string;
  placeholder?: string;
  onCommit: (v: string) => void;
}) {
  return (
    <input
      key={value}
      defaultValue={value}
      placeholder={placeholder}
      onBlur={(e) => {
        if (e.target.value !== value) onCommit(e.target.value);
      }}
      className="h-8 w-full min-w-0 rounded-sm border border-input bg-background px-2 text-sm outline-none focus:border-aviation focus:ring-1 focus:ring-aviation"
    />
  );
}

function TimeInput({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  return (
    <input
      key={value}
      defaultValue={value}
      placeholder="--:--"
      inputMode="numeric"
      onBlur={(e) => {
        const raw = e.target.value.trim().replace(/[^\d:]/g, "");
        const norm = /^\d{3,4}$/.test(raw)
          ? `${raw.slice(0, raw.length - 2).padStart(2, "0")}:${raw.slice(-2)}`
          : raw;
        if (norm !== value) onCommit(norm);
      }}
      className="h-8 w-full min-w-0 rounded-sm border border-input bg-background px-2 text-center text-sm outline-none focus:border-aviation focus:ring-1 focus:ring-aviation"
    />
  );
}

function Line({ k, v }: { k: string; v?: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-semibold">{v || "—"}</span>
    </div>
  );
}
