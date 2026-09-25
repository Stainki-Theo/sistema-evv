import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  ImagePlus,
  Loader2,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  AlertTriangle,
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
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFlights } from "@/lib/data";
import { readScheduleImage } from "@/lib/schedule-image-ocr";
import { syncEscalaDia, aceitarSugestao, descartarSugestao } from "@/lib/escala-sync";
import { todayISO, formatDatePtBr } from "@/lib/evv";

export const Route = createFileRoute("/_authenticated/escala")({
  head: () => ({
    meta: [
      { title: "Escala do Dia — EVV" },
      {
        name: "description",
        content:
          "Escala de voos do dia alimentada pela disponibilidade e pela próxima missão de cada integrante, com ajuste manual do escalante.",
      },
      { property: "og:title", content: "Escala do Dia — EVV" },
      { property: "og:description", content: "Quem irá voar hoje, com horários e missões." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EscalaPage,
});

type Draft = {
  time_planned: string;
  aluno: string;
  instrutor: string;
  missao: string;
  observacao: string;
};

function EscalaPage() {
  const [date, setDate] = useState(todayISO());
  const qc = useQueryClient();
  const { data: flights, isLoading } = useFlights(date);
  const fileRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [replace, setReplace] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const invalidate = () => qc.invalidateQueries({ queryKey: ["flights", date] });

  async function sincronizar(silencioso = false) {
    setSyncing(true);
    try {
      const r = await syncEscalaDia(date);
      await invalidate();
      if (r.motivo) {
        if (!silencioso) toast.error(r.motivo);
      } else if (!silencioso || r.criadas || r.atualizadas || r.conflitos.length) {
        const partes = [
          r.criadas ? `${r.criadas} incluído(s)` : "",
          r.atualizadas ? `${r.atualizadas} atualizado(s)` : "",
          r.removidas ? `${r.removidas} removido(s)` : "",
        ].filter(Boolean);
        if (partes.length) toast.success(`Escala sincronizada: ${partes.join(", ")}.`);
        else if (!silencioso) toast.success("Escala já está sincronizada.");
        for (const c of r.conflitos) {
          toast.warning(
            `Nova progressão detectada: ${c.aluno} avançou para ${c.sugerida}. A linha ajustada manualmente foi mantida.`,
          );
        }
      }
    } catch (e) {
      if (!silencioso) toast.error(e instanceof Error ? e.message : "Falha ao sincronizar.");
    }
    setSyncing(false);
  }

  // Sincronização automática ao abrir/trocar a data (sem sobrescrever ajustes manuais).
  useEffect(() => {
    void sincronizar(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function add() {
    const sort = (flights?.length ?? 0) + 1;
    const { error } = await supabase
      .from("flight_schedule")
      .insert({ op_date: date, sort_order: sort, origem: "MANUAL" });
    if (error) {
      toast.error(error.message);
      return;
    }
    await invalidate();
  }

  async function update(id: string, patch: Record<string, string | number>) {
    const { error } = await supabase
      .from("flight_schedule")
      .update({ ...patch, origem: "MANUAL" } as never)
      .eq("id", id);
    if (error) toast.error(error.message);
    else await invalidate();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("flight_schedule").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await invalidate();
    toast.success("Voo removido.");
  }

  async function move(index: number, dir: -1 | 1) {
    const list = flights ?? [];
    const a = list[index];
    const b = list[index + dir];
    if (!a || !b) return;
    await supabase
      .from("flight_schedule")
      .update({ sort_order: b.sort_order, origem: "MANUAL" } as never)
      .eq("id", a.id);
    await supabase
      .from("flight_schedule")
      .update({ sort_order: a.sort_order, origem: "MANUAL" } as never)
      .eq("id", b.id);
    await invalidate();
  }

  async function reorder(event: DragEndEvent) {
    const overId = event.over?.id;
    if (!overId || event.active.id === overId || !flights) return;
    const oldIndex = flights.findIndex((flight) => flight.id === event.active.id);
    const newIndex = flights.findIndex((flight) => flight.id === overId);
    if (oldIndex < 0 || newIndex < 0) return;

    const ordered = arrayMove(flights, oldIndex, newIndex);
    const results = await Promise.all(
      ordered.map((flight, index) =>
        supabase
          .from("flight_schedule")
          .update({ sort_order: index + 1, origem: "MANUAL" } as never)
          .eq("id", flight.id),
      ),
    );
    const failed = results.find((result) => result.error)?.error;
    if (failed) toast.error(failed.message);
    else {
      await invalidate();
      toast.success("Ordem dos voos atualizada.");
    }
  }

  async function onPickImage(file: File) {
    setReading(true);
    setReadingProgress(0);
    try {
      const rows = await readScheduleImage(file, setReadingProgress);
      if (!rows.length) {
        toast.error("Não reconheci linhas de voo. Use uma imagem nítida, mostrando os cabeçalhos IN, AL, Missão, Observações e os horários.");
        return;
      }
      setDrafts(rows);
      setReplace(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível ler a imagem.");
    } finally {
      setReading(false);
      setReadingProgress(0);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function setDraft(i: number, patch: Partial<Draft>) {
    setDrafts((d) => (d ? d.map((row, idx) => (idx === i ? { ...row, ...patch } : row)) : d));
  }

  async function confirmImport() {
    if (!drafts?.length) return;
    if (replace) {
      const { error } = await supabase.from("flight_schedule").delete().eq("op_date", date);
      if (error) {
        toast.error(error.message);
        return;
      }
    }
    const base = replace ? 0 : flights?.length ?? 0;
    const rows = drafts.map((d, i) => ({
      op_date: date,
      time_planned: d.time_planned,
      aluno: d.aluno,
      instrutor: d.instrutor,
      missao: d.missao,
      observacao: d.observacao,
      sort_order: base + i + 1,
      origem: "MANUAL",
    }));
    const { error } = await supabase.from("flight_schedule").insert(rows);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDrafts(null);
    await invalidate();
    toast.success(`${rows.length} voo(s) importado(s).`);
  }

  return (
    <>
      <PageHeader
        title="Escala do Dia"
        description={`Voos previstos — ${formatDatePtBr(date)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-40"
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onPickImage(file);
              }}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={reading}
              onClick={() => fileRef.current?.click()}
            >
              {reading ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="mr-1.5 h-4 w-4" />
              )}
              {reading ? `Lendo ${Math.round(readingProgress * 100)}%` : "Importar imagem ou PDF"}
            </Button>
            <Button variant="outline" size="sm" disabled={syncing} onClick={() => sincronizar()}>
              {syncing ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-4 w-4" />
              )}
              Sincronizar disponibilidade
            </Button>
            <Button onClick={add} size="sm">
              <Plus className="mr-1.5 h-4 w-4" /> Voo
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (flights ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum voo lançado para esta data. A escala é alimentada automaticamente pela
            Disponibilidade e pela Próxima Missão de cada integrante — ou lance manualmente.
          </CardContent>
        </Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => void reorder(event)}>
          <SortableContext items={flights!.map((flight) => flight.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
          {flights!.map((f, i) => (
            <SortableFlight key={f.id} id={f.id}>
              {(dragHandle) => <Card>
              <CardContent className="grid gap-3 p-4 sm:grid-cols-[2.5rem_6rem_repeat(4,minmax(0,1fr))_auto] sm:items-end">
                <div className="font-mono text-lg font-bold text-muted-foreground">{i + 1}</div>
                <Field label="Hora">
                  <Input
                    type="time"
                    defaultValue={f.time_planned?.slice(0, 5) ?? ""}
                    onBlur={(e) => update(f.id, { time_planned: e.target.value })}
                  />
                </Field>
                <Field label="Aluno / Piloto">
                  <Input
                    defaultValue={f.aluno}
                    onBlur={(e) => update(f.id, { aluno: e.target.value })}
                  />
                </Field>
                <Field label="Instrutor">
                  <Input
                    defaultValue={f.instrutor}
                    onBlur={(e) => update(f.id, { instrutor: e.target.value })}
                  />
                </Field>
                <Field label="Missão">
                  <Input
                    key={f.missao}
                    defaultValue={f.missao}
                    onBlur={(e) => update(f.id, { missao: e.target.value })}
                  />
                </Field>
                <Field label="Observação">
                  <Input
                    defaultValue={f.observacao}
                    onBlur={(e) => update(f.id, { observacao: e.target.value })}
                  />
                </Field>
                <div className="flex items-center gap-0.5">
                  {dragHandle}
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Subir voo"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Descer voo"
                    disabled={i === flights!.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remover voo"
                    onClick={() => remove(f.id)}
                  >
                    <Trash2 className="h-4 w-4 text-danger" />
                  </Button>
                </div>

                <div className="sm:col-span-7 flex flex-wrap items-center gap-2">
                  <StatusBadge tone={f.origem === "MANUAL" ? "warning" : "neutral"}>
                    {f.origem === "MANUAL" ? "Ajustado manualmente" : "Automático"}
                  </StatusBadge>
                  {f.missao_sugerida ? (
                    <div className="flex flex-wrap items-center gap-2 rounded border border-warning/50 bg-warning/10 px-2 py-1 text-xs">
                      <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                      <span>
                        Nova progressão detectada: integrante avançou para{" "}
                        <strong>{f.missao_sugerida}</strong>. Atualizar entrada da escala?
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await aceitarSugestao(f.id, f.missao_sugerida);
                          await invalidate();
                        }}
                      >
                        Atualizar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await descartarSugestao(f.id);
                          await invalidate();
                        }}
                      >
                        Manter alteração manual
                      </Button>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>}
            </SortableFlight>
          ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Dialog open={!!drafts} onOpenChange={(v) => !v && setDrafts(null)}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Revisar escala lida da imagem</DialogTitle>
            <DialogDescription>
              Confira e corrija os dados antes de salvar. Nada é gravado até você confirmar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {(drafts ?? []).map((d, i) => (
              <div
                key={i}
                className="grid gap-2 rounded border border-border p-3 sm:grid-cols-[2rem_5.5rem_repeat(4,minmax(0,1fr))_auto] sm:items-end"
              >
                <div className="font-mono text-sm font-bold text-muted-foreground">{i + 1}</div>
                <Field label="Hora">
                  <Input
                    value={d.time_planned}
                    onChange={(e) => setDraft(i, { time_planned: e.target.value })}
                  />
                </Field>
                <Field label="Aluno">
                  <Input value={d.aluno} onChange={(e) => setDraft(i, { aluno: e.target.value })} />
                </Field>
                <Field label="Instrutor">
                  <Input
                    value={d.instrutor}
                    onChange={(e) => setDraft(i, { instrutor: e.target.value })}
                  />
                </Field>
                <Field label="Missão">
                  <Input
                    value={d.missao}
                    onChange={(e) => setDraft(i, { missao: e.target.value })}
                  />
                </Field>
                <Field label="Observação">
                  <Input
                    value={d.observacao}
                    onChange={(e) => setDraft(i, { observacao: e.target.value })}
                  />
                </Field>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Descartar linha"
                  onClick={() => setDrafts((rows) => (rows ?? []).filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-4 w-4 text-danger" />
                </Button>
              </div>
            ))}
          </div>

          <DialogFooter className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={replace}
                onChange={(e) => setReplace(e.target.checked)}
              />
              Substituir a escala existente desta data
            </Label>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDrafts(null)}>
                Cancelar
              </Button>
              <Button onClick={confirmImport}>Salvar escala</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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

function SortableFlight({ id, children }: { id: string; children: (handle: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "relative z-20 opacity-70 shadow-xl" : undefined}
    >
      {children(
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Arrastar voo para mudar a ordem"
          title="Arraste para mudar a ordem"
          className="cursor-grab touch-none active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </Button>,
      )}
    </div>
  );
}
