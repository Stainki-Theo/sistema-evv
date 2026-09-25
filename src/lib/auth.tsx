import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { canonicalEsquadrao } from "@/lib/evv";
import { NIVEIS } from "@/lib/evv";

export type Profile = {
  id: string;
  full_name: string;
  war_name: string;
  email: string;
  nivel_operacional: string;
  flight_minutes: number;
  observacao: string;
  gaivota: string;
  esquadrao: string;
  turma: string;
  cargo: string;
  diretoria: string;
  posto: string;
  tri: string;
  fase: string;
  missao: string;
  proxima_missao: string;
  ops: number;
  pso: number;
  opr_dg: string;
  opr_duo: string;
  opr_cs: string;
  status: string;
  avatar_path: string;
  in_pessoal_id: string | null;
  instrutor: boolean;
};

type AuthValue = {
  session: Session | null;
  profile: Profile | null;
  role: string | null;
  isAdmin: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(userId: string | undefined) {
    if (!userId) {
      setProfile(null);
      setRole(null);
      return;
    }
    const [{ data: prof }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    setProfile(prof ? ({ ...prof, esquadrao: canonicalEsquadrao(prof.esquadrao) } as Profile) : null);
    const list = (roles ?? []).map((r) => r.role as string);
    setRole(
      list.includes(NIVEIS.ADMIN)
        ? NIVEIS.ADMIN
        : list.includes(NIVEIS.SUPERVISOR)
          ? NIVEIS.SUPERVISOR
          : NIVEIS.MEMBRO,
    );
  }

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!active) return;
      setSession(s);
      void load(s?.user?.id);
    });
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await load(data.session?.user?.id);
      setLoading(false);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: AuthValue = {
    session,
    profile,
    role,
    isAdmin: role === NIVEIS.ADMIN,
    loading,
    refresh: () => load(session?.user?.id),
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}

export function displayName(profile: Profile | null) {
  return profile?.war_name || profile?.full_name || profile?.email || "—";
}
