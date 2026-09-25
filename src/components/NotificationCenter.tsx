import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Award, CalendarClock, CheckCheck, Plane, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type PersonalNotification = {
  id: string;
  type: "ESTRELARIO" | "FUNCAO" | "PROGRESSAO";
  title: string;
  description: string;
  actor: string;
  happenedAt: string;
  opDate?: string | null;
};

function dateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function opDate(value?: string | null) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function icon(type: PersonalNotification["type"]) {
  if (type === "ESTRELARIO") return <Sparkles className="h-4 w-4" />;
  if (type === "PROGRESSAO") return <Award className="h-4 w-4" />;
  return <CalendarClock className="h-4 w-4" />;
}

export function NotificationCenter({ profileId }: { profileId?: string }) {
  const [open, setOpen] = useState(false);
  const seenKey = `evv-notifications-seen:${profileId ?? "none"}`;
  const [lastSeen, setLastSeen] = useState(0);

  useEffect(() => setLastSeen(Number(localStorage.getItem(seenKey) || 0)), [seenKey]);

  const notifications = useQuery({
    queryKey: ["personal-notifications", profileId ?? "none"],
    enabled: !!profileId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const [stars, duties, progression, dutyAudit] = await Promise.all([
        supabase
          .from("estrelarios")
          .select("id, amount, reason, op_date, issued_by_name, created_at")
          .eq("recipient_id", profileId!)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("duty_roster")
          .select("id, funcao, op_date, updated_at")
          .eq("profile_id", profileId!)
          .order("updated_at", { ascending: false })
          .limit(50),
        supabase
          .from("progression_log")
          .select("id, missao, resultado, proxima_missao, op_date, registrado_por, created_at")
          .eq("profile_id", profileId!)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("change_log")
          .select("entity_id, user_tag, created_at")
          .eq("entity", "duty_roster")
          .eq("field", "profile_id")
          .eq("new_value", profileId!)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      if (stars.error) throw stars.error;
      if (duties.error) throw duties.error;
      if (progression.error) throw progression.error;
      if (dutyAudit.error) throw dutyAudit.error;

      const dutyActor = new Map<string, { actor: string; at: string }>();
      for (const row of dutyAudit.data ?? []) {
        if (!dutyActor.has(row.entity_id)) dutyActor.set(row.entity_id, { actor: row.user_tag, at: row.created_at });
      }

      const rows: PersonalNotification[] = [
        ...(stars.data ?? []).map((row) => ({
          id: `estrelario:${row.id}`,
          type: "ESTRELARIO" as const,
          title: `Você recebeu ${Number(row.amount).toLocaleString("pt-BR")} estrelários`,
          description: row.reason,
          actor: row.issued_by_name || "Responsável não identificado",
          happenedAt: row.created_at,
          opDate: row.op_date,
        })),
        ...(duties.data ?? []).map((row) => ({
          id: `funcao:${row.id}:${dutyActor.get(row.id)?.at ?? row.updated_at}`,
          type: "FUNCAO" as const,
          title: `Você foi inserido na função ${row.funcao}`,
          description: `Escala da operação de ${opDate(row.op_date)}.`,
          actor: dutyActor.get(row.id)?.actor || "Escala de serviço",
          happenedAt: dutyActor.get(row.id)?.at ?? row.updated_at,
          opDate: row.op_date,
        })),
        ...(progression.data ?? []).map((row) => ({
          id: `progressao:${row.id}`,
          type: "PROGRESSAO" as const,
          title: `Resultado registrado em ${row.missao}`,
          description: `${row.resultado}${row.proxima_missao ? ` · Próxima missão: ${row.proxima_missao}` : ""}`,
          actor: row.registrado_por || "Planilha do Anotador",
          happenedAt: row.created_at,
          opDate: row.op_date,
        })),
      ];
      return rows.sort((a, b) => +new Date(b.happenedAt) - +new Date(a.happenedAt)).slice(0, 100);
    },
  });

  const rows = notifications.data ?? [];
  const unread = useMemo(
    () => rows.filter((row) => +new Date(row.happenedAt) > lastSeen).length,
    [rows, lastSeen],
  );

  function show() {
    setOpen(true);
    const now = Date.now();
    localStorage.setItem(seenKey, String(now));
    setLastSeen(now);
  }

  return (
    <>
      <button className="evv-notification-glider" onClick={show} aria-label={`${unread} notificações não lidas`} title="Notificações pessoais">
        <Plane className="h-4 w-4" />
        {unread > 0 && <span>{unread > 99 ? "99+" : unread}</span>}
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2"><Plane className="h-5 w-5 text-primary" /> Notificações</SheetTitle>
            <SheetDescription>Acontecimentos vinculados diretamente ao seu perfil.</SheetDescription>
          </SheetHeader>
          <div className="mt-5 flex items-center justify-between">
            <span className="text-sm font-medium">Histórico pessoal</span>
            <Button variant="ghost" size="sm" onClick={show}><CheckCheck className="mr-1.5 h-4 w-4" /> Marcar como lidas</Button>
          </div>
          <div className="mt-3 space-y-2">
            {notifications.isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Carregando notificações…</p>}
            {!notifications.isLoading && rows.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma notificação pessoal até agora.</p>}
            {rows.map((row) => {
              const isUnread = +new Date(row.happenedAt) > lastSeen;
              return (
                <article key={row.id} className={cn("rounded-xl border p-3.5", isUnread && "border-primary/40 bg-primary/5")}>
                  <div className="flex items-start gap-3">
                    <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg", row.type === "ESTRELARIO" ? "bg-amber-100 text-amber-700" : row.type === "PROGRESSAO" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700")}>{icon(row.type)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <strong className="text-sm leading-snug">{row.title}</strong>
                        {isUnread && <Badge className="shrink-0">Nova</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{row.description}</p>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>Por: {row.actor}</span><span>{dateTime(row.happenedAt)}</span>{row.opDate && <span>Operação: {opDate(row.opDate)}</span>}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
