import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { PersonSelect } from "@/components/PersonSelect";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDuties, ensureDefaultDuties, useProfiles } from "@/lib/data";
import { todayISO, formatDatePtBr, funcaoLabel } from "@/lib/evv";
import { useAuth, displayName } from "@/lib/auth";
import { logChange } from "@/lib/audit";


export const Route = createFileRoute("/_authenticated/funcoes")({
  head: () => ({
    meta: [
      { title: "Funções do Dia — EVV" },
      {
        name: "description",
        content: "Atribuição das funções da operação: chefe de pista, sombra, ponta de cabo e mais.",
      },
      { property: "og:title", content: "Funções do Dia — EVV" },
      { property: "og:description", content: "Quem faz o quê na operação de hoje." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FuncoesPage,
});

function FuncoesPage() {
  const { profile } = useAuth();
  const [date, setDate] = useState(todayISO());
  const qc = useQueryClient();
  const { data: duties, isLoading } = useDuties(date);
  const { data: profiles } = useProfiles();
  const people = (profiles ?? []).map((p) => ({
    id: p.id,
    war_name: p.war_name,
    full_name: p.full_name,
  }));

  const invalidate = () => qc.invalidateQueries({ queryKey: ["duties", date] });


  useEffect(() => {
    if (!isLoading && (duties ?? []).length === 0) {
      void ensureDefaultDuties(date).then(invalidate).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, duties, date]);

  async function add() {
    const { error } = await supabase.from("duty_roster").insert({
      op_date: date,
      funcao: "Nova função",
      sort_order: (duties?.length ?? 0) + 1,
    });
    if (error) { toast.error(error.message); return; }
    await invalidate();
  }

  async function update(id: string, patch: Record<string, string | null>) {
    const before = (duties ?? []).find((row) => row.id === id);
    const { error } = await supabase.from("duty_roster").update(patch as never).eq("id", id);
    if (error) toast.error(error.message);
    else {
      if (Object.prototype.hasOwnProperty.call(patch, "profile_id") && patch.profile_id !== before?.profile_id) {
        await logChange({
          area: "FUNCOES",
          entity: "duty_roster",
          entityId: id,
          entityLabel: before?.funcao ?? "Função do dia",
          action: "UPDATE",
          field: "profile_id",
          fieldLabel: "Responsável",
          oldValue: before?.profile_id ?? "",
          newValue: patch.profile_id ?? "",
          opDate: date,
          details: { target_profile_id: patch.profile_id, funcao: before?.funcao ?? "" },
        }, { id: profile?.id, tag: displayName(profile) });
      }
      await invalidate();
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from("duty_roster").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await invalidate();
  }

  async function reset() {
    const { error } = await supabase.from("duty_roster").delete().eq("op_date", date);
    if (error) { toast.error(error.message); return; }
    await ensureDefaultDuties(date);
    await invalidate();
    toast.success("Funções padrão restauradas.");
  }

  return (
    <>
      <PageHeader
        title="Funções do Dia"
        description={formatDatePtBr(date)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-40"
            />
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="mr-1.5 h-4 w-4" /> Padrão
            </Button>
            <Button size="sm" onClick={add}>
              <Plus className="mr-1.5 h-4 w-4" /> Função
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <div className="space-y-3">
          {(duties ?? []).map((d) => (
            <Card key={d.id}>
              <CardContent className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                <Field label="Função">
                  <Input
                    key={d.funcao}
                    defaultValue={funcaoLabel(d.funcao)}
                    onBlur={(e) => update(d.id, { funcao: e.target.value })}
                  />
                </Field>
                <Field label="Responsável">
                  <PersonSelect
                    people={people}
                    value={d.responsavel}
                    profileId={d.profile_id}
                    placeholder="Escolher militar"
                    onChange={(next) => update(d.id, next)}
                  />
                </Field>

                <Field label="Observação">
                  <Input
                    defaultValue={d.observacao}
                    onBlur={(e) => update(d.id, { observacao: e.target.value })}
                  />
                </Field>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remover função"
                  onClick={() => remove(d.id)}
                >
                  <Trash2 className="h-4 w-4 text-danger" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
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
