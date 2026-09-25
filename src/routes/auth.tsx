import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
    { title: "Acesso — EVV Operações" },
    { name: "description", content: "Acesso privado ao Sistema de Operações do Voo a Vela." },
  ] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [login, setLogin] = useState({ email: "", password: "" });

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home", replace: true });
    });
  }, [navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(login);
    setLoading(false);
    if (error) {
      toast.error("Não foi possível entrar. Confira seu e-mail e sua senha.");
      return;
    }
    navigate({ to: "/home", replace: true });
  }

  async function handleForgot() {
    if (!login.email) {
      toast.error("Informe seu e-mail para receber o link de redefinição.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(login.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error("Não foi possível enviar o link de redefinição.");
      return;
    }
    toast.success("Se o e-mail estiver cadastrado, o link foi enviado.");
  }

  return (
    <main className="evv-login">
      <div className="evv-login-backdrop" aria-hidden="true" />
      <header className="evv-login-brand">
        <img src="/favicon.png" alt="Símbolo do Esquadrão de Voo a Vela" />
        <span><strong>EVV</strong><small>Sistema de Operações</small></span>
      </header>

      <div className="evv-login-copy" aria-hidden="true">
        <p>ESQUADRÃO DE VOO A VELA</p>
        <h1>Voar antes.<br />Voar mais.<br />Voar melhor.<br />Voar seguro.</h1>
      </div>

      <section className="evv-login-panel" aria-label="Acesso ao sistema">
        <div className="evv-login-card">
          <div className="evv-secure"><i /><LockKeyhole size={13} /> AMBIENTE RESTRITO</div>
          <h2>Acesso operacional</h2>
          <p className="evv-login-intro">Entre com as credenciais fornecidas pela Administração do EVV.</p>
          <form onSubmit={handleLogin} className="evv-login-form">
            <label htmlFor="login-email">E-mail</label>
            <input id="login-email" type="email" required autoComplete="email" placeholder="nome@dominio.mil.br" value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} />
            <div className="evv-password-label">
              <label htmlFor="login-password">Senha</label>
              <button type="button" onClick={handleForgot}>Esqueci minha senha</button>
            </div>
            <div className="evv-password-field">
              <input id="login-password" type={showPassword ? "text" : "password"} required autoComplete="current-password" placeholder="Sua senha" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} />
              <button type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPassword((v) => !v)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
            <button className="evv-login-submit" type="submit" disabled={loading}>{loading ? "Autenticando…" : "Acessar plataforma"}<ArrowRight size={18} /></button>
          </form>
          <p className="evv-access-note">Acesso exclusivo a usuários autorizados. Todas as ações são registradas.</p>
          <footer>EVV · Operações de Voo a Vela</footer>
        </div>
      </section>
    </main>
  );
}
