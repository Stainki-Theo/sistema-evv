import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, Trash2, Plane, Lock, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth, displayName } from "@/lib/auth";
import { usePermissoes } from "@/lib/permissoes";
import { logChange } from "@/lib/audit";
import {
  useCalendarCategories,
  useCalendarEvents,
  useOpDaysRange,
  useOperacoesEfetivas,
  useDiretorias,
} from "@/lib/data";
import { ComboCreate } from "@/components/ComboCreate";
import { findSimilar, normalizeCompare } from "@/lib/categorias";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  MONTH_NAMES,
  WEEKDAY_SHORT,
  monthMatrix,
  monthRange,
  todayISO,
  formatDatePtBr,
  CATEGORIA_OPERACAO,
} from "@/lib/evv";

export const Route = createFileRoute("/_authenticated/calendario")({
  head: () => ({
    meta: [
      { title: "Calendário Operacional — EVV" },
      {
        name: "description",
        content:
          "Calendário mensal do voo a vela: operações, reuniões, instruções, manutenções e eventos, com filtros por categoria.",
      },
      { property: "og:title", content: "Calendário Operacional — EVV" },
      {
        property: "og:description",
        content: "Visão mensal das operações e compromissos do Esquadrão de Voo a Vela.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CalendarioPage,
});

const NEW_EVENT = {
  title: "",
  event_date: todayISO(),
  time_ref: "",
  description: "",
  category_id: "",
  responsavel: "",
};

function CalendarioPage() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const { canManageOps } = usePermissoes();
  const hoje = todayISO();
  const [cursor, setCursor] = useState(() => {
    const [y, m] = hoje.split("-").map(Number);
    return { year: y ?? 2026, month: m ?? 1 };
  });
  const [hidden, setHidden] = useState<string[]>([]);
  const [selected, setSelected] = useState(hoje);
  const [form, setForm] = useState(NEW_EVENT);

  const [editing, setEditing] = useState<null | {
    id: string;
    title: string;
    event_date: string;
    time_ref: string;
    description: string;
    category_id: string;
    diretoria_id: string;
  }>(null);

  const range = monthRange(cursor.year, cursor.month);
  const { data: categories } = useCalendarCategories();
  const { data: events } = useCalendarEvents(range.start, range.end);
  const { data: opDays } = useOpDaysRange(range.start, range.end);
  const { data: efetivas } = useOperacoesEfetivas(range.start, range.end);
  const { data: diretorias } = useDiretorias();

  const operacaoCat = useMemo(
    () => (categories ?? []).find((c) => c.nome === CATEGORIA_OPERACAO),
    [categories],
  );

  const catById = useMemo(() => {
    const map = new Map<string, { nome: string; cor: string }>();
    for (const c of categories ?? []) map.set(c.id, { nome: c.nome, cor: c.cor });
    return map;
  }, [categories]);

  type Item = {
    id: string;
    /** Id real da linha em op_days (apenas para operações automáticas). */
    opDayId?: string;
    title: string;
    date: string;
    time: string;
    description: string;
    categoria: string;
    category_id: string | null;
    diretoria_id: string | null;
    cor: string;
    responsavel: string;
    auto: boolean;
  };

  /**
   * Operações entram automaticamente no calendário apenas com evidência real:
   * - dias passados: precisa de atividade efetiva na Planilha do Anotador;
   * - hoje/futuro: precisa de briefing agendado explicitamente.
   * Disponibilidade, escala e meteorologia não criam operação por si.
   */
  const items: Item[] = useMemo(() => {
    const manual = (events ?? []).map((e) => {
      const cat = e.category_id ? catById.get(e.category_id) : undefined;
      return {
        id: e.id,
        title: e.title || "Evento",
        date: String(e.event_date),
        time: e.time_ref || "",
        description: e.description || "",
        categoria: cat?.nome ?? "Outros",
        category_id: e.category_id ?? null,
        diretoria_id: (e as { diretoria_id?: string | null }).diretoria_id ?? null,
        cor: cat?.cor ?? "#475569",
        responsavel: e.responsavel || "",
        auto: false,
      };
    });
    const autos = (opDays ?? [])
      .filter(
        (d) => !manual.some((m) => m.date === String(d.op_date) && m.categoria === CATEGORIA_OPERACAO),
      )
      .map((d) => {
        const date = String(d.op_date);
        const briefing = (d.briefing_time || "").slice(0, 5);
        const realizada = efetivas?.has(date) ?? false;
        const passado = date < hoje;
        if (passado && !realizada) return null;
        if (!passado && !realizada && !briefing) return null;
        const prevista = !realizada;
        return {
          id: `op-${d.id}`,
          opDayId: d.id,
          title: prevista ? "Operação prevista" : "Operação realizada",
          date,
          time: briefing,
          description: prevista
            ? briefing
              ? `Prevista · briefing às ${briefing}`
              : "Prevista (sem voos registrados)"
            : briefing
              ? `Briefing às ${briefing} · voos registrados na planilha`
              : "Voos registrados na planilha do anotador",
          categoria: CATEGORIA_OPERACAO,
          category_id: null,
          diretoria_id: null,
          cor: operacaoCat?.cor ?? "#1d4ed8",
          responsavel: "",
          auto: true,
        } as Item;
      })
      .filter((i): i is Item => !!i);
    return [...autos, ...manual].sort((a, b) =>
      a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date),
    );
  }, [events, opDays, efetivas, catById, operacaoCat, hoje]);

  const visible = items.filter((i) => !hidden.includes(i.categoria));
  const byDate = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const i of visible) map.set(i.date, [...(map.get(i.date) ?? []), i]);
    return map;
  }, [visible]);

  const weeks = monthMatrix(cursor.year, cursor.month);
  const doDia = byDate.get(selected) ?? [];

  function shift(delta: number) {
    setCursor((c) => {
      const m = c.month + delta;
      if (m < 1) return { year: c.year - 1, month: 12 };
      if (m > 12) return { year: c.year + 1, month: 1 };
      return { year: c.year, month: m };
    });
  }

  function toggleCategoria(nome: string) {
    setHidden((h) => (h.includes(nome) ? h.filter((n) => n !== nome) : [...h, nome]));
  }

  const invalidate = () => qc.invalidateQueries({ queryKey: ["calendar_events"] });

  async function addEvent() {
    if (!form.title.trim()) {
      toast.error("Informe o título do evento.");
      return;
    }
    const { data, error } = await supabase
      .from("calendar_events")
      .insert({
        title: form.title.trim(),
        event_date: form.event_date,
        time_ref: form.time_ref,
        description: form.description,
        category_id: form.category_id || null,
        responsavel: form.responsavel,
        created_by: profile?.id ?? null,
        created_by_name: displayName(profile),
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    await logChange(
      {
        area: "CALENDARIO",
        entity: "calendar_events",
        entityId: data.id,
        entityLabel: form.title.trim(),
        action: "INSERT",
        newValue: `${formatDatePtBr(form.event_date)} · ${form.title.trim()}`,
        opDate: form.event_date,
      },
      { id: profile?.id, tag: displayName(profile) },
    );
    setForm({ ...NEW_EVENT, event_date: form.event_date });
    await invalidate();
    toast.success("Evento adicionado ao calendário.");
  }

  async function removeEvent(item: Item) {
    const { data: snapshot } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("id", item.id)
      .maybeSingle();
    const { error } = await supabase.from("calendar_events").delete().eq("id", item.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logChange(
      {
        area: "CALENDARIO",
        entity: "calendar_events",
        entityId: item.id,
        entityLabel: item.title,
        action: "DELETE",
        oldValue: `${formatDatePtBr(item.date)} · ${item.title}`,
        opDate: item.date,
        details: { snapshot },
      },
      { id: profile?.id, tag: displayName(profile) },
    );
    await invalidate();
  }

  /**
   * Remove somente o registro do dia de operação (op_days) do calendário.
   * Planilha do anotador, meteorologia, escala, avisos e histórico daquela data
   * permanecem intactos — exclusão de dados reais é feita nas próprias abas.
   */
  async function removeOperacao(item: Item) {
    if (!item.opDayId) return;
    const ok = window.confirm(
      `Remover a operação de ${formatDatePtBr(item.date)} do calendário?\n\n` +
        "Somente o registro do dia (briefing) é apagado. Planilha do anotador, meteorologia, " +
        "escala, funções, avisos e histórico daquela data NÃO são apagados.",
    );
    if (!ok) return;
    const { data: snapshot } = await supabase
      .from("op_days")
      .select("*")
      .eq("id", item.opDayId)
      .maybeSingle();
    const { error } = await supabase.from("op_days").delete().eq("id", item.opDayId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logChange(
      {
        area: "CALENDARIO",
        entity: "op_days",
        entityId: item.opDayId,
        entityLabel: `Operação de ${formatDatePtBr(item.date)}`,
        action: "DELETE",
        oldValue: `${formatDatePtBr(item.date)} · ${item.title}`,
        opDate: item.date,
        details: { snapshot },
      },
      { id: profile?.id, tag: displayName(profile) },
    );
    await qc.invalidateQueries({ queryKey: ["op_days"] });
    toast.success("Operação removida do calendário. Nenhum dado operacional foi apagado.");
  }



  const CATEGORY_COLORS = [
    "#1d4ed8", "#0f766e", "#b45309", "#7c3aed", "#be123c", "#0891b2", "#4d7c0f", "#a21caf",
  ];

  async function createCategory(label: string): Promise<string | null> {
    const trimmed = label.trim();
    if (!trimmed) return null;
    const similar = findSimilar(categories ?? [], (c) => c.nome, trimmed);
    if (similar) {
      const confirmar = window.confirm(
        `Já existe uma categoria semelhante ("${similar.nome}"). Deseja mesmo criar "${trimmed}" como uma categoria nova?`,
      );
      if (!confirmar) return null;
    }
    const cor: string =
      CATEGORY_COLORS[(categories?.length ?? 0) % CATEGORY_COLORS.length] ?? "#475569";
    const { data, error } = await supabase
      .from("calendar_categories")
      .insert({
        nome: trimmed,
        cor,

        sort_order: (categories?.length ?? 0) + 1,
        active: true,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return null;
    }
    await logChange(
      {
        area: "CALENDARIO",
        entity: "calendar_categories",
        entityId: data.id,
        entityLabel: trimmed,
        action: "INSERT",
        newValue: trimmed,
      },
      { id: profile?.id, tag: displayName(profile) },
    );
    await qc.invalidateQueries({ queryKey: ["calendar_categories"] });
    toast.success("Categoria criada.");
    return data.id as string;
  }

  function openEdit(item: Item) {
    setEditing({
      id: item.id,
      title: item.title,
      event_date: item.date,
      time_ref: item.time,
      description: item.description,
      category_id: item.category_id ?? "",
      diretoria_id: item.diretoria_id ?? "",
    });
  }

  async function saveEdit() {
    if (!editing) return;
    const { data: before } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("id", editing.id)
      .maybeSingle();
    const payload = {
      title: editing.title.trim(),
      event_date: editing.event_date,
      time_ref: editing.time_ref,
      description: editing.description,
      category_id: editing.category_id || null,
      diretoria_id: editing.diretoria_id || null,
    };
    const { error } = await supabase.from("calendar_events").update(payload).eq("id", editing.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (before) {
      const campos: { key: keyof typeof payload; label: string }[] = [
        { key: "title", label: "Título" },
        { key: "event_date", label: "Data" },
        { key: "time_ref", label: "Horário" },
        { key: "description", label: "Descrição" },
        { key: "category_id", label: "Categoria" },
        { key: "diretoria_id", label: "Diretoria" },
      ];
      for (const campo of campos) {
        const antigo = (before as Record<string, unknown>)[campo.key] ?? "";
        const novo = payload[campo.key] ?? "";
        if (String(antigo ?? "") !== String(novo ?? "")) {
          await logChange(
            {
              area: "CALENDARIO",
              entity: "calendar_events",
              entityId: editing.id,
              entityLabel: payload.title,
              action: "UPDATE",
              field: campo.key,
              fieldLabel: campo.label,
              oldValue: String(antigo ?? "") || "(vazio)",
              newValue: String(novo ?? "") || "(vazio)",
              opDate: payload.event_date,
            },
            { id: profile?.id, tag: displayName(profile) },
          );
        }
      }
    }
    setEditing(null);
    await invalidate();
    toast.success("Evento atualizado.");
  }

  return (
    <>
      <PageHeader
        title="Calendário Operacional"
        description={`${MONTH_NAMES[cursor.month - 1]} de ${cursor.year}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" aria-label="Mês anterior" onClick={() => shift(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const [y, m] = hoje.split("-").map(Number);
                setCursor({ year: y ?? 2026, month: m ?? 1 });
                setSelected(hoje);
              }}
            >
              Hoje
            </Button>
            <Button variant="outline" size="icon" aria-label="Próximo mês" onClick={() => shift(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="min-w-0">
          <CardContent className="p-3">
            <div className="mb-3 flex flex-wrap gap-2">
              {(categories ?? []).map((c) => {
                const off = hidden.includes(c.nome);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCategoria(c.nome)}
                    aria-pressed={!off}
                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition ${
                      off ? "border-border text-muted-foreground opacity-60" : "border-transparent"
                    }`}
                    style={off ? undefined : { backgroundColor: `${c.cor}22`, color: c.cor }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.cor }} />
                    {c.nome}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {WEEKDAY_SHORT.map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {weeks.flat().map((cell) => {
                const dayItems = byDate.get(cell.iso) ?? [];
                const isToday = cell.iso === hoje;
                const isSel = cell.iso === selected;
                return (
                  <button
                    key={cell.iso}
                    type="button"
                    onClick={() => setSelected(cell.iso)}
                    className={`min-h-20 rounded border p-1 text-left align-top transition ${
                      isSel ? "border-aviation ring-1 ring-aviation" : "border-border"
                    } ${cell.inMonth ? "bg-background" : "bg-muted/30 text-muted-foreground"} hover:bg-muted/50`}
                  >
                    <span
                      className={`inline-flex h-5 min-w-5 items-center justify-center rounded px-1 font-mono text-[11px] ${
                        isToday ? "bg-aviation font-bold text-aviation-foreground" : ""
                      }`}
                    >
                      {Number(cell.iso.slice(-2))}
                    </span>
                    <span className="mt-1 flex flex-col gap-0.5">
                      {dayItems.slice(0, 3).map((i) => (
                        <span
                          key={i.id}
                          className="truncate rounded px-1 text-[10px] font-semibold"
                          style={{ backgroundColor: `${i.cor}22`, color: i.cor }}
                        >
                          {i.time ? `${i.time} ` : ""}
                          {i.title}
                        </span>
                      ))}
                      {dayItems.length > 3 && (
                        <span className="px-1 text-[10px] text-muted-foreground">
                          +{dayItems.length - 3}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
                {formatDatePtBr(selected)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {doDia.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum compromisso neste dia.</p>
              )}
              {doDia.map((i) => (
                <div key={i.id} className="rounded border border-border p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span
                        className="inline-flex items-center gap-1 rounded px-1.5 text-[10px] font-bold uppercase tracking-wider"
                        style={{ backgroundColor: `${i.cor}22`, color: i.cor }}
                      >
                        {i.auto && <Plane className="h-3 w-3" />}
                        {i.categoria}
                      </span>
                      <p className="mt-1 font-semibold">
                        {i.time && <span className="mr-1.5 font-mono text-sm">{i.time}</span>}
                        {i.title}
                      </p>
                      {i.description && (
                        <p className="text-sm text-muted-foreground">{i.description}</p>
                      )}
                      {i.responsavel && (
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          Responsável: {i.responsavel}
                        </p>
                      )}
                    </div>
                    {i.auto ? (
                      canManageOps && i.opDayId ? (
                        <button
                          type="button"
                          aria-label="Excluir operação do calendário"
                          title="Excluir operação do calendário (não apaga dados da operação)"
                          onClick={() => removeOperacao(i)}
                          className="grid h-8 w-8 shrink-0 place-items-center rounded hover:bg-muted"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-danger" />
                        </button>
                      ) : (
                        <span
                          title="Evento automático gerado pela operação — não editável aqui"
                          className="grid h-8 w-8 shrink-0 place-items-center rounded text-muted-foreground"
                        >
                          <Lock className="h-3.5 w-3.5" />
                        </span>
                      )
                    ) : (
                      canManageOps && (
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            aria-label="Editar evento"
                            onClick={() => openEdit(i)}
                            className="grid h-8 w-8 place-items-center rounded hover:bg-muted"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Remover evento"
                            onClick={() => removeEvent(i)}
                            className="grid h-8 w-8 place-items-center rounded hover:bg-muted"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-danger" />
                          </button>
                        </div>
                      )
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
                {canManageOps ? <Plus className="h-4 w-4" /> : <Lock className="h-4 w-4" />} Novo
                evento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {canManageOps ? (
                <>
                  <Field label="Título">
                    <Input
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="ex.: Reunião de Diretoria"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Data">
                      <Input
                        type="date"
                        value={form.event_date}
                        onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                      />
                    </Field>
                    <Field label="Hora">
                      <Input
                        value={form.time_ref}
                        onChange={(e) => setForm({ ...form, time_ref: e.target.value })}
                        placeholder="08:00"
                      />
                    </Field>
                  </div>
                  <Field label="Categoria">
                    <ComboCreate
                      value={form.category_id}
                      options={(categories ?? []).map((c) => ({ value: c.id, label: c.nome, cor: c.cor }))}
                      placeholder="Selecionar categoria"
                      allowCreate={canManageOps}
                      onSelect={(v) => setForm({ ...form, category_id: v })}
                      onCreate={async (label) => {
                        const id = await createCategory(label);
                        if (id) setForm((f) => ({ ...f, category_id: id }));
                      }}
                    />
                  </Field>
                  <Field label="Responsável">
                    <Input
                      value={form.responsavel}
                      onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
                    />
                  </Field>
                  <Field label="Detalhes">
                    <Textarea
                      rows={2}
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                    />
                  </Field>
                  <Button className="w-full" onClick={addEvent}>
                    <Plus className="mr-1.5 h-4 w-4" /> Adicionar
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Somente Administração, Presidência, Supervisão e Diretores podem incluir eventos.
                  A visualização está liberada para todos.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar evento</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-2">
              <Field label="Título">
                <Input
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Data">
                  <Input
                    type="date"
                    value={editing.event_date}
                    onChange={(e) => setEditing({ ...editing, event_date: e.target.value })}
                  />
                </Field>
                <Field label="Hora">
                  <Input
                    value={editing.time_ref}
                    onChange={(e) => setEditing({ ...editing, time_ref: e.target.value })}
                    placeholder="08:00"
                  />
                </Field>
              </div>
              <Field label="Categoria">
                <ComboCreate
                  value={editing.category_id}
                  options={(categories ?? []).map((c) => ({ value: c.id, label: c.nome, cor: c.cor }))}
                  placeholder="Selecionar categoria"
                  allowCreate={canManageOps}
                  onSelect={(v) => setEditing({ ...editing, category_id: v })}
                  onCreate={async (label) => {
                    const id = await createCategory(label);
                    if (id) setEditing((cur) => (cur ? { ...cur, category_id: id } : cur));
                  }}
                />
              </Field>
              <Field label="Diretoria relacionada">
                <ComboCreate
                  value={editing.diretoria_id}
                  options={(diretorias ?? []).map((d) => ({ value: d.id, label: d.nome }))}
                  placeholder="Nenhuma"
                  onSelect={(v) => setEditing({ ...editing, diretoria_id: v })}
                />
              </Field>
              <Field label="Detalhes">
                <Textarea
                  rows={3}
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={saveEdit}>Salvar alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
