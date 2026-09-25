import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Search, ShieldCheck, Trash2, UserPlus } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useAuth } from "@/lib/auth";
import { usePermissoes } from "@/lib/permissoes";
import { CategoriaMissaoManager } from "@/components/admin/CategoriaMissaoManager";
import { ListaSimplesManager } from "@/components/admin/ListaSimplesManager";
import {
  useDiretorias,
  useAircraft,
  useCallsigns,
  useMissionSequence,
  useCurrentSquadrons,
  useFases,
  useSetting,
  AFA_SQUADRONS_SETTING,
} from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import {
  ACCOUNT_STATUS,
  AIRCRAFT_MODELOS,
  AIRCRAFT_TIPOS,
  NIVEIS,
  POSTOS,
  nivelLabel,
} from "@/lib/evv";
import {
  createAccount,
  deleteAccount,
  listAccounts,
  resetAccountPassword,
  setAccountNivel,
  setAccountFase,
  setAccountStatus,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/administracao")({
  head: () => ({
    meta: [
      { title: "Administração — EVV" },
      {
        name: "description",
        content:
          "Gestão de contas do EVV: criar usuários, definir níveis de acesso, bloquear e redefinir senhas.",
      },
      { property: "og:title", content: "Administração — EVV" },
      {
        property: "og:description",
        content: "Painel administrativo de contas e permissões do voo a vela.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdministracaoPage,
});

const NEW_USER = {
  full_name: "",
  war_name: "",
  email: "",
  password: "",
  nivel: NIVEIS.MEMBRO as string,
  gaivota: "",
  posto: "",
  tri: "",
  esquadrao: "",
  diretoria: "",
  funcao: "",
  fase: "",
};

const NO_PHASE = "__none__";

async function withCurrentSession<T>(call: (headers: HeadersInit) => Promise<T>): Promise<T> {
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (error || !token) {
    throw new Error("Sua sessão expirou. Entre novamente para continuar.");
  }

  return call({ Authorization: `Bearer ${token}` });
}

type Confirm = { title: string; description: string; action: () => Promise<void> } | null;

function AdministracaoPage() {
  const { isAdmin, profile, loading } = useAuth();
  const { isAdmin: isAdminPerm, isSupervisao, isDiretor } = usePermissoes();
  const canEdit = isAdminPerm || isSupervisao || isDiretor;
  const qc = useQueryClient();
  const fetchAccounts = useServerFn(listAccounts);
  const [search, setSearch] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState({ ...NEW_USER });
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [resetFor, setResetFor] = useState<{ id: string; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const { data: diretorias } = useDiretorias();
  const { data: currentSquadrons } = useCurrentSquadrons();
  const { data: fases } = useFases();
  const setFase = useServerFn(setAccountFase);

  const accounts = useQuery({
    queryKey: ["accounts"],
    enabled: isAdmin,
    queryFn: () => withCurrentSession((headers) => fetchAccounts({ headers })),
  });

  const create = useMutation({
    mutationFn: (payload: typeof NEW_USER) =>
      withCurrentSession((headers) => createAccount({ data: payload, headers })),
    onSuccess: async (result) => {
      toast.success(
        result.invited
          ? "Conta criada. O convite para definir a senha foi enviado por e-mail."
          : "Usuário criado.",
      );
      setOpenNew(false);
      setForm({ ...NEW_USER });
      await qc.invalidateQueries({ queryKey: ["accounts"] });
      await qc.invalidateQueries({ queryKey: ["profiles"] });
      await qc.invalidateQueries({ queryKey: ["profiles-all"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao criar usuário."),
  });

  async function run(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast.success(ok);
      await qc.invalidateQueries({ queryKey: ["accounts"] });
      await qc.invalidateQueries({ queryKey: ["profiles"] });
      await qc.invalidateQueries({ queryKey: ["profiles-all"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ação não permitida.");
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = accounts.data ?? [];
    if (!q) return list;
    return list.filter((a) =>
      [a.full_name, a.war_name, a.email].join(" ").toLowerCase().includes(q),
    );
  }, [accounts.data, search]);

  if (loading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-semibold">Área restrita a administradores</p>
          <p className="text-sm text-muted-foreground">
            Sua conta é MEMBRO e não tem acesso à gestão de contas.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title="Administração"
        description="Contas, níveis de acesso e situação dos usuários"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-48">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Pesquisar"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button size="sm" onClick={() => setOpenNew(true)}>
              <UserPlus className="mr-1.5 h-4 w-4" /> Novo usuário
            </Button>
          </div>
        }
      />

      {accounts.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando contas…</p>
      ) : (
        <>
          {/* Tabela no desktop */}
          <Card className="hidden lg:block">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left">Nome</th>
                    <th className="p-3 text-left">Nome de guerra</th>
                    <th className="p-3 text-left">Login / e-mail</th>
                    <th className="p-3 text-left">Nível</th>
                    <th className="p-3 text-left">Fase</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => (
                    <tr key={a.id} className="border-b border-border/60">
                      <td className="p-3 font-medium">{a.full_name || "—"}</td>
                      <td className="p-3">{a.war_name || "—"}</td>
                      <td className="p-3 text-muted-foreground">{a.email}</td>
                      <td className="p-3">
                        <StatusBadge tone={a.nivel === NIVEIS.ADMIN ? "info" : "neutral"}>
                          {nivelLabel(a.nivel)}
                        </StatusBadge>
                      </td>
                      <td className="min-w-44 p-3">
                        <Select
                          value={a.fase || NO_PHASE}
                          onValueChange={(fase) =>
                            run(
                              () => withCurrentSession((headers) => setFase({
                                data: { userId: a.id, fase: fase === NO_PHASE ? "" : fase },
                                headers,
                              })),
                              "Fase atualizada.",
                            )
                          }
                        >
                          <SelectTrigger className="h-8"><SelectValue placeholder="Sem fase" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_PHASE}>Sem fase</SelectItem>
                            {(fases ?? []).map((fase) => (
                              <SelectItem key={fase.id} value={fase.nome}>{fase.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3">
                        <StatusBadge tone={ACCOUNT_STATUS[a.status]?.tone ?? "neutral"}>
                          {ACCOUNT_STATUS[a.status]?.label ?? a.status}
                        </StatusBadge>
                      </td>
                      <td className="p-3">
                        <Actions
                          account={a}
                          isSelf={a.id === profile?.id}
                          onConfirm={setConfirm}
                          onReset={() => {
                            setResetFor({ id: a.id, name: a.war_name || a.full_name });
                            setNewPassword("");
                          }}
                          run={run}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Cards no celular */}
          <div className="space-y-3 lg:hidden">
            {filtered.map((a) => (
              <Card key={a.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{a.war_name || a.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{a.email}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StatusBadge tone={a.nivel === NIVEIS.ADMIN ? "info" : "neutral"}>
                        {nivelLabel(a.nivel)}
                      </StatusBadge>
                      <span className="text-xs text-muted-foreground">{a.fase || "Sem fase"}</span>
                      <StatusBadge tone={ACCOUNT_STATUS[a.status]?.tone ?? "neutral"}>
                        {ACCOUNT_STATUS[a.status]?.label ?? a.status}
                      </StatusBadge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Fase</Label>
                    <Select
                      value={a.fase || NO_PHASE}
                      onValueChange={(fase) =>
                        run(
                          () => withCurrentSession((headers) => setFase({
                            data: { userId: a.id, fase: fase === NO_PHASE ? "" : fase },
                            headers,
                          })),
                          "Fase atualizada.",
                        )
                      }
                    >
                      <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Sem fase" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_PHASE}>Sem fase</SelectItem>
                        {(fases ?? []).map((fase) => (
                          <SelectItem key={fase.id} value={fase.nome}>{fase.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Actions
                    account={a}
                    isSelf={a.id === profile?.id}
                    onConfirm={setConfirm}
                    onReset={() => {
                      setResetFor({ id: a.id, name: a.war_name || a.full_name });
                      setNewPassword("");
                    }}
                    run={run}
                  />
                </CardContent>
              </Card>
            ))}
          </div>

          {filtered.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Nenhuma conta encontrada.
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Novo usuário */}
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
            <DialogDescription>
              Apenas o e-mail é obrigatório. Se a senha ficar vazia, a pessoa receberá um convite
              para definir o acesso e poderá completar os demais dados em Minha Conta.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Text
              label="Nome completo (opcional)"
              className="sm:col-span-2"
              value={form.full_name}
              onChange={(v) => setForm({ ...form, full_name: v })}
            />
            <Text
              label="Nome de guerra (opcional)"
              value={form.war_name}
              onChange={(v) => setForm({ ...form, war_name: v })}
            />
            <Text
              label="E-mail / login"
              type="email"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
            />
            <Text
              label="Senha inicial (opcional)"
              type="password"
              value={form.password}
              onChange={(v) => setForm({ ...form, password: v })}
            />
            <div>
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Nível
              </Label>
              <Select value={form.nivel} onValueChange={(v) => setForm({ ...form, nivel: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NIVEIS.MEMBRO}>MEMBRO</SelectItem>
                  <SelectItem value={NIVEIS.SUPERVISOR}>SUPERVISOR</SelectItem>
                  <SelectItem value={NIVEIS.ADMIN}>ADMIN</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Text
              label="Nº de Gaivota"
              value={form.gaivota}
              onChange={(v) => setForm({ ...form, gaivota: v })}
            />
            <Picker
              label="Posto"
              value={form.posto}
              options={POSTOS}
              onChange={(v) => setForm({ ...form, posto: v })}
            />
            <Text label="TRI" value={form.tri} onChange={(v) => setForm({ ...form, tri: v })} />
            <Picker
              label="Esquadrão"
              value={form.esquadrao}
              options={currentSquadrons}
              onChange={(v) => setForm({ ...form, esquadrao: v })}
            />
            <Picker
              label="Diretoria"
              value={form.diretoria}
              options={(diretorias ?? []).map((d) => d.nome)}
              onChange={(v) => setForm({ ...form, diretoria: v })}
            />
            <Picker
              label="Fase"
              value={form.fase}
              options={(fases ?? []).map((fase) => fase.nome)}
              onChange={(v) => setForm({ ...form, fase: v })}
            />
            <Text
              label="Função no Voo a Vela"
              className="sm:col-span-2"
              value={form.funcao}
              onChange={(v) => setForm({ ...form, funcao: v })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)}>
              Cancelar
            </Button>
            <Button onClick={() => create.mutate(form)} disabled={create.isPending}>
              Criar usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Redefinir senha inicial */}
      <Dialog open={!!resetFor} onOpenChange={(o) => !o && setResetFor(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Redefinir senha inicial</DialogTitle>
            <DialogDescription>
              Uma nova senha inicial será definida para {resetFor?.name}. Informe-a ao usuário; ele
              poderá trocá-la em Minha Conta.
            </DialogDescription>
          </DialogHeader>
          <Text
            label="Nova senha inicial"
            type="password"
            value={newPassword}
            onChange={setNewPassword}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetFor(null)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                const id = resetFor?.id;
                if (!id) return;
                await run(
                  () =>
                    withCurrentSession((headers) =>
                      resetAccountPassword({
                        data: { userId: id, password: newPassword },
                        headers,
                      }),
                    ),
                  "Senha inicial redefinida.",
                );
                setResetFor(null);
              }}
            >
              Redefinir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ListasOperacionais />
      <CurrentSquadronsManager />
      <SequenciaMissoes />

      <div className="mt-6 space-y-4">
        <PageHeader
          title="Gerenciador de Categorias"
          description="Configurações operacionais: categorias e listas usadas em todo o sistema"
        />
        <CategoriaMissaoManager canEdit={canEdit} />
        <ListaSimplesManager
          title="Níveis Operacionais"
          table="operational_levels"
          queryKey="operational_levels"
          canEdit={canEdit}
          area="CONFIGURACOES"
        />
        <ListaSimplesManager
          title="Categorias do Calendário"
          table="calendar_categories"
          queryKey="calendar_categories"
          hasColor
          canEdit={canEdit}
          area="CALENDARIO"
        />
        <ListaSimplesManager
          title="Categorias do Comercial"
          table="commerce_categories"
          queryKey="commerce_categories"
          canEdit={canEdit}
          area="COMERCIAL"
        />
      </div>

      {/* Confirmação de ações sensíveis */}
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const action = confirm?.action;
                setConfirm(null);
                if (action) await action();
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

type Account = {
  id: string;
  full_name: string;
  war_name: string;
  email: string;
  status: string;
  nivel: string;
};

function CurrentSquadronsManager() {
  const qc = useQueryClient();
  const { data: saved } = useCurrentSquadrons();
  const [items, setItems] = useState(saved);
  const [newFirstYear, setNewFirstYear] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => setItems(saved), [saved.join("|")]);

  async function persist(next: string[]) {
    const clean = next.map((item) => item.trim());
    if (clean.some((item) => !item) || new Set(clean.map((item) => item.toLowerCase())).size !== 4) {
      toast.error("Informe quatro nomes de turma diferentes.");
      return false;
    }
    const { error } = await supabase.from("app_settings").upsert(
      { key: AFA_SQUADRONS_SETTING, value: JSON.stringify(clean) },
      { onConflict: "key" },
    );
    if (error) {
      toast.error("Não foi possível salvar os esquadrões: " + error.message);
      return false;
    }
    setItems(clean);
    await qc.invalidateQueries({ queryKey: ["setting", AFA_SQUADRONS_SETTING] });
    return true;
  }

  async function save() {
    setSaving(true);
    if (await persist(items)) toast.success("Esquadrões atuais atualizados.");
    setSaving(false);
  }

  async function rollover() {
    const incoming = newFirstYear.trim();
    if (!incoming) return toast.error("Informe o nome da nova turma do 1º ano.");
    const formed = items[3];
    if (!window.confirm(`Confirmar a passagem de ano? ${formed} sairá do Efetivo e continuará no Gaivotômetro.`)) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ status: "FORMADO" } as never)
      .in("esquadrao", [formed, "4º Esquadrão", "4° Esquadrão"]);
    if (error) {
      toast.error("Não foi possível formar o 4º ano: " + error.message);
      setSaving(false);
      return;
    }
    const next = [incoming, items[0], items[1], items[2]];
    if (await persist(next)) {
      setNewFirstYear("");
      await qc.invalidateQueries({ queryKey: ["profiles"] });
      await qc.invalidateQueries({ queryKey: ["profiles-all"] });
      toast.success(`${formed} movido para o Gaivotômetro. Passagem de ano concluída.`);
    }
    setSaving(false);
  }

  return (
    <Card className="mt-6">
      <CardHeader><CardTitle>Esquadrões atuais da AFA</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Defina qual turma ocupa cada ano. A passagem anual preserva todo o histórico dos formados.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, index) => (
            <div key={index}>
              <Label>{index + 1}º Esquadrão</Label>
              <Input className="mt-1" value={item} onChange={(e) => setItems((current) => current.map((value, i) => i === index ? e.target.value : value))} />
            </div>
          ))}
        </div>
        <Button variant="outline" disabled={saving} onClick={save}>Salvar configuração</Button>
        <div className="border-t pt-4">
          <Label>Nova turma do 1º ano</Label>
          <div className="mt-1 flex max-w-xl gap-2">
            <Input placeholder="Nome da nova turma" value={newFirstYear} onChange={(e) => setNewFirstYear(e.target.value)} />
            <Button disabled={saving} onClick={rollover}>Realizar passagem de ano</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Actions({
  account,
  isSelf,
  onConfirm,
  onReset,
  run,
}: {
  account: Account;
  isSelf: boolean;
  onConfirm: (c: Confirm) => void;
  onReset: () => void;
  run: (fn: () => Promise<unknown>, ok: string) => Promise<void>;
}) {
  const name = account.war_name || account.full_name || account.email;

  return (
    <div className="flex flex-wrap gap-1.5">
      <Select
        value={account.nivel}
        disabled={isSelf}
        onValueChange={(targetNivel) => {
          if (targetNivel === account.nivel) return;
          onConfirm({
            title: `Tornar ${name} ${nivelLabel(targetNivel)}?`,
            description:
              targetNivel === NIVEIS.ADMIN
                ? "O usuário passará a gerenciar contas e permissões."
                : targetNivel === NIVEIS.SUPERVISOR
                  ? "O usuário terá acesso amplo às áreas operacionais, sem administrar contas."
                  : "O usuário ficará com as permissões comuns de membro.",
            action: () =>
              run(
                () => withCurrentSession((headers) => setAccountNivel({ data: { userId: account.id, nivel: targetNivel }, headers })),
                "Nível alterado.",
              ),
          });
        }}
      >
        <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NIVEIS.MEMBRO}>MEMBRO</SelectItem>
          <SelectItem value={NIVEIS.SUPERVISOR}>SUPERVISOR</SelectItem>
          <SelectItem value={NIVEIS.ADMIN}>ADMIN</SelectItem>
        </SelectContent>
      </Select>
      {account.status === "ATIVO" ? (
        <Button
          size="sm"
          variant="outline"
          disabled={isSelf}
          onClick={() =>
            onConfirm({
              title: `Bloquear ${name}?`,
              description: "O usuário perderá o acesso ao sistema imediatamente.",
              action: () =>
                run(
                  () =>
                    withCurrentSession((headers) =>
                      setAccountStatus({
                        data: { userId: account.id, status: "BLOQUEADO" },
                        headers,
                      }),
                    ),
                  "Usuário bloqueado.",
                ),
            })
          }
        >
          Bloquear
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          disabled={isSelf}
          onClick={() =>
            onConfirm({
              title: `Desbloquear ${name}?`,
              description: "O usuário voltará a acessar o sistema normalmente.",
              action: () =>
                run(
                  () =>
                    withCurrentSession((headers) =>
                      setAccountStatus({
                        data: { userId: account.id, status: "ATIVO" },
                        headers,
                      }),
                    ),
                  "Usuário desbloqueado.",
                ),
            })
          }
        >
          Desbloquear
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        disabled={isSelf || account.status === "DESATIVADO"}
        onClick={() =>
          onConfirm({
            title: `Desativar ${name}?`,
            description:
              "A conta ficará desativada e sem acesso. Os dados do efetivo e o histórico são preservados.",
            action: () =>
              run(
                () =>
                  withCurrentSession((headers) =>
                    setAccountStatus({
                      data: { userId: account.id, status: "DESATIVADO" },
                      headers,
                    }),
                  ),
                "Usuário desativado.",
              ),
          })
        }
      >
        Desativar
      </Button>
      <Button size="sm" variant="outline" onClick={onReset}>
        Redefinir senha
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="border-danger/40 text-danger hover:bg-danger/10"
        disabled={isSelf}
        onClick={() =>
          onConfirm({
            title: `Excluir ${name} definitivamente?`,
            description:
              "A conta e o perfil são apagados e o acesso é encerrado. O histórico operacional (escala, planilha do anotador e progressão) é preservado, mantendo o registro do integrante excluído. Esta ação não pode ser desfeita.",
            action: () =>
              run(
                () =>
                  withCurrentSession((headers) =>
                    deleteAccount({ data: { userId: account.id }, headers }),
                  ),
                "Usuário excluído.",
              ),
          })
        }
      >
        Excluir
      </Button>
    </div>
  );
}

function Text({
  label,
  value,
  onChange,
  type,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input
        className="mt-1"
        type={type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Picker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Select value={value || "—"} onValueChange={(v) => onChange(v === "—" ? "" : v)}>
        <SelectTrigger className="mt-1">
          <SelectValue placeholder="Selecionar" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="—">Não informado</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/* ---------- Listas operacionais: aeronaves e códigos de chamada ---------- */

function ListasOperacionais() {
  const qc = useQueryClient();
  const { data: aircraft } = useAircraft();
  const { data: callsigns } = useCallsigns();
  const { data: aircraftModelsRaw } = useSetting("aircraft_models");
  const [novaAeronave, setNovaAeronave] = useState({
    identificacao: "",
    tipo: "PLANADOR",
    modelo: "DG-1000 / DG-1001",
  });
  const [novoCallsign, setNovoCallsign] = useState("");
  const [novoModelo, setNovoModelo] = useState("");
  const [modeloParaApagar, setModeloParaApagar] = useState<string | null>(null);
  const [apagandoModelo, setApagandoModelo] = useState(false);

  const modelos = useMemo(() => {
    let cadastrados: string[] = [];
    try {
      const parsed = JSON.parse(aircraftModelsRaw || "[]");
      if (Array.isArray(parsed)) cadastrados = parsed.filter((item) => typeof item === "string");
    } catch {
      cadastrados = [];
    }
    const base = aircraftModelsRaw ? cadastrados : AIRCRAFT_MODELOS;
    return [...new Set([...base, ...(aircraft ?? []).map((a) => a.modelo)])]
      .map((modelo) => modelo.trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [aircraft, aircraftModelsRaw]);

  async function addModelo() {
    const nome = novoModelo.trim();
    if (!nome) return;
    if (modelos.some((modelo) => modelo.toLocaleLowerCase() === nome.toLocaleLowerCase())) {
      toast.error("Este modelo já está cadastrado.");
      return;
    }
    const proximos = [...modelos, nome].sort((a, b) => a.localeCompare(b, "pt-BR"));
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "aircraft_models", value: JSON.stringify(proximos) }, { onConflict: "key" });
    if (error) {
      toast.error(error.message);
      return;
    }
    setNovoModelo("");
    setNovaAeronave((atual) => ({ ...atual, modelo: nome }));
    await qc.invalidateQueries({ queryKey: ["setting", "aircraft_models"] });
    toast.success("Modelo cadastrado e selecionado.");
  }

  async function addAeronave() {
    const identificacao = novaAeronave.identificacao.trim();
    if (!identificacao) return;
    const { error } = await supabase.from("aircraft").insert({
      identificacao,
      tipo: novaAeronave.tipo,
      modelo: novaAeronave.modelo,
      sort_order: (aircraft?.length ?? 0) + 1,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setNovaAeronave({ identificacao: "", tipo: "PLANADOR", modelo: "DG-1000 / DG-1001" });
    await qc.invalidateQueries({ queryKey: ["aircraft"] });
  }

  async function removeModelo() {
    if (!modeloParaApagar) return;
    setApagandoModelo(true);
    const vinculadas = (aircraft ?? []).filter((a) => a.modelo === modeloParaApagar);
    if (vinculadas.length) {
      const { error: unlinkError } = await supabase
        .from("aircraft")
        .update({ modelo: "" })
        .eq("modelo", modeloParaApagar);
      if (unlinkError) {
        setApagandoModelo(false);
        toast.error(unlinkError.message);
        return;
      }
    }
    const restantes = modelos.filter((modelo) => modelo !== modeloParaApagar);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "aircraft_models", value: JSON.stringify(restantes) }, { onConflict: "key" });
    setApagandoModelo(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (novaAeronave.modelo === modeloParaApagar) {
      setNovaAeronave((atual) => ({ ...atual, modelo: restantes[0] ?? "" }));
    }
    setModeloParaApagar(null);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["setting", "aircraft_models"] }),
      qc.invalidateQueries({ queryKey: ["aircraft"] }),
    ]);
    toast.success(
      vinculadas.length
        ? `Modelo apagado e ${vinculadas.length} aeronave${vinculadas.length === 1 ? " desvinculada" : "s desvinculadas"}.`
        : "Modelo apagado.",
    );
  }

  async function addCallsign() {
    const nome = novoCallsign.trim();
    if (!nome) return;
    const { error } = await supabase
      .from("callsigns")
      .insert({ nome, sort_order: (callsigns?.length ?? 0) + 1 });
    if (error) {
      toast.error(error.message);
      return;
    }
    setNovoCallsign("");
    await qc.invalidateQueries({ queryKey: ["callsigns"] });
  }

  async function updateModelo(id: string, modelo: string) {
    const { error } = await supabase.from("aircraft").update({ modelo }).eq("id", id);
    if (error) toast.error(error.message);
    else await qc.invalidateQueries({ queryKey: ["aircraft"] });
  }

  async function remove(table: "aircraft" | "callsigns", id: string) {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) toast.error(error.message);
    else await qc.invalidateQueries({ queryKey: [table] });
  }

  return (
    <>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
              Aeronaves
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <Label>Novo modelo de aeronave</Label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <Input
                  className="max-w-[18rem]"
                  placeholder="ex.: ASK 21"
                  value={novoModelo}
                  onChange={(e) => setNovoModelo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addModelo();
                  }}
                />
                <Button size="sm" variant="outline" onClick={addModelo}>
                  <Plus className="mr-1.5 h-4 w-4" /> Criar modelo
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Os modelos cadastrados aparecem no seletor de cada aeronave e no agrupamento do
                Panorama.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {modelos.map((modelo) => (
                  <span
                    key={modelo}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium"
                  >
                    {modelo}
                    <button
                      type="button"
                      aria-label={`Apagar modelo ${modelo}`}
                      className="text-muted-foreground hover:text-danger"
                      onClick={() => setModeloParaApagar(modelo)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Input
                className="max-w-[10rem]"
                placeholder="ex.: 8121"
                value={novaAeronave.identificacao}
                onChange={(e) =>
                  setNovaAeronave({ ...novaAeronave, identificacao: e.target.value })
                }
              />
              <Select
                value={novaAeronave.tipo}
                onValueChange={(v) => setNovaAeronave({ ...novaAeronave, tipo: v })}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AIRCRAFT_TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={novaAeronave.modelo}
                onValueChange={(v) => setNovaAeronave({ ...novaAeronave, modelo: v })}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {modelos.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={addAeronave}>
                Adicionar
              </Button>
            </div>
            <ul className="divide-y divide-border rounded border border-border">
              {(aircraft ?? []).map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm"
                >
                  <span>
                    <span className="font-mono font-semibold">{a.identificacao}</span>
                    <span className="ml-2 text-muted-foreground">{a.tipo}</span>
                  </span>
                  <Select value={a.modelo || "Outro"} onValueChange={(v) => updateModelo(a.id, v)}>
                    <SelectTrigger className="ml-auto h-8 w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {modelos.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    aria-label="Remover aeronave"
                    className="text-xs uppercase tracking-wider text-danger"
                    onClick={() => remove("aircraft", a.id)}
                  >
                    Remover
                  </button>
                </li>
              ))}
              {(aircraft ?? []).length === 0 && (
                <li className="px-3 py-3 text-sm text-muted-foreground">Nenhuma aeronave.</li>
              )}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
              Códigos de chamada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Input
                className="max-w-[14rem]"
                placeholder="ex.: Gaivota 01"
                value={novoCallsign}
                onChange={(e) => setNovoCallsign(e.target.value)}
              />
              <Button size="sm" onClick={addCallsign}>
                Adicionar
              </Button>
            </div>
            <ul className="divide-y divide-border rounded border border-border">
              {(callsigns ?? []).map((c) => (
                <li key={c.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
                  <span>{c.nome}</span>
                  <button
                    type="button"
                    aria-label="Remover código de chamada"
                    className="text-xs uppercase tracking-wider text-danger"
                    onClick={() => remove("callsigns", c.id)}
                  >
                    Remover
                  </button>
                </li>
              ))}
              {(callsigns ?? []).length === 0 && (
                <li className="px-3 py-3 text-sm text-muted-foreground">
                  Nenhum código cadastrado.
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
      <AlertDialog
        open={!!modeloParaApagar}
        onOpenChange={(open) => !open && setModeloParaApagar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar o modelo “{modeloParaApagar}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {(aircraft ?? []).filter((a) => a.modelo === modeloParaApagar).length > 0
                ? `${(aircraft ?? []).filter((a) => a.modelo === modeloParaApagar).length} aeronave(s) vinculada(s) ficarão sem modelo até serem reclassificadas.`
                : "O modelo será removido dos seletores e do agrupamento do Panorama."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={apagandoModelo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={apagandoModelo} onClick={removeModelo}>
              {apagandoModelo ? "Apagando…" : "Apagar modelo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ---------- Sequência de missões: alimenta a progressão automática ---------- */

function SequenciaMissoes() {
  const qc = useQueryClient();
  const { data: sequencia } = useMissionSequence();
  const [nova, setNova] = useState({ categoria: "PS", missao: "", proxima: "", pane: false });

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["mission_sequence"] });
  }

  async function add() {
    const missao = nova.missao.trim().toUpperCase();
    const proxima = nova.proxima.trim().toUpperCase();
    if (!missao || !proxima) return;
    const { error } = await supabase.from("mission_sequence").insert({
      categoria: nova.categoria.trim().toUpperCase() || "PS",
      missao,
      proxima,
      pane: nova.pane,
      sort_order: (sequencia?.length ?? 0) + 1,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setNova({ categoria: nova.categoria, missao: "", proxima: "", pane: false });
    await refresh();
  }

  async function update(id: string, patch: { proxima?: string; pane?: boolean }) {
    const { error } = await supabase.from("mission_sequence").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else await refresh();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("mission_sequence").delete().eq("id", id);
    if (error) toast.error(error.message);
    else await refresh();
  }

  return (
    <Card className="mt-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
          Sequência de missões
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Define a progressão usada automaticamente quando um resultado é lançado na Planilha do
          Anotador (ex.: PS-19 aprovado → X1). Missões marcadas como PANE têm prioridade na escala.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <Input
            className="w-24"
            placeholder="PS"
            aria-label="Categoria"
            value={nova.categoria}
            onChange={(e) => setNova({ ...nova, categoria: e.target.value.toUpperCase() })}
          />
          <Input
            className="w-28"
            placeholder="PS-19"
            aria-label="Missão"
            value={nova.missao}
            onChange={(e) => setNova({ ...nova, missao: e.target.value.toUpperCase() })}
          />
          <Input
            className="w-28"
            placeholder="X1"
            aria-label="Próxima missão"
            value={nova.proxima}
            onChange={(e) => setNova({ ...nova, proxima: e.target.value.toUpperCase() })}
          />
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={nova.pane}
              onChange={(e) => setNova({ ...nova, pane: e.target.checked })}
            />
            PANE
          </label>
          <Button size="sm" onClick={add}>
            Adicionar
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-2 text-left">Categoria</th>
                <th className="p-2 text-left">Missão</th>
                <th className="p-2 text-left">Próxima</th>
                <th className="p-2 text-left">PANE</th>
                <th className="p-2 text-left">Ações</th>
              </tr>
            </thead>
            <tbody>
              {(sequencia ?? []).map((m) => (
                <tr key={m.id} className="border-b border-border/60">
                  <td className="p-2 font-mono">{m.categoria}</td>
                  <td className="p-2 font-mono font-semibold">{m.missao}</td>
                  <td className="p-2">
                    <Input
                      className="h-8 w-28 font-mono"
                      defaultValue={m.proxima}
                      aria-label={`Próxima missão de ${m.missao}`}
                      onBlur={(e) => {
                        const v = e.target.value.trim().toUpperCase();
                        if (v && v !== m.proxima) update(m.id, { proxima: v });
                      }}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="checkbox"
                      aria-label={`Missão de PANE: ${m.missao}`}
                      checked={m.pane}
                      onChange={(e) => update(m.id, { pane: e.target.checked })}
                    />
                  </td>
                  <td className="p-2">
                    <button
                      type="button"
                      className="text-xs uppercase tracking-wider text-danger"
                      onClick={() => remove(m.id)}
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
              {(sequencia ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="p-3 text-sm text-muted-foreground">
                    Nenhuma sequência cadastrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
