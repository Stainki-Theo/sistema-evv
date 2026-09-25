import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Redefinir senha — EVV Voo a Vela" },
      { name: "description", content: "Defina uma nova senha de acesso ao EVV." },
      { property: "og:title", content: "Redefinir senha — EVV Voo a Vela" },
      { property: "og:description", content: "Defina uma nova senha de acesso ao EVV." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("A senha precisa ter no mínimo 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível redefinir: " + error.message);
      return;
    }
    toast.success("Senha atualizada.");
    navigate({ to: "/home", replace: true });
  }

  return (
    <div className="grid min-h-screen place-items-center bg-navy px-4">
      <div className="w-full max-w-md rounded-xl border border-white/15 bg-navy/70 p-7 text-navy-foreground shadow-panel">
        <div className="flex items-center gap-3">
          <img src="/favicon.png" alt="Logo do EVV" className="h-12 w-12 object-contain" />
          <div>
            <div className="text-lg font-bold tracking-[0.2em]">EVV</div>
            <div className="text-[11px] uppercase tracking-[0.18em] opacity-75">
              Redefinir senha
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <div>
            <Label htmlFor="np" className="text-navy-foreground">
              Nova senha
            </Label>
            <Input
              id="np"
              type="password"
              required
              className="mt-1 border-white/20 bg-white/10 text-navy-foreground"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="np2" className="text-navy-foreground">
              Confirmar nova senha
            </Label>
            <Input
              id="np2"
              type="password"
              required
              className="mt-1 border-white/20 bg-white/10 text-navy-foreground"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            Salvar nova senha
          </Button>
        </form>
      </div>
    </div>
  );
}
