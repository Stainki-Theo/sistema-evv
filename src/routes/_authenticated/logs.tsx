import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Undo2, History } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth, displayName } from "@/lib/auth";
import { usePermissoes } from "@/lib/permissoes";
import { useChangeLog } from "@/lib/data";
import { reverterResultado } from "@/lib/progressao.functions";
import {
  ACTION_LABEL,
  AREA_LABEL,
  undoChange,
  undoDescription,
  type ChangeRow,
} from "@/lib/audit";
import { formatDateTime } from "@/lib/evv";

export const Route = createFileRoute("/_authenticated/logs")({
  head: () => ({
    meta: [
      { title: "Log de Alterações — EVV" },
      {
        name: "description",
        content:
          "Auditoria das alterações operacionais do EVV: data, autor, área, valor anterior e novo, com opção de desfazer.",
      },
      { property: "og:title", content: "Log de Alterações — EVV" },
      {
        property: "og:description",
        content: "Rastreabilidade completa das mudanças na operação do voo a vela.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LogsPage,
});

const TODOS = "TODOS";

function LogsPage() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const { canManageOps } = usePermissoes();
  const [area, setArea] = useState(TODOS);
  const [date, setDate] = useState("");
  const [target, setTarget] = useState<ChangeRow | null>(null);
  const reverterProgressao = useServerFn(reverterResultado);

  const filters: { area?: string; date?: string } = {};
  if (area !== TODOS) filters.area = area;
  if (date) filters.date = date;
  const { data: rows, isLoading } = useChangeLog(filters);

  async function confirmUndo() {
    if (!target) return;
    try {
      const msg = await undoChange(
        target,
        { id: profile?.id, tag: displayName(profile) },
        reverterProgressao as never,
      );
      await qc.invalidateQueries();
      toast.success(msg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível desfazer.");
    } finally {
      setTarget(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Log de Alterações"
        description="Auditoria automática das mudanças nos dados operacionais"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={area} onValueChange={setArea}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todas as áreas</SelectItem>
                {Object.entries(AREA_LABEL).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-40"
              aria-label="Filtrar por data da operação"
            />
            {date && (
              <Button variant="outline" size="sm" onClick={() => setDate("")}>
                Limpar
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Carregando…</p>
          ) : (rows ?? []).length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <History className="mx-auto mb-2 h-6 w-6 opacity-60" />
              Nenhuma alteração registrada com estes filtros.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[56rem] text-sm">
                <thead className="bg-muted/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Quando</th>
                    <th className="px-3 py-2 text-left">Autor</th>
                    <th className="px-3 py-2 text-left">Área</th>
                    <th className="px-3 py-2 text-left">Registro</th>
                    <th className="px-3 py-2 text-left">Alteração</th>
                    <th className="px-3 py-2 text-left">Anterior → Novo</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {(rows ?? []).map((r) => {
                    const row = r as unknown as ChangeRow;
                    return (
                      <tr key={row.id} className="border-t border-border align-top">
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                          {formatDateTime(row.created_at)}
                        </td>
                        <td className="px-3 py-2">{row.user_tag || "—"}</td>
                        <td className="px-3 py-2">
                          <StatusBadge tone="info">
                            {AREA_LABEL[row.area] ?? row.area}
                          </StatusBadge>
                        </td>
                        <td className="px-3 py-2">{row.entity_label || row.entity}</td>
                        <td className="px-3 py-2">
                          <span className="text-xs uppercase tracking-wider text-muted-foreground">
                            {ACTION_LABEL[row.action] ?? row.action}
                          </span>
                          <div>{row.field_label || row.field || "—"}</div>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          <span className="text-muted-foreground line-through">
                            {row.old_value || "vazio"}
                          </span>{" "}
                          → <span className="font-bold">{row.new_value || "vazio"}</span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {row.reverted_at ? (
                            <StatusBadge tone="neutral">desfeita</StatusBadge>
                          ) : canManageOps ? (
                            <Button size="sm" variant="outline" onClick={() => setTarget(row)}>
                              <Undo2 className="mr-1.5 h-3.5 w-3.5" /> Desfazer
                            </Button>
                          ) : null}
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

      <AlertDialog open={!!target} onOpenChange={(open) => !open && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desfazer esta alteração?</AlertDialogTitle>
            <AlertDialogDescription>
              {target ? undoDescription(target) : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded border border-border bg-muted/40 p-3 text-sm">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Registro
            </Label>
            <p className="font-semibold">{target?.entity_label || target?.entity}</p>
            <p className="text-xs text-muted-foreground">
              Alterado por {target?.user_tag || "—"} em{" "}
              {target ? formatDateTime(target.created_at) : ""}
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUndo}>Desfazer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
