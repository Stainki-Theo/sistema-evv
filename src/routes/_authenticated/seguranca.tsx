import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { RelprevLibrary } from "@/components/RelprevLibrary";
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
import { useSafety, useSetting, useSaveSetting } from "@/lib/data";
import {
  SAFETY_KIND_OPTIONS,
  safetyKind,
  todayISO,
  nowHHMM,
  formatDatePtBr,
  AVISO_SCOPE,
} from "@/lib/evv";

export const Route = createFileRoute("/_authenticated/seguranca")({
  head: () => ({
    meta: [
      { title: "Segurança de Voo — EVV" },
      {
        name: "description",
        content:
          "Avisos de segurança, condições de atenção, orientações do dia e acesso ao RELPREV.",
      },
      { property: "og:title", content: "Segurança de Voo — EVV" },
      {
        property: "og:description",
        content: "Cultura de segurança operacional: avisos, condições de atenção e RELPREV.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SegurancaPage,
});

function SegurancaPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const date = todayISO();
  const { data: list, isLoading } = useSafety();
  const { data: relprev } = useSetting("relprev_url");
  const saveRelprev = useSaveSetting("relprev_url");
  const [url, setUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    kind: "AVISO",
    title: "",
    content: "",
    scope: AVISO_SCOPE.PERSISTENTE as string,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["safety"] });

  async function create() {
    if (!form.title.trim() && !form.content.trim()) {
      toast.error("Escreva o título ou o conteúdo.");
      return;
    }
    const { error } = await supabase.from("safety_entries").insert({
      op_date: date,
      kind: form.kind,
      scope: form.scope,
      title: form.title.trim(),
      content: form.content.trim(),
      responsavel: displayName(profile),
      time_ref: nowHHMM(),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setForm({ kind: "AVISO", title: "", content: "", scope: form.scope });
    await invalidate();
    toast.success(
      form.scope === AVISO_SCOPE.TEMPORARIO
        ? "Item temporário publicado — vale apenas para a operação de hoje."
        : "Item persistente publicado — permanece até ser encerrado.",
    );
  }

  async function toggle(id: string, active: boolean) {
    const { error } = await supabase
      .from("safety_entries")
      .update({ active, archived_at: active ? null : new Date().toISOString() } as never)
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await invalidate();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("safety_entries").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await invalidate();
  }

  const link = url ?? relprev ?? "";

  return (
    <>
      <PageHeader title="Segurança de Voo" description="Avisos, condições de atenção e RELPREV" />

      <Card className="mb-5 border-l-4 border-l-danger">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
            RELPREV
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
          <div>
            <Label>Link do formulário</Label>
            <Input
              className="mt-1"
              placeholder="https://…"
              value={link}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <Button onClick={() => saveRelprev.mutate(link, { onSuccess: () => toast.success("Link salvo.") })}>
            Salvar link
          </Button>
          {relprev ? (
            <Button asChild variant="outline">
              <a href={relprev} target="_blank" rel="noreferrer">
                Abrir <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </a>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <RelprevLibrary />

      <Card className="mb-5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
            Novo item
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-[14rem_12rem_minmax(0,1fr)]">
          <div>
            <Label>Tipo</Label>
            <Select value={form.kind} onValueChange={(v) => setForm((f) => ({ ...f, kind: v }))}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SAFETY_KIND_OPTIONS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {safetyKind(k).label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={form.scope} onValueChange={(v) => setForm((f) => ({ ...f, scope: v }))}>
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
            <Label>Conteúdo</Label>
            <Textarea
              className="mt-1"
              rows={3}
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-3 flex flex-wrap items-center gap-3">
            <Button onClick={create}>Publicar</Button>
            <span className="text-xs text-muted-foreground">
              Persistente permanece em vigor até ser encerrado; temporário vale somente para a
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
            Nenhum item de segurança publicado.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {list!.map((s) => (
            <Card key={s.id} className={s.active ? "" : "opacity-60"}>
              <CardContent className="grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={safetyKind(s.kind).tone}>{safetyKind(s.kind).label}</StatusBadge>
                    <StatusBadge tone={s.scope === AVISO_SCOPE.TEMPORARIO ? "info" : "neutral"}>
                      {s.scope === AVISO_SCOPE.TEMPORARIO ? "Temporário" : "Persistente"}
                    </StatusBadge>
                    <span className="text-xs text-muted-foreground">
                      {formatDatePtBr(s.op_date)} {s.time_ref?.slice(0, 5)} · {s.responsavel || "—"}
                    </span>
                  </div>
                  {s.title && <p className="mt-1.5 font-semibold">{s.title}</p>}
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{s.content}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Label className="flex items-center gap-2 text-xs">
                    Ativo
                    <Switch checked={s.active} onCheckedChange={(v) => toggle(s.id, v)} />
                  </Label>
                  <Button variant="ghost" size="icon" aria-label="Remover" onClick={() => remove(s.id)}>
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
