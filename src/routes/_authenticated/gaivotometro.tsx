import { createFileRoute } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Clock3, Plane, Settings2, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { PhotoAvatar } from "@/components/PhotoAvatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { useAllProfiles } from "@/lib/data";
import { minutesToClock } from "@/lib/evv";
import { useAuth } from "@/lib/auth";
import { operationalLevelLabel } from "@/lib/categorias";

const META_PREFIX = "gaivotometro:meta:";

type GaivotometroMeta = {
  profile_id: string;
  publicado: boolean;
  titulos: string;
  formado_em: string;
  foto_x: number;
  foto_y: number;
  foto_zoom: number;
};

/**
 * Mantém a foto cobrindo o quadro e transforma os controles X/Y em deslocamento
 * real. O object-position sozinho deixa de responder em um dos eixos quando a
 * imagem, após o cover, não possui sobra naquele sentido.
 */
function frameStyle(x: number, y: number, zoom: number): CSSProperties {
  const safeZoom = Math.max(1, zoom);
  const availablePan = ((safeZoom - 1) / safeZoom) * 50;
  const translateX = (x / 100) * availablePan;
  const translateY = (y / 100) * availablePan;
  return {
    objectPosition: "50% 50%",
    transformOrigin: "50% 50%",
    transform: `scale(${safeZoom}) translate(${translateX}%, ${translateY}%)`,
    transition: "transform 80ms ease-out",
  };
}

async function listGaivotometroMeta(): Promise<GaivotometroMeta[]> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("key,value")
    .like("key", `${META_PREFIX}%`);
  if (error) throw error;
  return (data ?? []).flatMap((row) => {
    try {
      const parsed = JSON.parse(row.value ?? "{}");
      return [
        {
          profile_id: row.key.slice(META_PREFIX.length),
          publicado: Boolean(parsed.publicado),
          titulos: String(parsed.titulos ?? ""),
          formado_em: String(parsed.formado_em ?? ""),
          foto_x: Number(parsed.foto_x) || 0,
          foto_y: Number(parsed.foto_y) || 0,
          foto_zoom: Math.max(1, Number(parsed.foto_zoom) || 1),
        },
      ];
    } catch {
      return [];
    }
  });
}

export const Route = createFileRoute("/_authenticated/gaivotometro")({
  component: GaivotometroPage,
  head: () => ({ meta: [{ title: "Gaivotômetro — EVV" }] }),
});

function GaivotometroPage() {
  const { profile: currentProfile } = useAuth();
  const qc = useQueryClient();
  const { data: profiles, isLoading: loadingProfiles } = useAllProfiles();
  const { data: metas, isLoading: loadingMeta } = useQuery({
    queryKey: ["gaivotometro-meta"],
    queryFn: () => listGaivotometroMeta(),
  });
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ foto_x: 0, foto_y: 0, foto_zoom: 1 });

  const alumni = useMemo(() => {
    const map = new Map((metas ?? []).map((meta) => [meta.profile_id, meta]));
    return (profiles ?? [])
      .map((profile) => ({
        profile,
        meta: map.get(profile.id) ?? {
          profile_id: profile.id,
          publicado: true,
          titulos: "",
          formado_em: "",
          foto_x: 0,
          foto_y: 0,
          foto_zoom: 1,
        },
      }))
      .sort((a, b) => {
        const active = Number(b.profile.status === "ATIVO") - Number(a.profile.status === "ATIVO");
        return (
          active ||
          (b.profile.flight_minutes ?? 0) - (a.profile.flight_minutes ?? 0) ||
          (a.profile.war_name || a.profile.full_name).localeCompare(
            b.profile.war_name || b.profile.full_name,
          )
        );
      });
  }, [profiles, metas]);

  const adjusting = alumni.find(({ profile }) => profile.id === adjustingId) ?? null;

  function openAdjust(profileId: string, meta: GaivotometroMeta) {
    if (currentProfile?.id !== profileId) return;
    setDraft({ foto_x: meta.foto_x, foto_y: meta.foto_y, foto_zoom: meta.foto_zoom });
    setAdjustingId(profileId);
  }

  async function saveFrame() {
    if (!adjusting || currentProfile?.id !== adjusting.profile.id) {
      setAdjustingId(null);
      return toast.error("Você só pode ajustar a foto do seu próprio perfil.");
    }
    const value = { ...adjusting.meta, ...draft, publicado: true };
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        { key: `${META_PREFIX}${adjusting.profile.id}`, value: JSON.stringify(value) },
        { onConflict: "key" },
      );
    if (error) return toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["gaivotometro-meta"] });
    setAdjustingId(null);
    toast.success("Enquadramento salvo.");
  }

  return (
    <>
      <PageHeader
        title="Gaivotômetro"
        description="Memória dos tripulantes que passaram pelo Esquadrão de Voo a Vela"
      />

      {loadingProfiles || loadingMeta ? (
        <p className="text-sm text-muted-foreground">Carregando galeria…</p>
      ) : alumni.length === 0 ? (
        <Card>
          <CardContent className="grid place-items-center gap-3 py-16 text-center text-muted-foreground">
            <UsersRound className="h-10 w-10" />
            <div>
              <p className="font-medium text-foreground">A galeria ainda está sendo preparada.</p>
              <p className="mt-1 text-sm">
                Os tripulantes aparecerão aqui assim que seus perfis forem cadastrados.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {alumni.map(({ profile, meta }, index) => (
            <article
              key={profile.id}
              className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative h-44 overflow-hidden bg-gradient-to-br from-sidebar to-aviation/70">
                <PhotoAvatar
                  path={profile.avatar_path}
                  alt={profile.war_name || profile.full_name}
                  fallback={profile.tri || profile.war_name}
                  className="h-full w-full rounded-none border-0 text-3xl"
                  imageStyle={frameStyle(meta.foto_x, meta.foto_y, meta.foto_zoom)}
                />
                <span className="absolute left-3 top-3 rounded-full bg-sidebar/85 px-2.5 py-1 font-mono text-xs font-bold text-white backdrop-blur">
                  #{String(index + 1).padStart(2, "0")}
                </span>
                {currentProfile?.id === profile.id && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute bottom-3 right-3 bg-background/90 shadow"
                    onClick={() => openAdjust(profile.id, meta)}
                  >
                    <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                    Ajustar minha foto
                  </Button>
                )}
              </div>
              <div className="p-4">
                <div className="mb-3">
                  <h2 className="text-lg font-bold leading-tight">
                    {profile.war_name || profile.full_name}
                  </h2>
                  <p className="mt-0.5 text-xs uppercase tracking-wider text-muted-foreground">
                    {profile.full_name}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Stat icon={Plane} label="Gaivota" value={profile.gaivota || "—"} />
                  <Stat
                    icon={Clock3}
                    label="Horas"
                    value={minutesToClock(profile.flight_minutes)}
                  />
                </div>
                <dl className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm">
                  <Line label="Posto" value={profile.posto || "—"} />
                  <Line label="Esquadrão" value={profile.esquadrao || "—"} />
                  <Line
                    label="Nível"
                    value={operationalLevelLabel(profile.nivel_operacional) || "—"}
                  />
                </dl>
                {meta.titulos && (
                  <div className="mt-3 flex gap-2 rounded-xl bg-aviation/8 p-3 text-sm text-aviation">
                    <Award className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{meta.titulos}</span>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <Dialog open={!!adjusting} onOpenChange={(open) => !open && setAdjustingId(null)}>
        {adjusting && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                Enquadrar foto de {adjusting.profile.war_name || adjusting.profile.full_name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-5">
              <div className="mx-auto h-72 w-full overflow-hidden rounded-2xl bg-muted">
                <PhotoAvatar
                  path={adjusting.profile.avatar_path}
                  alt={adjusting.profile.war_name || adjusting.profile.full_name}
                  fallback={adjusting.profile.tri || adjusting.profile.war_name}
                  className="h-full w-full rounded-none border-0 text-3xl"
                  imageStyle={frameStyle(draft.foto_x, draft.foto_y, draft.foto_zoom)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Ao mover a foto, o zoom mínimo de 1,20× é aplicado automaticamente para permitir
                deslocamento nos dois sentidos sem deixar bordas vazias.
              </p>
              <FrameControl
                label="Zoom"
                value={draft.foto_zoom}
                min={1}
                max={3}
                step={0.05}
                onChange={(foto_zoom) => setDraft((v) => ({ ...v, foto_zoom }))}
              />
              <FrameControl
                label="Mover na horizontal"
                value={draft.foto_x}
                min={-100}
                max={100}
                step={1}
                onChange={(foto_x) =>
                  setDraft((v) => ({ ...v, foto_x, foto_zoom: Math.max(v.foto_zoom, 1.2) }))
                }
              />
              <FrameControl
                label="Mover na vertical"
                value={draft.foto_y}
                min={-100}
                max={100}
                step={1}
                onChange={(foto_y) =>
                  setDraft((v) => ({ ...v, foto_y, foto_zoom: Math.max(v.foto_zoom, 1.2) }))
                }
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAdjustingId(null)}>
                Cancelar
              </Button>
              <Button
                variant="outline"
                onClick={() => setDraft({ foto_x: 0, foto_y: 0, foto_zoom: 1 })}
              >
                Restaurar
              </Button>
              <Button onClick={() => void saveFrame()}>Salvar enquadramento</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

function FrameControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Label>{label}</Label>
        <span className="font-mono text-xs text-muted-foreground">
          {label === "Zoom" ? `${value.toFixed(2)}×` : Math.round(value)}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([next]) => onChange(next)}
      />
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Plane; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/60 p-2.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <strong className="mt-1 block font-mono">{value}</strong>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
