import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Power, Trash2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth, displayName } from "@/lib/auth";
import { logChange } from "@/lib/audit";
import { findSimilar, operationalLevelLabel } from "@/lib/categorias";

type Row = {
  id: string;
  nome: string;
  cor?: string | null;
  active?: boolean | null;
  sort_order?: number | null;
};

type Props = {
  title: string;
  description?: string;
  /** Tabela de lista simples: operational_levels, calendar_categories, commerce_categories. */
  table: "operational_levels" | "calendar_categories" | "commerce_categories";
  queryKey: string;
  hasColor?: boolean;
  canEdit: boolean;
  /** Área usada no Log de Alterações. */
  area: string;
};

/**
 * Gerenciador de listas simples (níveis operacionais, categorias do
 * calendário e do comercial). Novas opções passam a aparecer automaticamente
 * nos dropdowns que consomem a mesma tabela.
 */
export function ListaSimplesManager({
  title,
  description,
  table,
  queryKey,
  hasColor,
  canEdit,
  area,
}: Props) {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const [novo, setNovo] = useState("");
  const [novaCor, setNovaCor] = useState("#1d4ed8");
  const [editing, setEditing] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<{ nome: string; cor: string }>({ nome: "", cor: "" });

  const { data: rows } = useQuery({
    queryKey: [queryKey, "manager"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .order("sort_order")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: [queryKey] });
    await qc.invalidateQueries({ queryKey: [queryKey, "manager"] });
  };

  const autor = { id: profile?.id, tag: displayName(profile) };

  async function criar() {
    const nome = table === "operational_levels" ? operationalLevelLabel(novo) : novo.trim();
    if (!nome) return;
    const similar = findSimilar(rows ?? [], (r) => r.nome, nome);
    if (similar && similar.nome !== nome) {
      const ok = window.confirm(
        `Já existe uma opção semelhante ("${similar.nome}"). Deseja realmente criar uma nova?`,
      );
      if (!ok) return;
    } else if (similar) {
      toast.error("Essa opção já existe.");
      return;
    }
    const payload: Record<string, unknown> = { nome, sort_order: (rows?.length ?? 0) + 1 };
    if (hasColor) payload['cor'] = novaCor;
    const { data, error } = await supabase
      .from(table)
      .insert(payload as never)
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    await logChange(
      {
        area,
        entity: table,
        entityId: (data as { id: string }).id,
        entityLabel: nome,
        action: "INSERT",
        newValue: nome,
      },
      autor,
    );
    setNovo("");
    await invalidate();
    toast.success(`"${nome}" criado.`);
  }

  async function salvar(row: Row) {
    const nome = table === "operational_levels" ? operationalLevelLabel(rascunho.nome) : rascunho.nome.trim();
    if (!nome) return;
    const payload: Record<string, unknown> = { nome };
    if (hasColor) payload['cor'] = rascunho.cor;
    const { error } = await supabase
      .from(table)
      .update(payload as never)
      .eq("id", row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logChange(
      {
        area,
        entity: table,
        entityId: row.id,
        entityLabel: nome,
        action: "UPDATE",
        field: "nome",
        oldValue: row.nome,
        newValue: nome,
      },
      autor,
    );
    setEditing(null);
    await invalidate();
    toast.success("Alteração registrada.");
  }

  async function alternarAtivo(row: Row) {
    if (row.active === undefined || row.active === null) return;
    const { error } = await supabase
      .from(table)
      .update({ active: !row.active } as never)
      .eq("id", row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logChange(
      {
        area,
        entity: table,
        entityId: row.id,
        entityLabel: row.nome,
        action: "UPDATE",
        field: "active",
        oldValue: row.active ? "Ativa" : "Desativada",
        newValue: row.active ? "Desativada" : "Ativa",
      },
      autor,
    );
    await invalidate();
  }

  async function excluir(row: Row) {
    const ok = window.confirm(
      `Excluir "${row.nome}" definitivamente? Se já houver histórico associado, prefira desativar.`,
    );
    if (!ok) return;
    const { error } = await supabase.from(table).delete().eq("id", row.id);
    if (error) {
      toast.error(`${error.message} — desative em vez de excluir.`);
      return;
    }
    await logChange(
      {
        area,
        entity: table,
        entityId: row.id,
        entityLabel: row.nome,
        action: "DELETE",
        oldValue: row.nome,
      },
      autor,
    );
    await invalidate();
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
          {title}
        </CardTitle>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={novo}
              placeholder="Nova opção"
              className="w-52"
              onChange={(e) => setNovo(e.target.value)}
            />
            {hasColor && (
              <input
                type="color"
                aria-label="Cor"
                value={novaCor}
                onChange={(e) => setNovaCor(e.target.value)}
                className="h-9 w-12 rounded border border-input bg-background"
              />
            )}
            <Button size="sm" onClick={criar}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Adicionar
            </Button>
          </div>
        )}

        <ul className="divide-y divide-border/60 rounded border border-border">
          {(rows ?? []).map((row) => {
            const emEdicao = editing === row.id;
            return (
              <li key={row.id} className="flex items-center gap-2 p-2 text-sm">
                {hasColor && !emEdicao ? (
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: row.cor ?? "#475569" }}
                  />
                ) : null}
                {emEdicao ? (
                  <>
                    <Input
                      value={rascunho.nome}
                      onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })}
                      className="h-8 w-52"
                    />
                    {hasColor && (
                      <input
                        type="color"
                        aria-label="Cor"
                        value={rascunho.cor || "#475569"}
                        onChange={(e) => setRascunho({ ...rascunho, cor: e.target.value })}
                        className="h-8 w-12 rounded border border-input bg-background"
                      />
                    )}
                    <Button size="sm" variant="outline" onClick={() => salvar(row)}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="truncate font-medium">{row.nome}</span>
                    {row.active === false && <StatusBadge tone="neutral">Desativada</StatusBadge>}
                    {canEdit && (
                      <div className="ml-auto flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="Editar"
                          onClick={() => {
                            setEditing(row.id);
                            setRascunho({ nome: row.nome, cor: row.cor ?? "#475569" });
                          }}
                          className="grid h-8 w-8 place-items-center rounded hover:bg-muted"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {row.active !== undefined && row.active !== null && (
                          <button
                            type="button"
                            aria-label={row.active ? "Desativar" : "Reativar"}
                            onClick={() => alternarAtivo(row)}
                            className="grid h-8 w-8 place-items-center rounded hover:bg-muted"
                          >
                            <Power className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label="Excluir"
                          onClick={() => excluir(row)}
                          className="grid h-8 w-8 place-items-center rounded hover:bg-muted"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-danger" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </li>
            );
          })}
          {!(rows ?? []).length && (
            <li className="p-3 text-xs text-muted-foreground">Nenhuma opção cadastrada.</li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
