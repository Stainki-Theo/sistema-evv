import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, Plus, Sparkles, Trash2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
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
import { useAuth, displayName } from "@/lib/auth";
import { usePermissoes } from "@/lib/permissoes";
import { useDuties, useEstrelarios, useEstrelariosEstatistica, useProfiles } from "@/lib/data";
import { formatDatePtBr, personTag, todayISO } from "@/lib/evv";
import { logChange } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/estrelarios")({
  head: () => ({ meta: [{ title: "Estrelários — EVV" }] }),
  component: EstrelariosPage,
});

const FUNCOES_AUTORIZADAS = [
  "Chefe de Pista (Manhã)",
  "Chefe de Pista (Tarde)",
  "Sombra (Manhã)",
  "Sombra (Tarde)",
];

function dateDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function EstrelariosPage() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const { canManageOps } = usePermissoes();
  const hoje = todayISO();
  const [opDate, setOpDate] = useState(hoje);
  const { data: duties } = useDuties(opDate);
  const { data: profiles } = useProfiles();
  const { data: rows, isError } = useEstrelarios();
  const [from, setFrom] = useState(dateDaysAgo(90));
  const [to, setTo] = useState(hoje);
  const { data: estatistica } = useEstrelariosEstatistica(from, to);
  const [recipientId, setRecipientId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<NonNullable<typeof rows>[number] | null>(null);
  const [removing, setRemoving] = useState(false);

  const emServico = (duties ?? []).some(
    (d) => d.profile_id === profile?.id && FUNCOES_AUTORIZADAS.includes(d.funcao),
  );
  const podeLancar = canManageOps || emServico;
  const meus = (rows ?? []).filter((r) => r.recipient_id === profile?.id);
  const meuTotal = meus.reduce((sum, r) => sum + r.amount, 0);
  const chartData = (estatistica ?? []).map((r) => ({
    data: formatDatePtBr(r.op_date).slice(0, 5),
    total: Number(r.total),
    lancamentos: Number(r.lancamentos),
  }));
  const profileMap = useMemo(
    () => new Map((profiles ?? []).map((p) => [p.id, personTag(p)])),
    [profiles],
  );

  async function lancar() {
    const value = Number(amount);
    if (!recipientId || !Number.isInteger(value) || value <= 0 || value > 30000 || !reason.trim()) {
      toast.error("Selecione o tripulante, informe de 1 a 30.000 estrelários e registre o motivo.");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("estrelarios")
      .insert({
        recipient_id: recipientId,
        amount: value,
        reason: reason.trim(),
        op_date: opDate,
        issued_by: profile!.id,
        issued_by_name: displayName(profile),
      })
      .select("id")
      .single();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logChange(
      {
        area: "ESTRELÁRIOS",
        entity: "estrelarios",
        entityId: data.id,
        entityLabel: profileMap.get(recipientId) ?? "Tripulante",
        action: "INSERT",
        opDate,
        newValue: `${value.toLocaleString("pt-BR")} · ${reason.trim()}`,
      },
      { id: profile?.id, tag: displayName(profile) },
    );
    setRecipientId("");
    setAmount("");
    setReason("");
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["estrelarios"] }),
      qc.invalidateQueries({ queryKey: ["estrelarios_estatistica"] }),
    ]);
    toast.success("Estrelários registrados.");
  }

  async function apagar() {
    if (!deleting) return;
    setRemoving(true);
    const { error } = await supabase.from("estrelarios").delete().eq("id", deleting.id);
    setRemoving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logChange(
      {
        area: "ESTRELÁRIOS",
        entity: "estrelarios",
        entityId: deleting.id,
        entityLabel: profileMap.get(deleting.recipient_id) ?? "Tripulante",
        action: "DELETE",
        opDate: deleting.op_date,
        oldValue: `${deleting.amount.toLocaleString("pt-BR")} · ${deleting.reason}`,
      },
      { id: profile?.id, tag: displayName(profile) },
    );
    setDeleting(null);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["estrelarios"] }),
      qc.invalidateQueries({ queryKey: ["estrelarios_estatistica"] }),
    ]);
    toast.success("Lançamento apagado.");
  }

  return (
    <>
      <PageHeader title="Estrelários" description="Controle reservado de ocorrências e valores" />

      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-warning md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
              Meus estrelários
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-3xl font-bold">{meuTotal.toLocaleString("pt-BR")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Equivalente a R${" "}
              {(meuTotal / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
              <Sparkles className="h-4 w-4" /> Regras
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Cada 1.000 estrelários equivalem a R$ 1,00. O teto é de 30.000 por tripulante no mesmo
            dia. Seus registros só ficam visíveis para você, para quem lançou e para a gestão
            autorizada.
          </CardContent>
        </Card>
      </div>

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Novo lançamento — {formatDatePtBr(opDate)}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[.8fr_1.2fr_.7fr_2fr_auto] lg:items-end">
          <div>
            <Label>Data do serviço</Label>
            <Input
              className="mt-1"
              type="date"
              max={hoje}
              value={opDate}
              onChange={(e) => setOpDate(e.target.value)}
            />
          </div>
          <div>
            <Label>Tripulante</Label>
            <Select value={recipientId} onValueChange={setRecipientId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>
              <SelectContent>
                {(profiles ?? [])
                  .filter((p) => p.status === "ATIVO")
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {personTag(p)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Quantidade</Label>
            <Input
              className="mt-1"
              type="number"
              min={1}
              max={30000}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="até 30.000"
            />
          </div>
          <div>
            <Label>Motivo</Label>
            <Textarea
              className="mt-1 min-h-10"
              rows={1}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Descreva objetivamente o motivo"
            />
          </div>
          <Button onClick={lancar} disabled={saving || !podeLancar}>
            <Plus className="mr-1.5 h-4 w-4" />
            {saving ? "Salvando…" : "Lançar"}
          </Button>
          {!podeLancar && (
            <p className="text-xs text-muted-foreground lg:col-span-5">
              Você só pode lançar para uma data em que esteve escalado como Sombra ou Chefe de
              Pista. Diretores e administradores podem lançar em qualquer data.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="mb-5">
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" /> Evolução anônima
          </CardTitle>
          <div className="flex gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Totais por operação, sem identificação dos tripulantes.
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="data" />
                <YAxis />
                <Tooltip formatter={(v) => Number(v).toLocaleString("pt-BR")} />
                <Bar
                  dataKey="total"
                  name="Estrelários"
                  fill="var(--color-aviation)"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registros visíveis para você</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isError ? (
            <p className="text-sm text-danger">
              O banco de dados ainda não disponibilizou o módulo de Estrelários.
            </p>
          ) : (rows ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum lançamento registrado.</p>
          ) : (
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-2">Data</th>
                  <th>Tripulante</th>
                  <th>Quantidade</th>
                  <th>Motivo</th>
                  <th>Lançado por</th>
                  <th className="w-12">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {(rows ?? []).map((r) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="py-3">{formatDatePtBr(r.op_date)}</td>
                    <td>
                      {r.recipient_id === profile?.id
                        ? "Você"
                        : (profileMap.get(r.recipient_id) ?? "Tripulante")}
                    </td>
                    <td className="font-mono font-bold">{r.amount.toLocaleString("pt-BR")}</td>
                    <td>{r.reason}</td>
                    <td>{r.issued_by_name}</td>
                    <td>
                      {(r.issued_by === profile?.id || canManageOps) && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-danger hover:text-danger"
                          onClick={() => setDeleting(r)}
                          aria-label="Apagar lançamento"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar este lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O registro de {deleting?.amount.toLocaleString("pt-BR")} estrelários e seu motivo
              serão removidos. A exclusão ficará registrada no Log de Alterações.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={removing} onClick={apagar}>
              {removing ? "Apagando…" : "Apagar lançamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
