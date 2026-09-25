import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Lock, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useDiretorias, useProfiles, useDiretoriaAssignments } from "@/lib/data";
import { personTag, diretoriaTipoLabel, SEM_FUNCAO, minutesToClock } from "@/lib/evv";

export const Route = createFileRoute("/_authenticated/diretorias")({
  head: () => ({
    meta: [
      { title: "Diretorias — EVV" },
      {
        name: "description",
        content:
          "Funções no voo a vela por Diretoria e Assessoria, com acesso às áreas privadas de cada diretoria.",
      },
      { property: "og:title", content: "Diretorias — EVV" },
      {
        property: "og:description",
        content: "Diretores, assessores e áreas privadas de cada diretoria do voo a vela.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DiretoriasPage,
});

function DiretoriasPage() {
  const qc = useQueryClient();
  const { isAdmin, profile } = useAuth();
  const { data: diretorias } = useDiretorias();
  const { data: profiles } = useProfiles();
  const { data: assignments } = useDiretoriaAssignments();
  const [search, setSearch] = useState("");
  const [novaDiretoria, setNovaDiretoria] = useState("");
  const [form, setForm] = useState({ profile_id: "", diretoria_id: "", tipo: "DIRETOR" });

  const isPresidente = profile?.cargo === "Presidente";

  const byId = useMemo(() => {
    const map = new Map<string, NonNullable<typeof profiles>[number]>();
    for (const p of profiles ?? []) map.set(p.id, p);
    return map;
  }, [profiles]);

  const matches = (id: string) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const p = byId.get(id);
    return [p?.tri, p?.war_name, p?.full_name].join(" ").toLowerCase().includes(q);
  };

  const grouped = useMemo(() => {
    return (diretorias ?? []).map((d) => {
      const rows = (assignments ?? []).filter((a) => a.diretoria_id === d.id && matches(a.profile_id));
      return {
        diretoria: d,
        diretores: rows.filter((a) => a.tipo === "DIRETOR"),
        assessores: rows.filter((a) => a.tipo === "ASSESSOR"),
      };
    });
  }, [diretorias, assignments, search, byId]);

  const semFuncao = useMemo(() => {
    const comFuncao = new Set((assignments ?? []).map((a) => a.profile_id));
    return (profiles ?? []).filter(
      (p) => !comFuncao.has(p.id) && p.cargo !== "Presidente" && matches(p.id),
    );
  }, [profiles, assignments, search]);

  const presidencia = (profiles ?? []).filter((p) => p.cargo === "Presidente" && matches(p.id));

  function canOpen(diretoriaId: string, scope: "DIRETORIA" | "ASSESSORIA") {
    if (isAdmin || isPresidente) return true;
    return (assignments ?? []).some(
      (a) =>
        a.profile_id === profile?.id &&
        a.diretoria_id === diretoriaId &&
        (a.tipo === "DIRETOR" || (a.tipo === "ASSESSOR" && scope === "ASSESSORIA")),
    );
  }

  async function grant() {
    if (!form.profile_id || !form.diretoria_id) {
      toast.error("Escolha o integrante e a diretoria.");
      return;
    }
    const { error } = await supabase.from("diretoria_assignments").insert({
      profile_id: form.profile_id,
      diretoria_id: form.diretoria_id,
      tipo: form.tipo,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    const nome = (diretorias ?? []).find((d) => d.id === form.diretoria_id)?.nome ?? "";
    await supabase
      .from("profiles")
      .update({ cargo: diretoriaTipoLabel(form.tipo), diretoria: nome } as never)
      .eq("id", form.profile_id);
    await qc.invalidateQueries({ queryKey: ["diretoria_assignments"] });
    await qc.invalidateQueries({ queryKey: ["profiles"] });
    setForm({ profile_id: "", diretoria_id: "", tipo: "DIRETOR" });
    toast.success("Função concedida.");
  }

  async function revoke(id: string, profileId: string) {
    const { error } = await supabase.from("diretoria_assignments").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    const restantes = (assignments ?? []).filter((a) => a.profile_id === profileId && a.id !== id);
    if (restantes.length === 0) {
      await supabase.from("profiles").update({ cargo: "", diretoria: "" } as never).eq("id", profileId);
    }
    await qc.invalidateQueries({ queryKey: ["diretoria_assignments"] });
    await qc.invalidateQueries({ queryKey: ["profiles"] });
    toast.success("Função retirada — permissões removidas.");
  }

  async function addDiretoria() {
    const nome = novaDiretoria.trim();
    if (!nome) return;
    const { error } = await supabase
      .from("diretorias")
      .insert({ nome, sort_order: (diretorias?.length ?? 0) + 1 });
    if (error) {
      toast.error("Somente o administrador pode criar diretorias.");
      return;
    }
    setNovaDiretoria("");
    await qc.invalidateQueries({ queryKey: ["diretorias"] });
  }

  return (
    <>
      <PageHeader
        title="Diretorias e Assessorias"
        description="Função no Voo a Vela por área — fonte única das permissões das diretorias"
        actions={
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Pesquisar integrante"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        }
      />

      {isAdmin && (
        <Card className="mb-5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
              Administração das funções
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10rem_auto] sm:items-end">
              <div>
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Integrante
                </Label>
                <Select
                  value={form.profile_id}
                  onValueChange={(v) => setForm({ ...form, profile_id: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecionar" />
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
              <div>
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Diretoria
                </Label>
                <Select
                  value={form.diretoria_id}
                  onValueChange={(v) => setForm({ ...form, diretoria_id: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {(diretorias ?? []).map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Função
                </Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DIRETOR">Diretor</SelectItem>
                    <SelectItem value="ASSESSOR">Assessor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={grant}>Conceder</Button>
            </div>
            <div className="flex gap-2 border-t border-border pt-3">
              <Input
                className="max-w-xs"
                placeholder="Nova diretoria (ex.: Material)"
                value={novaDiretoria}
                onChange={(e) => setNovaDiretoria(e.target.value)}
              />
              <Button size="sm" variant="outline" onClick={addDiretoria}>
                <Plus className="mr-1.5 h-4 w-4" /> Criar diretoria
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-5">
        {presidencia.length > 0 && (
          <Section title="Presidência">
            <PeopleTable
              rows={presidencia.map((p) => ({ id: p.id, profile: p, tipo: "PRESIDENTE" }))}
            />
          </Section>
        )}

        {grouped.map(({ diretoria, diretores, assessores }) => (
          <Section
            key={diretoria.id}
            title={diretoria.nome}
            actions={
              <div className="flex flex-wrap gap-2">
                <AreaLink
                  to={diretoria.id}
                  scope="DIRETORIA"
                  label="Área da Diretoria"
                  allowed={canOpen(diretoria.id, "DIRETORIA")}
                />
                <AreaLink
                  to={diretoria.id}
                  scope="ASSESSORIA"
                  label="Área da Assessoria"
                  allowed={canOpen(diretoria.id, "ASSESSORIA")}
                />
              </div>
            }
          >
            <PeopleTable
              rows={[...diretores, ...assessores].map((a) => ({
                id: a.id,
                profile: byId.get(a.profile_id),
                tipo: a.tipo,
              }))}
              onRemove={isAdmin ? revoke : undefined}
            />
          </Section>
        ))}

        <Section title={SEM_FUNCAO.toUpperCase()}>
          <PeopleTable rows={semFuncao.map((p) => ({ id: p.id, profile: p, tipo: "" }))} />
        </Section>
      </div>
    </>
  );
}

function Section({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-aviation">{title}</h2>
        {actions}
      </div>
      <Card>
        <CardContent className="p-0">{children}</CardContent>
      </Card>
    </section>
  );
}

function AreaLink({
  to,
  scope,
  label,
  allowed,
}: {
  to: string;
  scope: "DIRETORIA" | "ASSESSORIA";
  label: string;
  allowed: boolean;
}) {
  if (!allowed) {
    return (
      <span className="flex items-center gap-1 rounded border border-dashed border-border px-2 py-1 text-xs text-muted-foreground">
        <Lock className="h-3 w-3" /> {label}
      </span>
    );
  }
  return (
    <Button asChild size="sm" variant="outline">
      <Link to="/diretoria/$id" params={{ id: to }} search={{ scope }}>
        {label}
      </Link>
    </Button>
  );
}

type Row = {
  id: string;
  profile?: { id: string; tri?: string | null; war_name?: string | null; full_name?: string | null; nivel_operacional?: string | null; esquadrao?: string | null; flight_minutes?: number | null; fase?: string | null } | undefined;
  tipo: string;
};

function PeopleTable({
  rows,
  onRemove,
}: {
  rows: Row[];
  onRemove?: ((id: string, profileId: string) => void) | undefined;
}) {
  if (rows.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">Nenhum integrante nesta seção.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[38rem] text-sm">
        <thead className="border-b border-border bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Integrante</th>
            <th className="px-3 py-2 text-left">Função</th>
            <th className="px-3 py-2 text-left">Nível operacional</th>
            <th className="px-3 py-2 text-left">Esquadrão</th>
            <th className="px-3 py-2 text-left">Horas</th>
            {onRemove && <th className="px-3 py-2 text-left">Ações</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/60">
              <td className="px-3 py-1.5 font-medium">{personTag(r.profile)}</td>
              <td className="px-3 py-1.5">
                {r.tipo === "PRESIDENTE" ? (
                  <StatusBadge tone="info">Presidente</StatusBadge>
                ) : r.tipo ? (
                  <StatusBadge tone={r.tipo === "DIRETOR" ? "info" : "neutral"}>
                    {diretoriaTipoLabel(r.tipo)}
                  </StatusBadge>
                ) : (
                  <span className="text-muted-foreground">{SEM_FUNCAO}</span>
                )}
              </td>
              <td className="px-3 py-1.5">{r.profile?.nivel_operacional || "—"}</td>
              <td className="px-3 py-1.5 text-muted-foreground">{r.profile?.esquadrao || "—"}</td>
              <td className="px-3 py-1.5 font-mono">
                {minutesToClock(r.profile?.flight_minutes ?? 0)}
              </td>
              {onRemove && (
                <td className="px-3 py-1.5">
                  <button
                    type="button"
                    aria-label="Retirar função"
                    onClick={() => r.profile && onRemove(r.id, r.profile.id)}
                    className="grid h-7 w-7 place-items-center rounded hover:bg-muted"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-danger" />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
