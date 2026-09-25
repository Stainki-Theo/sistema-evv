import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth, displayName } from "@/lib/auth";
import { usePermissoes } from "@/lib/permissoes";
import { useSupervisaoItems } from "@/lib/data";
import { formatDateTime } from "@/lib/evv";

export const Route = createFileRoute("/_authenticated/supervisao")({
  head: () => ({
    meta: [
      { title: "Grupo Supervisão — EVV" },
      {
        name: "description",
        content:
          "Área de comunicação reservada exclusivamente aos oficiais da Supervisão do Esquadrão de Voo a Vela.",
      },
      { property: "og:title", content: "Grupo Supervisão — EVV" },
      {
        property: "og:description",
        content: "Assuntos internos dos oficiais da Supervisão do voo a vela.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupervisaoPage,
});

function SupervisaoPage() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const { canSupervisaoGroup } = usePermissoes();
  const { data: items, isLoading } = useSupervisaoItems(canSupervisaoGroup);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["supervisao_items"] });

  async function add() {
    if (!title.trim()) {
      toast.error("Informe o assunto.");
      return;
    }
    const { error } = await supabase.from("supervisao_items").insert({
      title: title.trim(),
      content: content.trim(),
      created_by: profile?.id ?? null,
      created_by_name: displayName(profile),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setTitle("");
    setContent("");
    await invalidate();
    toast.success("Assunto registrado no grupo.");
  }

  async function toggle(id: string, status: string) {
    const { error } = await supabase
      .from("supervisao_items")
      .update({ status: status === "ABERTO" ? "RESOLVIDO" : "ABERTO" } as never)
      .eq("id", id);
    if (error) toast.error(error.message);
    else await invalidate();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("supervisao_items").delete().eq("id", id);
    if (error) toast.error(error.message);
    else await invalidate();
  }

  if (!canSupervisaoGroup) {
    return (
      <>
        <PageHeader title="Grupo Supervisão" description="Área restrita" />
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <Lock className="mx-auto mb-2 h-6 w-6 opacity-60" />
            Área exclusiva dos oficiais cadastrados com nível SUPERVISOR.
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Grupo Supervisão"
        description="Comunicação interna exclusiva dos oficiais da Supervisão"
      />

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] sm:items-end">
          <div>
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Assunto
            </Label>
            <Input
              className="mt-1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ex.: Ajuste na escala de instrução"
            />
          </div>
          <div>
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Detalhes
            </Label>
            <Textarea
              className="mt-1 min-h-10"
              rows={2}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <Button onClick={add}>
            <Plus className="mr-1.5 h-4 w-4" /> Registrar
          </Button>
        </CardContent>
      </Card>

      <div className="mt-4 space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && (items ?? []).length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nenhum assunto registrado no grupo.
            </CardContent>
          </Card>
        )}
        {(items ?? []).map((item) => (
          <Card key={item.id}>
            <CardContent className="flex flex-wrap items-start justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="font-semibold">
                  {item.title}
                  {item.status === "RESOLVIDO" && (
                    <span className="ml-2 text-[11px] uppercase tracking-wider text-success">
                      resolvido
                    </span>
                  )}
                </p>
                {item.content && (
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">
                    {item.content}
                  </p>
                )}
                <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                  {item.created_by_name || "—"} · {formatDateTime(item.created_at)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="sm" variant="outline" onClick={() => toggle(item.id, item.status)}>
                  {item.status === "ABERTO" ? "Concluir" : "Reabrir"}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Remover assunto"
                  onClick={() => remove(item.id)}
                >
                  <Trash2 className="h-4 w-4 text-danger" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
