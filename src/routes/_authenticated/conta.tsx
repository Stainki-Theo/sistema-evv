import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { PhotoAvatar } from "@/components/PhotoAvatar";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth, displayName } from "@/lib/auth";
import { useProfiles, useCurrentSquadrons, uploadPhoto, removePhoto, updateProfileRestricted } from "@/lib/data";
import { usePermissoes } from "@/lib/permissoes";
import { logChange } from "@/lib/audit";
import { ComboCreate } from "@/components/ComboCreate";
import { findSimilar, operationalLevelLabel, useOperationalLevels } from "@/lib/categorias";
import {
  nivelLabel,
  minutesToClock,
  hoursToMinutes,
  normalizeTri,
  personTag,
  POSTOS,
  OPR_OPTIONS,
} from "@/lib/evv";

/** Radix Select não aceita valor "" — sentinela para "não informado". */
const NONE = "__none__";

export const Route = createFileRoute("/_authenticated/conta")({
  head: () => ({
    meta: [
      { title: "Minha Conta — EVV" },
      {
        name: "description",
        content: "Dados da sua conta no EVV e alteração da sua própria senha de acesso.",
      },
      { property: "og:title", content: "Minha Conta — EVV" },
      { property: "og:description", content: "Consulte seus dados e altere sua senha no EVV." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContaPage,
});

function ContaPage() {
  const { profile, role, session, refresh } = useAuth();
  const { canManageOps } = usePermissoes();
  const qc = useQueryClient();
  const { data: profiles } = useProfiles();
  const { data: currentSquadrons } = useCurrentSquadrons();
  const { data: niveis } = useOperationalLevels();
  const [pass, setPass] = useState("");
  const [tri, setTri] = useState("");
  const [horas, setHoras] = useState("");
  const [fullName, setFullName] = useState("");
  const [warName, setWarName] = useState("");
  const [gaivota, setGaivota] = useState("");
  const [esquadrao, setEsquadrao] = useState("");
  const [posto, setPosto] = useState("");
  const [ops, setOps] = useState("0");
  const [pousos, setPousos] = useState("0");
  const [oprDg, setOprDg] = useState("");
  const [oprDuo, setOprDuo] = useState("");
  const [oprCs, setOprCs] = useState("");
  const [inPessoal, setInPessoal] = useState(NONE);
  const [nivelOperacional, setNivelOperacional] = useState("");
  const [savingOps, setSavingOps] = useState(false);
  const [savingFoto, setSavingFoto] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropUrl, setCropUrl] = useState("");
  const [cropZoom, setCropZoom] = useState(1);
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);

  useEffect(() => {
    setTri(profile?.tri ?? "");
    setHoras(minutesToClock(profile?.flight_minutes));
    setFullName(profile?.full_name ?? "");
    setWarName(profile?.war_name ?? "");
    setGaivota(profile?.gaivota ?? "");
    setEsquadrao(profile?.esquadrao ?? "");
    setPosto(profile?.posto ?? "");
    setOps(String(profile?.ops ?? 0));
    setPousos(String(profile?.pso ?? 0));
    setOprDg(profile?.opr_dg ?? "");
    setOprDuo(profile?.opr_duo ?? "");
    setOprCs(profile?.opr_cs ?? "");
    setInPessoal(profile?.in_pessoal_id ?? NONE);
    setNivelOperacional(profile?.nivel_operacional ?? "");
  }, [profile]);

  /** Foto pessoal: substitui a anterior e mantém o espaço de arquivos limpo. */
  async function trocarFoto(file: File | null) {
    if (!file || !profile?.id) return;
    setSavingFoto(true);
    try {
      const anterior = profile.avatar_path;
      const path = await uploadPhoto(`integrantes/${profile.id}`, file);
      await updateProfileRestricted({ data: { id: profile.id, patch: { avatar_path: path } } });
      await removePhoto(anterior);
      await refresh();
      await qc.invalidateQueries({ queryKey: ["profiles"] });
      await qc.invalidateQueries({ queryKey: ["profiles", "ativos"] });
      await qc.invalidateQueries({ queryKey: ["photo", path] });
      toast.success("Foto atualizada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar a foto.");
    } finally {
      setSavingFoto(false);
    }
  }

  function escolherFoto(file: File | null) {
    if (!file) return;
    if (cropUrl) URL.revokeObjectURL(cropUrl);
    setCropFile(file);
    setCropUrl(URL.createObjectURL(file));
    setCropZoom(1);
    setCropX(0);
    setCropY(0);
  }

  async function confirmarEnquadramento() {
    if (!cropFile || !cropUrl) return;
    const image = new Image();
    image.src = cropUrl;
    await image.decode();
    const size = 800;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não foi possível preparar a imagem.");

    const cover = Math.max(size / image.naturalWidth, size / image.naturalHeight);
    const scale = cover * cropZoom;
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    const overflowX = Math.max(0, width - size);
    const overflowY = Math.max(0, height - size);
    const x = (size - width) / 2 + (cropX / 100) * (overflowX / 2);
    const y = (size - height) / 2 + (cropY / 100) * (overflowY / 2);
    ctx.drawImage(image, x, y, width, height);

    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error("Falha ao gerar a foto."))),
        "image/jpeg",
        0.92,
      ),
    );
    const ready = new File([blob], `${cropFile.name.replace(/\.[^.]+$/, "")}-perfil.jpg`, {
      type: "image/jpeg",
    });
    await trocarFoto(ready);
    URL.revokeObjectURL(cropUrl);
    setCropFile(null);
    setCropUrl("");
  }

  async function salvarInPessoal(inPessoalId: string | null) {
    if (!profile?.id) return;
    try {
      await updateProfileRestricted({
        data: { id: profile.id, patch: { in_pessoal_id: inPessoalId } },
      });
      await refresh();
      await qc.invalidateQueries({ queryKey: ["profiles"] });
      await qc.invalidateQueries({ queryKey: ["profiles", "ativos"] });
      toast.success("Salvo.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  }

  async function salvarNivelOperacional(nivel: string) {
    if (!profile?.id) return;
    const { error } = await supabase
      .from("profiles")
      .update({ nivel_operacional: nivel } as never)
      .eq("id", profile.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refresh();
    await qc.invalidateQueries({ queryKey: ["profiles"] });
    await qc.invalidateQueries({ queryKey: ["profiles", "ativos"] });
    toast.success("Nível operacional atualizado.");
  }

  async function criarNivelOperacional(nomeDigitado: string) {
    const nome = nomeDigitado.trim();
    if (!nome) return;
    const similar = findSimilar(niveis ?? [], (n) => n.nome, nome);
    if (similar && similar.nome !== nome) {
      const ok = window.confirm(
        `Já existe um nível semelhante ("${similar.nome}"). Deseja realmente criar um novo?`,
      );
      if (!ok) return;
    } else if (similar) {
      toast.error("Esse nível já existe.");
      return;
    }
    const { data, error } = await supabase
      .from("operational_levels")
      .insert({ nome, sort_order: (niveis?.length ?? 0) + 1 } as never)
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    await logChange(
      {
        area: "CONFIGURACOES",
        entity: "operational_levels",
        entityId: (data as { id: string }).id,
        entityLabel: nome,
        action: "INSERT",
        newValue: nome,
      },
      { id: profile?.id, tag: displayName(profile) },
    );
    await qc.invalidateQueries({ queryKey: ["operational_levels"] });
    setNivelOperacional(nome);
    await salvarNivelOperacional(nome);
  }

  async function saveOperacional() {
    if (!profile?.id) return;
    setSavingOps(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        tri: normalizeTri(tri),
        flight_minutes: hoursToMinutes(horas),
        war_name: warName.trim(),
        gaivota: gaivota.trim(),
        esquadrao: esquadrao,
        posto,
        ops: Math.max(0, Number.parseInt(ops, 10) || 0),
        pso: Math.max(0, Number.parseInt(pousos, 10) || 0),
        opr_dg: oprDg,
        opr_duo: oprDuo,
        opr_cs: oprCs,
      } as never)
      .eq("id", profile.id);
    setSavingOps(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refresh();
    toast.success("Dados operacionais atualizados.");
  }

  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function changePassword() {
    if (pass.length < 6) {
      toast.error("A nova senha precisa ter no mínimo 6 caracteres.");
      return;
    }
    if (pass !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pass });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPass("");
    setConfirm("");
    toast.success("Senha alterada com sucesso.");
  }

  async function recover() {
    const email = profile?.email || session?.user?.email;
    if (!email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Enviamos um e-mail de recuperação de senha.");
  }

  return (
    <>
      <PageHeader title="Minha Conta" description="Seus dados de acesso ao EVV" />

      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
            Foto e instrução
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-5">
          <PhotoAvatar
            path={profile?.avatar_path ?? null}
            alt={`Sua foto — ${personTag(profile)}`}
            fallback={profile?.tri ?? ""}
            className="h-20 w-20"
          />
          <div className="min-w-48">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Trocar foto pessoal
            </Label>
            <Input
              className="mt-1"
              type="file"
              accept="image/*"
              disabled={savingFoto}
              onChange={(e) => escolherFoto(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="min-w-56">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">IN</Label>
            <Select
              value={inPessoal}
              onValueChange={(v) => {
                setInPessoal(v);
                void salvarInPessoal(v === NONE ? null : v);
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Não informado</SelectItem>
                {(profiles ?? [])
                  .filter((p) => p.id !== profile?.id)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {personTag(p)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(cropFile)}
        onOpenChange={(open) => {
          if (!open) {
            if (cropUrl) URL.revokeObjectURL(cropUrl);
            setCropFile(null);
            setCropUrl("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enquadrar foto de perfil</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="mx-auto aspect-square w-full max-w-80 overflow-hidden rounded-full bg-muted">
              {cropUrl ? (
                <img
                  src={cropUrl}
                  alt="Prévia do enquadramento"
                  className="h-full w-full object-cover"
                  style={{
                    transform: `translate(${cropX / 2}%, ${cropY / 2}%) scale(${cropZoom})`,
                  }}
                />
              ) : null}
            </div>
            <CropControl
              label="Zoom"
              min={1}
              max={3}
              step={0.05}
              value={cropZoom}
              onChange={setCropZoom}
            />
            <CropControl
              label="Mover na horizontal"
              min={-100}
              max={100}
              step={1}
              value={cropX}
              onChange={setCropX}
            />
            <CropControl
              label="Mover na vertical"
              min={-100}
              max={100}
              step={1}
              value={cropY}
              onChange={setCropY}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCropFile(null)}>
              Cancelar
            </Button>
            <Button onClick={() => void confirmarEnquadramento()} disabled={savingFoto}>
              {savingFoto ? "Salvando…" : "Confirmar foto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
              Dados da conta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row k="Nome completo" v={profile?.full_name} />
            <Row k="Nome de guerra" v={profile?.war_name} />
            <Row k="Identificação operacional" v={personTag(profile)} />
            <Row k="Nível operacional" v={operationalLevelLabel(profile?.nivel_operacional)} />
            <Row k="Esquadrão" v={profile?.esquadrao} />
            <Row k="E-mail / login" v={profile?.email || session?.user?.email} />
            <div className="flex items-center justify-between gap-3 py-0.5">
              <span className="text-muted-foreground">Nível da conta</span>
              <StatusBadge tone={nivelLabel(role) === "ADMIN" ? "info" : "neutral"}>
                {nivelLabel(role)}
              </StatusBadge>
            </div>
            <p className="pt-2 text-xs text-muted-foreground">
              Conectado como {displayName(profile)}.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
              Alterar senha
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Nova senha
              </Label>
              <Input
                className="mt-1"
                type="password"
                autoComplete="new-password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Confirmar nova senha
              </Label>
              <Input
                className="mt-1"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={changePassword} disabled={saving}>
                Alterar senha
              </Button>
              <Button variant="outline" onClick={recover}>
                Receber e-mail de recuperação
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              A nova senha é definida apenas por você — o administrador não tem acesso a ela. Seus
              demais dados do efetivo permanecem inalterados.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
              Meus dados operacionais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Nome completo
                </Label>
                <Input
                  className="mt-1"
                  placeholder="Seu nome completo"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Nome de guerra
                </Label>
                <Input
                  className="mt-1"
                  placeholder="ex.: STAINKI"
                  value={warName}
                  onChange={(e) => setWarName(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Nº de gaivota
                </Label>
                <Input
                  className="mt-1"
                  placeholder="ex.: 1234"
                  value={gaivota}
                  onChange={(e) => setGaivota(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Esquadrão
                </Label>
                <Select value={esquadrao || NONE} onValueChange={(v) => setEsquadrao(v === NONE ? "" : v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Não informado</SelectItem>
                    {currentSquadrons.map((item) => (
                      <SelectItem key={item} value={item}>{item}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Posto / Graduação
                </Label>
                <Select value={posto || NONE} onValueChange={(v) => setPosto(v === NONE ? "" : v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Não informado</SelectItem>
                    {POSTOS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Nível operacional
                </Label>
                <ComboCreate
                  className="mt-1"
                  value={nivelOperacional}
                  options={(niveis ?? []).map((n) => ({ value: n.nome, label: n.nome }))}
                  placeholder="Selecionar"
                  allowCreate={canManageOps}
                  onSelect={(v) => {
                    setNivelOperacional(v);
                    void salvarNivelOperacional(v);
                  }}
                  onCreate={(label) => void criarNivelOperacional(label)}
                />
              </div>
              <div>
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Trigrama (TRI)
                </Label>
                <Input
                  className="mt-1 uppercase"
                  maxLength={3}
                  placeholder="ex.: STK"
                  value={tri}
                  onChange={(e) => setTri(normalizeTri(e.target.value))}
                />
              </div>
              <div>
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Horas de voo (h:mm)
                </Label>
                <Input
                  className="mt-1 font-mono"
                  placeholder="ex.: 137:50"
                  value={horas}
                  onChange={(e) => setHoras(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Operações (OPS)
                </Label>
                <Input
                  className="mt-1 font-mono"
                  type="number"
                  min={0}
                  step={1}
                  value={ops}
                  onChange={(e) => setOps(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Pousos (PSO)
                </Label>
                <Input
                  className="mt-1 font-mono"
                  type="number"
                  min={0}
                  step={1}
                  value={pousos}
                  onChange={(e) => setPousos(e.target.value)}
                />
              </div>
              <OprSelect label="OPR DG" value={oprDg} onChange={setOprDg} />
              <OprSelect label="OPR DUO" value={oprDuo} onChange={setOprDuo} />
              <OprSelect label="OPR CS" value={oprCs} onChange={setOprCs} />
            </div>
            <Button onClick={saveOperacional} disabled={savingOps}>
              Salvar dados operacionais
            </Button>
            <p className="text-xs text-muted-foreground">
              Trigrama, horas, OPS, pousos e qualificações OPR fazem parte do cadastro único do
              integrante e aparecem nas demais áreas operacionais.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v?: string | null | undefined }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-0.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v || "—"}</span>
    </div>
  );
}

function OprSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Select value={value || NONE} onValueChange={(next) => onChange(next === NONE ? "" : next)}>
        <SelectTrigger className="mt-1">
          <SelectValue placeholder="Selecionar" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Não informado</SelectItem>
          {OPR_OPTIONS.filter(Boolean).map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function CropControl({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-primary"
      />
    </div>
  );
}
