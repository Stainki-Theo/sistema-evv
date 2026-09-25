import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth, displayName } from "@/lib/auth";
import { useAnnouncements } from "@/lib/data";
import {
  PRIORITY_OPTIONS,
  priority,
  todayISO,
  nowHHMM,
  formatDatePtBr,
  formatDateTime,
  AVISO_SCOPE,
} from "@/lib/evv";

export const Route = createFileRoute("/_authenticated/avisos")({
  head: () => ({
    meta: [
      { title: "Avisos — EVV" },
      {
        name: "description",
        content: "Avisos e comunicados da operação, com prioridade e responsável.",
      },
      { property: "og:title", content: "Avisos — EVV" },
      { property: "og:description", content: "Comunicados rápidos para todo o efetivo da operação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AvisosPage,
});

function AvisosPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const date = todayISO();
  const { data: list, isLoading } = useAnnouncements();
  const [form, setForm] = useState({
    priority: "INFORMACAO",
    title: "",
    message: "",
    scope: AVISO_SCOPE.PERSISTENTE as string,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["announcements"] });

  async function create() {
    if (!form.title.trim() && !form.message.trim()) {
      toast.error("Escreva o título ou a mensagem.");
      return;
    }
    const { error } = await supabase.from("announcements").insert({
      op_date: date,
      priority: form.priority,
      scope: form.scope,
      title: form.title.trim(),
      message: form.message.trim(),
      responsavel: displayName(profile),
      time_ref: nowHHMM(),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setForm({ priority: "INFORMACAO", title: "", message: "", scope: form.scope });
    await invalidate();
    toast.success(
      form.scope === AVISO_SCOPE.TEMPORARIO
        ? "Aviso temporário publicado — vale apenas para a operação de hoje."
        : "Aviso persistente publicado — permanece até ser encerrado.",
    );
  }

  /** Desativar um aviso persistente encerra sua vigência (o histórico é preservado). */
  async function toggle(id: string, active: boolean) {
    const { error } = await supabase
      .from("announcements")
      .update({ active, archived_at: active ? null : new Date().toISOString() } as never)
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await invalidate();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await invalidate();
    toast.success("Aviso removido.");
  }

  return (
    <>
      <PageHeader title="Avisos" description="Comunicados da operação" />

      <Card className="mb-5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
            Novo aviso
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-[10rem_12rem_minmax(0,1fr)]">
          <div>
            <Label>Prioridade</Label>
            <Select
              value={form.priority}
              onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {priority(p).label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Categoria</Label>
            <Select
              value={form.scope}
              onValueChange={(v) => setForm((f) => ({ ...f, scope: v }))}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AVISO_SCOPE.PERSISTENTE}>Persistente</SelectItem>
                <SelectItem value={AVISO_SCOPE.TEMPORARIO}>Temporário (só hoje)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Título</Label>
            <Input
              className="mt-1"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>

          <div className="sm:col-span-3">
            <Label>Mensagem</Label>
            <Textarea
              className="mt-1"
              rows={3}
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-3 flex flex-wrap items-center gap-3">
            <Button onClick={create}>Publicar aviso</Button>
            <span className="text-xs text-muted-foreground">
              Persistente permanece em cartaz até ser encerrado; temporário vale somente para a
              operação de hoje.
            </span>
          </div>

        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (list ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum aviso publicado.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {list!.map((a) => (
            <Card key={a.id} className={a.active ? "" : "opacity-60"}>
              <CardContent className="grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={priority(a.priority).tone}>
                      {priority(a.priority).label}
                    </StatusBadge>
                    <StatusBadge tone={a.scope === AVISO_SCOPE.TEMPORARIO ? "info" : "neutral"}>
                      {a.scope === AVISO_SCOPE.TEMPORARIO ? "Temporário" : "Persistente"}
                    </StatusBadge>

                    <span className="text-xs text-muted-foreground">
                      {formatDatePtBr(a.op_date)} {a.time_ref?.slice(0, 5)} · {a.responsavel || "—"}
                    </span>
                  </div>
                  {a.title && <p className="mt-1.5 font-semibold">{a.title}</p>}
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{a.message}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Publicado em {formatDateTime(a.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Label className="flex items-center gap-2 text-xs">
                    Ativo
                    <Switch checked={a.active} onCheckedChange={(v) => toggle(a.id, v)} />
                  </Label>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remover aviso"
                    onClick={() => remove(a.id)}
                  >
                    <Trash2 className="h-4 w-4 text-danger" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
