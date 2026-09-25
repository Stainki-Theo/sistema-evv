import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Lock, Pencil, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { PhotoAvatar } from "@/components/PhotoAvatar";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  adjustProfileFlightMinutes,
  isPitocadorTimeCredited,
  markPitocadorTimeCredited,
  usePitocador,
  useProfiles,
  useAllAnnotatorFlights,
} from "@/lib/data";
import { statsPorPessoa } from "@/lib/estatisticas";
import { useAuth, displayName } from "@/lib/auth";
import { minutesToClock, personTag, formatDatePtBr, todayISO, hoursToMinutes } from "@/lib/evv";
import { logChange } from "@/lib/audit";
import { categoriaDe, parseMissao } from "@/lib/missao";
import { operationalLevelLabel } from "@/lib/categorias";

export const Route = createFileRoute("/_authenticated/pitocador")({
  head: () => ({
    meta: [
      { title: "Pitocador — Ficha de Instrução | EVV" },
      {
        name: "description",
        content:
          "Ficha de instrução privada do EVV: lançamento de missões, instrutor, tempo de voo e grau de 1 a 6 por integrante.",
      },
      { property: "og:title", content: "Pitocador — Ficha de Instrução | EVV" },
      {
        property: "og:description",
        content: "Acompanhamento individual de instrução com graus de 1 a 6 e histórico de voos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PitocadorPage,
});

const GRAUS = [
  { value: 1, label: "1 — Voo perigoso" },
  { value: 2, label: "2 — Insuficiente" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5" },
  { value: 6, label: "6" },
];

const FASES_INSTRUCAO = [
  { value: "TODAS", label: "Todas as fases" },
  { value: "PS", label: "Pré-Solo (PS)" },
  { value: "RPS", label: "Revalidação (RPS)" },
  { value: "AP", label: "Aperfeiçoamento (AP)" },
  { value: "X", label: "Cross-country (X)" },
  { value: "OUTRA", label: "Outras missões" },
] as const;

function faseDaMissao(missao?: string | null) {
  return categoriaDe(parseMissao(missao).base);
}

function grauLabel(grau?: number | null) {
  if (!grau) return "—";
  return GRAUS.find((g) => g.value === grau)?.label ?? String(grau);
}

function grauTone(grau?: number | null) {
  if (!grau) return "neutral" as const;
  if (grau <= 2) return "danger" as const;
  if (grau === 3) return "warning" as const;
  return "success" as const;
}

type EntryForm = {
  op_date: string;
  missao: string;
  horas: string;
  grau: string;
  instrutor_tag: string;
  observacao: string;
};

const EMPTY_FORM: EntryForm = {
  op_date: todayISO(),
  missao: "",
  horas: "",
  grau: "",
  instrutor_tag: "",
  observacao: "",
};

function PitocadorPage() {
  const qc = useQueryClient();
  const { profile, isAdmin, refresh } = useAuth();
  const { data: profiles } = useProfiles();
  const { data: flights } = useAllAnnotatorFlights();

  const souInstrutor = !!profile?.instrutor;
  const cargo = (profile?.cargo ?? "").trim();
  const souSupervisao = cargo === "Supervisão" || cargo === "Presidente";
  const podeVerOutros = isAdmin || souInstrutor || souSupervisao;
  const podeEditar = podeVerOutros;

  const [alvo, setAlvo] = useState(profile?.id ?? "");
  useEffect(() => {
    if (!alvo && profile?.id) setAlvo(profile.id);
  }, [alvo, profile?.id]);

  const alvoProfile = (profiles ?? []).find((p) => p.id === alvo) ?? profile;
  const instrutorReferencia = (profiles ?? []).find((p) => p.id === alvoProfile?.in_pessoal_id);
  const { data: entries, isLoading } = usePitocador(alvo || undefined);
  const [faseSelecionada, setFaseSelecionada] = useState("TODAS");

  const filteredEntries = useMemo(
    () =>
      (entries ?? []).filter(
        (entry) => faseSelecionada === "TODAS" || faseDaMissao(entry.missao) === faseSelecionada,
      ),
    [entries, faseSelecionada],
  );

  const stats = useMemo(() => statsPorPessoa(flights, profiles), [flights, profiles]);
  const meu = stats.get(alvo);

  const media = useMemo(() => {
    const graus = filteredEntries.map((e) => e.grau).filter((g): g is number => !!g);
    if (!graus.length) return null;
    return graus.reduce((a, b) => a + b, 0) / graus.length;
  }, [filteredEntries]);
  const faseLabel = FASES_INSTRUCAO.find((fase) => fase.value === faseSelecionada)?.label ?? "Fase";

  const [form, setForm] = useState<EntryForm>(EMPTY_FORM);

  async function addEntry() {
    if (!alvo) return;
    const insertRow = {
      profile_id: alvo,
      op_date: form.op_date || todayISO(),
      missao: form.missao.trim(),
      minutes: hoursToMinutes(form.horas || "0:00"),
      grau: form.grau ? Number(form.grau) : null,
      instrutor_tag: form.instrutor_tag.trim() || (souInstrutor ? displayName(profile) : ""),
      instrutor_id: souInstrutor ? (profile?.id ?? null) : null,
      observacao: form.observacao.trim(),
      created_by: profile?.id ?? null,
      created_by_name: displayName(profile),
    };
    const { data, error } = await supabase
      .from("pitocador_entries")
      .insert(insertRow as never)
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    let minutesCredited = false;
    try {
      await adjustProfileFlightMinutes(alvo, insertRow.minutes);
      minutesCredited = true;
      await markPitocadorTimeCredited((data as { id: string }).id);
    } catch (creditError) {
      if (minutesCredited) {
        await adjustProfileFlightMinutes(alvo, -insertRow.minutes).catch(() => undefined);
      }
      await supabase
        .from("pitocador_entries")
        .delete()
        .eq("id", (data as { id: string }).id);
      toast.error(
        creditError instanceof Error
          ? creditError.message
          : "Não foi possível acrescentar o tempo às horas totais.",
      );
      return;
    }
    await logChange(
      {
        area: "PITOCADOR",
        entity: "pitocador_entries",
        entityId: (data as { id: string })?.id ?? "",
        entityLabel: `${personTag(alvoProfile)} — ${insertRow.missao || "lançamento"}`,
        action: "INSERT",
        opDate: insertRow.op_date,
        newValue: `${insertRow.missao} · grau ${insertRow.grau ?? "—"}`,
      },
      { id: profile?.id, tag: displayName(profile) },
    );
    setForm(EMPTY_FORM);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["pitocador", alvo] }),
      qc.invalidateQueries({ queryKey: ["profiles"] }),
      alvo === profile?.id ? refresh() : Promise.resolve(),
    ]);
    toast.success("Lançamento registrado e tempo acrescentado às horas totais.");
  }

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EntryForm | null>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);

  function startEdit(entry: NonNullable<typeof entries>[number]) {
    setEditingId(entry.id);
    setEditForm({
      op_date: entry.op_date,
      missao: entry.missao || "",
      horas: minutesToClock(entry.minutes),
      grau: entry.grau ? String(entry.grau) : "",
      instrutor_tag: entry.instrutor_tag || "",
      observacao: entry.observacao || "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
  }

  async function saveEdit(entry: NonNullable<typeof entries>[number]) {
    if (!editForm) return;
    const updateRow = {
      op_date: editForm.op_date || entry.op_date,
      missao: editForm.missao.trim(),
      minutes: hoursToMinutes(editForm.horas || "0:00"),
      grau: editForm.grau ? Number(editForm.grau) : null,
      instrutor_tag: editForm.instrutor_tag.trim(),
      observacao: editForm.observacao.trim(),
    };
    const { error } = await supabase
      .from("pitocador_entries")
      .update(updateRow as never)
      .eq("id", entry.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!entry.flight_id && (await isPitocadorTimeCredited(entry.id))) {
      try {
        await adjustProfileFlightMinutes(alvo, updateRow.minutes - entry.minutes);
      } catch (creditError) {
        await supabase
          .from("pitocador_entries")
          .update({
            op_date: entry.op_date,
            missao: entry.missao,
            minutes: entry.minutes,
            grau: entry.grau,
            instrutor_tag: entry.instrutor_tag,
            observacao: entry.observacao,
          })
          .eq("id", entry.id);
        toast.error(
          creditError instanceof Error
            ? creditError.message
            : "Não foi possível ajustar as horas totais.",
        );
        return;
      }
    }
    await logChange(
      {
        area: "PITOCADOR",
        entity: "pitocador_entries",
        entityId: entry.id,
        entityLabel: `${personTag(alvoProfile)} — ${updateRow.missao || "lançamento"}`,
        action: "UPDATE",
        opDate: updateRow.op_date,
        oldValue: `${entry.missao} · ${minutesToClock(entry.minutes)} · grau ${entry.grau ?? "—"}`,
        newValue: `${updateRow.missao} · ${minutesToClock(updateRow.minutes)} · grau ${updateRow.grau ?? "—"}`,
      },
      { id: profile?.id, tag: displayName(profile) },
    );
    cancelEdit();
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["pitocador", alvo] }),
      qc.invalidateQueries({ queryKey: ["profiles"] }),
      alvo === profile?.id ? refresh() : Promise.resolve(),
    ]);
    toast.success("Lançamento atualizado.");
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const entry = (entries ?? []).find((e) => e.id === toDelete);
    const { error } = await supabase.from("pitocador_entries").delete().eq("id", toDelete);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (entry) {
      try {
        await adjustProfileFlightMinutes(alvo, -entry.minutes);
      } catch (creditError) {
        await supabase.from("pitocador_entries").insert(entry as never);
        toast.error(
          creditError instanceof Error
            ? creditError.message
            : "Não foi possível ajustar as horas totais.",
        );
        return;
      }
    }
    if (entry) {
      await logChange(
        {
          area: "PITOCADOR",
          entity: "pitocador_entries",
          entityId: entry.id,
          entityLabel: `${personTag(alvoProfile)} — ${entry.missao || "lançamento"}`,
          action: "DELETE",
          opDate: entry.op_date,
          oldValue: `${entry.missao} · ${minutesToClock(entry.minutes)} · grau ${entry.grau ?? "—"}`,
        },
        { id: profile?.id, tag: displayName(profile) },
      );
    }
    setToDelete(null);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["pitocador", alvo] }),
      qc.invalidateQueries({ queryKey: ["profiles"] }),
      alvo === profile?.id ? refresh() : Promise.resolve(),
    ]);
    toast.success("Lançamento excluído e horas totais atualizadas.");
  }

  return (
    <>
      <PageHeader
        title="Pitocador"
        description="Ficha de instrução individual — visível apenas para você, instrutores e a supervisão"
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <PhotoAvatar
            path={alvoProfile?.avatar_path ?? null}
            alt={`Foto de ${personTag(alvoProfile)}`}
            fallback={alvoProfile?.tri ?? ""}
            className="h-16 w-16 shrink-0"
          />
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">
              {alvoProfile?.war_name || personTag(alvoProfile)}
            </p>
            <p className="truncate text-xs font-mono uppercase text-muted-foreground">
              {alvoProfile?.tri || "—"}
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-2">
            <Mini label="IN" value={instrutorReferencia ? personTag(instrutorReferencia) : "—"} />
            <Mini label="Nível Op." value={operationalLevelLabel(alvoProfile?.nivel_operacional) || "—"} />
            <Mini label="Próx. missão" value={alvoProfile?.proxima_missao || "—"} />
            <Mini label="Horas" value={minutesToClock(alvoProfile?.flight_minutes ?? 0)} />
            <Mini
              label={faseSelecionada === "TODAS" ? "Grau médio geral" : `Média ${faseSelecionada}`}
              value={media ? media.toFixed(1) : "—"}
            />
            <Mini label="OPS" value={String(meu?.ops ?? 0)} />
            <Mini label="Pousos" value={String(meu?.pousos ?? 0)} />
          </div>
        </CardContent>
      </Card>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        {podeVerOutros && (
          <div>
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Ficha do integrante
            </Label>
            <Select value={alvo} onValueChange={setAlvo}>
              <SelectTrigger className="mt-1 w-72">
                <SelectValue placeholder="Selecionar integrante" />
              </SelectTrigger>
              <SelectContent>
                {(profiles ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {personTag(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Fase da instrução
          </Label>
          <Select value={faseSelecionada} onValueChange={setFaseSelecionada}>
            <SelectTrigger className="mt-1 w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FASES_INSTRUCAO.map((fase) => (
                <SelectItem key={fase.value} value={fase.value}>
                  {fase.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="pb-2 text-xs text-muted-foreground">Média exibida: {faseLabel}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
              Lançamentos de instrução
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <p className="p-4 text-sm text-muted-foreground">Carregando…</p>
            ) : filteredEntries.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Nenhum lançamento nesta fase.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[52rem] border-collapse text-sm">
                  <thead className="border-b border-border bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="border border-border p-2 text-left">Data</th>
                      <th className="border border-border p-2 text-left">Missão</th>
                      <th className="border border-border p-2 text-left">IN</th>
                      <th className="border border-border p-2 text-left">Tempo</th>
                      <th className="border border-border p-2 text-left">Grau</th>
                      <th className="border border-border p-2 text-left">Observação</th>
                      <th className="border border-border p-2 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.map((e) => {
                      const isEditing = editingId === e.id;
                      if (isEditing && editForm) {
                        return (
                          <tr key={e.id} className="align-top">
                            <td className="border border-border p-1.5">
                              <Input
                                type="date"
                                className="h-8"
                                disabled={!!e.flight_id}
                                value={editForm.op_date}
                                onChange={(ev) =>
                                  setEditForm({ ...editForm, op_date: ev.target.value })
                                }
                              />
                            </td>
                            <td className="border border-border p-1.5">
                              <Input
                                className="h-8"
                                disabled={!!e.flight_id}
                                value={editForm.missao}
                                onChange={(ev) =>
                                  setEditForm({ ...editForm, missao: ev.target.value })
                                }
                              />
                            </td>
                            <td className="border border-border p-1.5">
                              <Input
                                className="h-8"
                                placeholder="TRI do instrutor"
                                disabled={!!e.flight_id}
                                value={editForm.instrutor_tag}
                                onChange={(ev) =>
                                  setEditForm({ ...editForm, instrutor_tag: ev.target.value })
                                }
                              />
                            </td>
                            <td className="border border-border p-1.5">
                              <Input
                                className="h-8 font-mono"
                                placeholder="0:35"
                                disabled={!!e.flight_id}
                                value={editForm.horas}
                                onChange={(ev) =>
                                  setEditForm({ ...editForm, horas: ev.target.value })
                                }
                              />
                            </td>
                            <td className="border border-border p-1.5">
                              <Select
                                value={editForm.grau}
                                onValueChange={(v) => setEditForm({ ...editForm, grau: v })}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Grau" />
                                </SelectTrigger>
                                <SelectContent>
                                  {GRAUS.map((g) => (
                                    <SelectItem key={g.value} value={String(g.value)}>
                                      {g.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="border border-border p-1.5">
                              <Textarea
                                rows={1}
                                className="min-h-8"
                                value={editForm.observacao}
                                onChange={(ev) =>
                                  setEditForm({ ...editForm, observacao: ev.target.value })
                                }
                              />
                            </td>
                            <td className="border border-border p-1.5">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  aria-label="Salvar"
                                  onClick={() => saveEdit(e)}
                                  className="grid h-8 w-8 place-items-center rounded hover:bg-muted"
                                >
                                  <Check className="h-3.5 w-3.5 text-success" />
                                </button>
                                <button
                                  type="button"
                                  aria-label="Cancelar"
                                  onClick={cancelEdit}
                                  className="grid h-8 w-8 place-items-center rounded hover:bg-muted"
                                >
                                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={e.id} className="align-top">
                          <td className="border border-border p-2 font-mono">
                            {formatDatePtBr(e.op_date)}
                          </td>
                          <td className="border border-border p-2 font-semibold">
                            {e.missao || "—"}
                          </td>
                          <td className="border border-border p-2 text-muted-foreground">
                            {e.instrutor_tag || "—"}
                          </td>
                          <td className="border border-border p-2 font-mono">
                            {minutesToClock(e.minutes)}
                          </td>
                          <td className="border border-border p-2">
                            <StatusBadge tone={grauTone(e.grau)}>{grauLabel(e.grau)}</StatusBadge>
                          </td>
                          <td className="max-w-64 border border-border p-2 text-muted-foreground">
                            {e.observacao || "—"}
                          </td>
                          <td className="border border-border p-2">
                            {podeEditar ? (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  aria-label="Editar lançamento"
                                  onClick={() => startEdit(e)}
                                  className="grid h-8 w-8 place-items-center rounded hover:bg-muted"
                                >
                                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                </button>
                                <button
                                  type="button"
                                  aria-label="Excluir lançamento"
                                  onClick={() => setToDelete(e.id)}
                                  className="grid h-8 w-8 place-items-center rounded hover:bg-muted"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-danger" />
                                </button>
                              </div>
                            ) : (
                              <span className="block text-center text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
              Novo lançamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Data">
              <Input
                type="date"
                value={form.op_date}
                onChange={(e) => setForm({ ...form, op_date: e.target.value })}
              />
            </Field>
            <Field label="Missão">
              <Input
                placeholder="ex.: PS-13"
                value={form.missao}
                onChange={(e) => setForm({ ...form, missao: e.target.value })}
              />
            </Field>
            <Field label="Tempo de voo (h:mm)">
              <Input
                className="font-mono"
                placeholder="0:35"
                value={form.horas}
                onChange={(e) => setForm({ ...form, horas: e.target.value })}
              />
            </Field>
            <Field label="Grau (1 a 6)">
              <Select value={form.grau} onValueChange={(v) => setForm({ ...form, grau: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar grau" />
                </SelectTrigger>
                <SelectContent>
                  {GRAUS.map((g) => (
                    <SelectItem key={g.value} value={String(g.value)}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Instrutor (IN)">
              <Input
                placeholder="TRI do instrutor"
                value={form.instrutor_tag}
                onChange={(e) => setForm({ ...form, instrutor_tag: e.target.value })}
              />
            </Field>
            <Field label="Observação da instrução">
              <Textarea
                rows={3}
                placeholder="Pontos fortes, itens a melhorar…"
                value={form.observacao}
                onChange={(e) => setForm({ ...form, observacao: e.target.value })}
              />
            </Field>
            <Button className="w-full" onClick={addEntry}>
              <Plus className="mr-1.5 h-4 w-4" /> Lançar na ficha
            </Button>
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Esta ficha é privada: apenas o próprio integrante, instrutores, a supervisão e a
              administração têm acesso.
            </p>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o lançamento da ficha de instrução e desconta o tempo de voo das
              horas totais do integrante. Não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Confirmar exclusão</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="font-mono text-sm font-bold">{value}</p>
    </div>
  );
}
