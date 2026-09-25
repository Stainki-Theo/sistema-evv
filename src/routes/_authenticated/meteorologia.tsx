import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sunrise, Sunset, PlaneLanding } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth, displayName } from "@/lib/auth";
import { useWeather } from "@/lib/data";
import { FOG_MODES, WX_CLASS_OPTIONS, fogLongLabel, todayISO, formatDatePtBr, formatDateTime, wxClass } from "@/lib/evv";

export const Route = createFileRoute("/_authenticated/meteorologia")({
  head: () => ({
    meta: [
      { title: "Meteorologia — EVV" },
      {
        name: "description",
        content:
          "Briefing meteorológico do voo a vela: TIC, térmicas, incidência solar, chuva, neblina, vento e último planador no solo.",
      },
      { property: "og:title", content: "Meteorologia — EVV" },
      {
        property: "og:description",
        content: "Briefing meteorológico manual do voo a vela, preenchido a partir do Meteoblue.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MeteorologiaPage,
});

const EMPTY = {
  classification: "BOA",
  sunrise: "",
  temp_max: "",
  tic_temp: "",
  tic_time: "",
  thermals_top: "",
  solar_hours: "",
  rain_chance: "",
  rain_confidence: "",
  fog: FOG_MODES.NONE as string,
  fog_chance: "",
  fog_obs: "",
  wind_dir: "",
  wind_speed: "",
  wind_gust: "",
  wind_period_start: "",
  wind_period_end: "",
  wind_obs: "",
  sunset: "",
  last_glider_ground: "",
  analysis: "",
  source: "Meteoblue",
};

type Form = typeof EMPTY;

function MeteorologiaPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [date, setDate] = useState(todayISO());
  const { data: list, isLoading } = useWeather(date);
  const [form, setForm] = useState<Form>({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const current = list?.[0];

  useEffect(() => {
    if (!current) {
      setForm({ ...EMPTY });
      return;
    }
    const next = { ...EMPTY };
    for (const key of Object.keys(EMPTY) as (keyof Form)[]) {
      const value = (current as Record<string, unknown>)[key];
      if (typeof value === "string" && value) next[key] = value;
    }
    if (next.fog !== FOG_MODES.CHANCE) next.fog = FOG_MODES.NONE;
    setForm(next);
  }, [current?.id, date]);

  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setSaving(true);
    const payload = {
      ...form,
      fog_chance: form.fog === FOG_MODES.CHANCE ? form.fog_chance : "",
      fog_obs: form.fog === FOG_MODES.CHANCE ? form.fog_obs : "",
      op_date: date,
      updated_by_name: displayName(profile),
    };
    const { error } = current
      ? await supabase
          .from("weather_observations")
          .update(payload as never)
          .eq("id", current.id)
      : await supabase.from("weather_observations").insert({
          ...payload,
          created_by: profile?.id ?? null,
          created_by_name: displayName(profile),
        } as never);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["weather", date] });
    toast.success(current ? "Briefing atualizado." : "Briefing registrado.");
  }

  return (
    <>
      <PageHeader
        title="Meteorologia"
        description={`Briefing meteorológico — ${formatDatePtBr(date)}`}
        actions={
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-40"
            aria-label="Data do briefing"
          />
        }
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
                {current ? "Editar briefing" : "Novo briefing"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <fieldset>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Condição geral para o voo a vela
                </legend>
                <div className="evv-wx-options">
                  {WX_CLASS_OPTIONS.map((option) => {
                    const item = wxClass(option);
                    return (
                      <button
                        key={option}
                        type="button"
                        className={`evv-wx-option tone-${item.tone}${form.classification === option ? " is-selected" : ""}`}
                        onClick={() => set("classification", option)}
                        aria-pressed={form.classification === option}
                      >
                        <i />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Esta seleção alimenta automaticamente a Condição WX da tela inicial.
                </p>
              </fieldset>

              <Group title="Sol e temperatura">
                <FieldInput
                  label="Nascer do sol"
                  type="time"
                  value={form.sunrise}
                  onChange={(v) => set("sunrise", v)}
                />
                <FieldInput
                  label="Temperatura máxima (°C)"
                  placeholder="ex.: 25"
                  value={form.temp_max}
                  onChange={(v) => set("temp_max", v)}
                />
                <FieldInput
                  label="Incidência solar (horas)"
                  placeholder="ex.: 3"
                  value={form.solar_hours}
                  onChange={(v) => set("solar_hours", v)}
                />
              </Group>

              <Group title="TIC e térmicas">
                <FieldInput
                  label="TIC — temperatura (°C)"
                  placeholder="ex.: 25"
                  value={form.tic_temp}
                  onChange={(v) => set("tic_temp", v)}
                />
                <FieldInput
                  label="TIC — horário previsto"
                  type="time"
                  value={form.tic_time}
                  onChange={(v) => set("tic_time", v)}
                />
                <FieldInput
                  label="Topo das térmicas (m)"
                  placeholder="ex.: 1300"
                  value={form.thermals_top}
                  onChange={(v) => set("thermals_top", v)}
                />
              </Group>

              <Group title="Chuva e neblina">
                <FieldInput
                  label="Chance de chuva (%)"
                  placeholder="0 a 100"
                  value={form.rain_chance}
                  onChange={(v) => set("rain_chance", v)}
                />
                <FieldInput
                  label="Previsibilidade (%)"
                  placeholder="0 a 100"
                  value={form.rain_confidence}
                  onChange={(v) => set("rain_confidence", v)}
                />
                <div>
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Neblina
                  </Label>
                  <Select value={form.fog} onValueChange={(v) => set("fog", v)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={FOG_MODES.NONE}>Não há</SelectItem>
                      <SelectItem value={FOG_MODES.CHANCE}>Chance de ocorrência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.fog === FOG_MODES.CHANCE && (
                  <>
                    <FieldInput
                      label="Chance de neblina (%)"
                      placeholder="0 a 100"
                      value={form.fog_chance}
                      onChange={(v) => set("fog_chance", v)}
                    />
                    <FieldInput
                      label="Horário previsto da neblina"
                      placeholder="ex.: 06–09h"
                      value={form.fog_obs}
                      onChange={(v) => set("fog_obs", v)}
                    />
                  </>
                )}
              </Group>

              <Group title="Vento">
                <FieldInput
                  label="Direção predominante"
                  placeholder="ex.: SUL"
                  value={form.wind_dir}
                  onChange={(v) => set("wind_dir", v)}
                />
                <FieldInput
                  label="Vento médio (kt)"
                  placeholder="ex.: 13"
                  value={form.wind_speed}
                  onChange={(v) => set("wind_speed", v)}
                />
                <FieldInput
                  label="Rajada (kt)"
                  placeholder="ex.: 18"
                  value={form.wind_gust}
                  onChange={(v) => set("wind_gust", v)}
                />
                <FieldInput
                  label="Início do período significativo"
                  type="time"
                  value={form.wind_period_start}
                  onChange={(v) => set("wind_period_start", v)}
                />
                <FieldInput
                  label="Fim do período significativo"
                  type="time"
                  value={form.wind_period_end}
                  onChange={(v) => set("wind_period_end", v)}
                />
                <div className="sm:col-span-2 lg:col-span-3">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Observação sobre o vento
                  </Label>
                  <Textarea
                    className="mt-1"
                    rows={2}
                    placeholder="ex.: Vento, no geral, vindo de SUL com média de 13 kt e rajadas de cerca de 18 kt entre 15:00 e 18:00."
                    value={form.wind_obs}
                    onChange={(e) => set("wind_obs", e.target.value)}
                  />
                </div>
              </Group>

              <Group title="Limites operacionais">
                <FieldInput
                  label="Pôr do sol"
                  type="time"
                  value={form.sunset}
                  onChange={(v) => set("sunset", v)}
                />
                <FieldInput
                  label="Último planador no solo"
                  type="time"
                  value={form.last_glider_ground}
                  onChange={(v) => set("last_glider_ground", v)}
                />
                <FieldInput
                  label="Fonte"
                  placeholder="Meteoblue"
                  value={form.source}
                  onChange={(v) => set("source", v)}
                />
              </Group>

              <div>
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Observações meteorológicas
                </Label>
                <Textarea
                  className="mt-1"
                  rows={3}
                  placeholder="Informação excepcional a acrescentar ao briefing."
                  value={form.analysis}
                  onChange={(e) => set("analysis", e.target.value)}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={save} disabled={saving}>
                  {current ? "Salvar alterações" : "Registrar briefing"}
                </Button>
                {current && (
                  <span className="text-xs text-muted-foreground">
                    Criado em {formatDateTime(current.created_at)} por{" "}
                    {current.created_by_name || "—"} · última edição{" "}
                    {formatDateTime(current.updated_at)}
                    {current.updated_by_name ? ` por ${current.updated_by_name}` : ""}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
                Briefing Meteorológico
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <div className={`evv-wx-preview tone-${wxClass(form.classification).tone}`}>
                <span>Condição WX</span>
                <strong>{wxClass(form.classification).label}</strong>
              </div>
              <Line icon={<Sunrise className="h-4 w-4" />} k="Nascer do sol" v={form.sunrise} />
              <Line k="Temperatura máxima" v={form.temp_max ? `${form.temp_max}°C` : ""} />
              <Line
                k="TIC"
                v={
                  form.tic_temp
                    ? `${form.tic_temp}°C${form.tic_time ? ` às ${form.tic_time}` : ""}`
                    : ""
                }
              />
              <Line
                k="Topo das térmicas"
                v={form.thermals_top ? `${form.thermals_top} m` : ""}
              />
              <Line
                k="Incidência solar"
                v={form.solar_hours ? `${form.solar_hours} horas` : ""}
              />
              <Line
                k="Chuva"
                v={
                  form.rain_chance
                    ? `${form.rain_chance}% com ${form.rain_confidence || "—"}% de previsibilidade`
                    : ""
                }
              />
              <Line k="Neblina" v={fogLongLabel(form.fog, form.fog_chance)} />
              <Line
                k="Vento"
                v={
                  form.wind_dir || form.wind_speed
                    ? `${form.wind_dir || "—"}, média ${form.wind_speed || "—"} kt${
                        form.wind_gust ? ` e rajadas de ${form.wind_gust} kt` : ""
                      }${
                        form.wind_period_start
                          ? ` entre ${form.wind_period_start} e ${form.wind_period_end || "—"}`
                          : ""
                      }`
                    : ""
                }
              />
              <Line icon={<Sunset className="h-4 w-4" />} k="Pôr do sol" v={form.sunset} />
              <div className="mt-2 rounded border-l-4 border-l-danger bg-muted/50 p-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <PlaneLanding className="h-4 w-4" /> Último planador no solo
                </div>
                <div className="font-mono text-2xl font-bold">
                  {form.last_glider_ground || "—"}
                </div>
              </div>
              <p className="pt-1 text-xs text-muted-foreground">Fonte: {form.source || "—"}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </legend>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </fieldset>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="min-w-0">
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input
        className="mt-1"
        type={type ?? "text"}
        placeholder={placeholder ?? ""}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Line({ k, v, icon }: { k: string; v?: string | null; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-0.5">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {k}
      </span>
      <span className="text-right font-medium">{v || "—"}</span>
    </div>
  );
}
