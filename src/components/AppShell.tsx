import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  Building2,
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  CloudSun,
  Eye,
  FolderOpen,
  History,
  Home,
  IdCard,
  LayoutList,
  ListOrdered,
  LogOut,
  Megaphone,
  Menu,
  MonitorPlay,
  ScrollText,
  Shield,
  ShieldAlert,
  Store,
  Table,
  UserCog,
  Users,
  X,
  PlaneTakeoff,
  Sparkles,
  Boxes,
  GalleryVerticalEnd,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, displayName } from "@/lib/auth";
import { usePermissoes } from "@/lib/permissoes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { operationalLevelLabel } from "@/lib/categorias";
import { PhotoAvatar } from "@/components/PhotoAvatar";
import { acknowledgeFlightCreditNotice, useFlightCreditNotice } from "@/lib/data";
import { formatDatePtBr, minutesToClock } from "@/lib/evv";
import { PwaInstall } from "@/components/PwaInstall";
import { NotificationCenter } from "@/components/NotificationCenter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const OPERATION_NAV = [
  { to: "/home", label: "Visão geral", icon: Home },
  { to: "/escala", label: "Escala do dia", icon: ListOrdered },
  { to: "/anotador", label: "Anotador", icon: Table },
  { to: "/funcoes", label: "Funções", icon: Users },
  { to: "/meteorologia", label: "Meteorologia", icon: CloudSun },
  { to: "/panorama", label: "Panorama", icon: LayoutList },
  { to: "/quadro", label: "Quadro operacional", icon: MonitorPlay },
] as const;

const MANAGEMENT_NAV = [
  { to: "/disponibilidade", label: "Disponibilidade", icon: CalendarCheck },
  { to: "/calendario", label: "Calendário", icon: CalendarDays },
  { to: "/pitocador", label: "Pitocador", icon: ClipboardList },
  { to: "/comercial", label: "Comercial", icon: Store },
  { to: "/estrelarios", label: "Estrelários", icon: Sparkles },
  { to: "/gaivotometro", label: "Gaivotômetro", icon: GalleryVerticalEnd },
  { to: "/seguranca", label: "Segurança de voo", icon: ShieldAlert },
  { to: "/documentos", label: "Documentos", icon: FolderOpen },
  { to: "/avisos", label: "Avisos", icon: Megaphone },
  { to: "/diretorias", label: "Diretorias", icon: Building2 },
  { to: "/efetivo", label: "Efetivo", icon: IdCard },
] as const;

const SYSTEM_NAV = [
  { to: "/historico", label: "Histórico", icon: History },
  { to: "/logs", label: "Alterações", icon: ScrollText },
  { to: "/conta", label: "Minha conta", icon: UserCog },
] as const;

type NavItem = { readonly to: string; readonly label: string; readonly icon: typeof Home };

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, signOut, isAdmin } = useAuth();
  const { canManageOps, canSupervisaoGroup } = usePermissoes();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="evv-app-shell">
      <aside className={cn("evv-sidebar", open && "is-open")}>
        <div className="evv-sidebar-brand">
          <Link to="/home" onClick={() => setOpen(false)}>
            <img src="/favicon.png" alt="Esquadrão de Voo a Vela" />
            <span>
              <strong>EVV</strong>
              <small>Sistema de Operações</small>
            </span>
          </Link>
          <button
            className="evv-close-menu"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
          >
            <X size={19} />
          </button>
        </div>

        <nav className="evv-sidebar-nav" aria-label="Navegação principal">
          <NavGroup title="Operação" items={OPERATION_NAV} close={() => setOpen(false)} />
          <NavGroup
            title="Gestão"
            items={[
              ...MANAGEMENT_NAV,
              ...(canManageOps
                ? [{ to: "/material-carga", label: "Material Carga", icon: Boxes } as const]
                : []),
            ]}
            close={() => setOpen(false)}
          />
          <NavGroup
            title="Sistema"
            items={[
              ...SYSTEM_NAV,
              ...(canSupervisaoGroup
                ? [{ to: "/supervisao", label: "Supervisão", icon: Eye } as const]
                : []),
              ...(isAdmin
                ? [{ to: "/administracao", label: "Administração", icon: Shield } as const]
                : []),
            ]}
            close={() => setOpen(false)}
          />
        </nav>

        <div className="evv-sidebar-footer">
          <PwaInstall />
          <div className="evv-system-status">
            <i />
            <span>
              <strong>Sistema conectado</strong>
              <small>Dados sincronizados</small>
            </span>
          </div>
          <div className="evv-sidebar-user">
            <PhotoAvatar
              path={profile?.avatar_path ?? null}
              alt={displayName(profile)}
              fallback={displayName(profile)}
              className="h-9 w-9 border-white/10 bg-white/10 text-white"
            />
            <span className="evv-sidebar-user-copy">
              <strong>{displayName(profile)}</strong>
              <small>{operationalLevelLabel(profile?.nivel_operacional) || "Efetivo"}</small>
            </span>
            <button onClick={handleSignOut} aria-label="Sair">
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      {open && (
        <button
          className="evv-menu-overlay"
          onClick={() => setOpen(false)}
          aria-label="Fechar menu"
        />
      )}

      <div className="evv-app-main">
        <header className="evv-topbar">
          <button
            className="evv-menu-trigger"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu size={21} />
          </button>
          <div>
            <span>EVV</span>
            <strong>Operações de Voo a Vela</strong>
          </div>
          <div className="evv-topbar-user">
            <span>
              <strong>{displayName(profile)}</strong>
              <small>{operationalLevelLabel(profile?.nivel_operacional) || "Efetivo"}</small>
            </span>
            <div className="evv-profile-notification-wrap">
              <NotificationCenter profileId={profile?.id} />
            </div>
            <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sair">
              <LogOut />
            </Button>
          </div>
        </header>
        <main className="evv-content">{children}</main>
      </div>
      <FlightCreditNotification profileId={profile?.id} />
    </div>
  );
}

function FlightCreditNotification({ profileId }: { profileId?: string }) {
  const qc = useQueryClient();
  const { data: notice } = useFlightCreditNotice(profileId);
  const [saving, setSaving] = useState(false);

  async function acknowledge() {
    if (!notice) return;
    setSaving(true);
    try {
      await acknowledgeFlightCreditNotice(notice);
      await qc.invalidateQueries({ queryKey: ["flight_credit_notice", profileId] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AlertDialog open={!!notice}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-aviation/10 text-aviation">
            <PlaneTakeoff className="h-6 w-6" />
          </div>
          <AlertDialogTitle className="text-center">Horas de voo atualizadas</AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Operação de {notice ? formatDatePtBr(notice.date) : "—"}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {notice && (
          <div className="rounded-xl border border-border bg-muted/40 p-4 text-center">
            <p className="text-sm text-muted-foreground">Tempo voado nesta operação</p>
            <p className="my-1 font-mono text-3xl font-bold text-aviation">
              +{minutesToClock(notice.minutes)}
            </p>
            <p className="text-sm">
              Total atualizado de <strong>{minutesToClock(notice.before)}</strong> para{" "}
              <strong>{minutesToClock(notice.after)}</strong>.
            </p>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogAction className="w-full" disabled={saving} onClick={acknowledge}>
            {saving ? "Confirmando…" : "Entendido"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function NavGroup({
  title,
  items,
  close,
}: {
  title: string;
  items: readonly NavItem[];
  close: () => void;
}) {
  return (
    <section>
      <h2>{title}</h2>
      <ul>
        {items.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              onClick={close}
              className="evv-nav-link"
              activeProps={{ className: "evv-nav-link is-active" }}
            >
              <item.icon />
              <span>{item.label}</span>
              <ChevronRight className="evv-nav-chevron" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="evv-page-header">
      <div>
        <p>PAINEL OPERACIONAL</p>
        <h1>{title}</h1>
        {description && <span>{description}</span>}
      </div>
      {actions && <div className="evv-page-actions">{actions}</div>}
    </header>
  );
}
