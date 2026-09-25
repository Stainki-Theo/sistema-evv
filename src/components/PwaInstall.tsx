import { useEffect, useState } from "react";
import { Download, Share2, Smartphone, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function PwaInstall() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [iosHelp, setIosHelp] = useState(false);
  const [installed, setInstalled] = useState(() =>
    typeof window !== "undefined" && (isStandalone() || localStorage.getItem("evv-pwa-installed") === "1"),
  );
  const [suggest, setSuggest] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      localStorage.setItem("evv-pwa-installed", "1");
      setInstalled(true);
    }
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
      const dismissedAt = Number(localStorage.getItem("evv-install-dismissed") || 0);
      if (Date.now() - dismissedAt > 7 * 24 * 60 * 60 * 1000) setSuggest(true);
    };
    const onInstalled = () => {
      localStorage.setItem("evv-pwa-installed", "1");
      setInstalled(true);
      setSuggest(false);
      toast.success("Sistema EVV instalado.");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (isIos() && !isStandalone()) {
      const dismissedAt = Number(localStorage.getItem("evv-install-dismissed") || 0);
      if (Date.now() - dismissedAt > 7 * 24 * 60 * 60 * 1000) setTimeout(() => setSuggest(true), 2500);
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (isIos()) {
      setIosHelp(true);
      setSuggest(false);
      return;
    }
    if (!prompt) {
      toast.info("Abra o menu do navegador e escolha ‘Instalar aplicativo’ ou ‘Adicionar à tela inicial’. ");
      return;
    }
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") setSuggest(false);
    setPrompt(null);
  }

  function dismiss() {
    localStorage.setItem("evv-install-dismissed", String(Date.now()));
    setSuggest(false);
  }

  if (installed) return null;

  return (
    <>
      <button className="evv-install-sidebar" onClick={install}>
        <Download size={16} />
        <span><strong>Instalar Sistema EVV</strong><small>Adicionar à tela inicial</small></span>
      </button>

      {suggest && (
        <div className="evv-install-suggestion" role="status">
          <button className="evv-install-close" onClick={dismiss} aria-label="Fechar sugestão"><X size={16} /></button>
          <span className="evv-install-icon"><Smartphone size={22} /></span>
          <div><strong>Instale o Sistema EVV</strong><p>Acesse em tela cheia diretamente pela tela inicial.</p></div>
          <Button size="sm" onClick={install}><Download className="mr-1.5 h-4 w-4" /> Instalar</Button>
        </div>
      )}

      <Dialog open={iosHelp} onOpenChange={setIosHelp}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Instalar no iPhone ou iPad</DialogTitle>
            <DialogDescription>Faça isso pelo Safari:</DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3"><Share2 className="h-5 w-5 shrink-0 text-primary" /><span>Toque no botão <strong>Compartilhar</strong>.</span></li>
            <li className="flex gap-3"><Smartphone className="h-5 w-5 shrink-0 text-primary" /><span>Escolha <strong>Adicionar à Tela de Início</strong>.</span></li>
            <li className="flex gap-3"><Download className="h-5 w-5 shrink-0 text-primary" /><span>Confirme em <strong>Adicionar</strong>.</span></li>
          </ol>
          <DialogFooter><Button onClick={() => setIosHelp(false)}>Entendi</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PwaServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").then((registration) => {
      const offerUpdate = (worker: ServiceWorker | null) => {
        if (!worker || !navigator.serviceWorker.controller) return;
        toast("Nova versão disponível", {
          description: "Atualize para usar a versão mais recente do Sistema EVV.",
          action: { label: "Atualizar", onClick: () => worker.postMessage({ type: "SKIP_WAITING" }) },
          duration: Infinity,
        });
      };
      offerUpdate(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => worker.state === "installed" && offerUpdate(worker));
      });
    }).catch(() => undefined);
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }, []);
  return null;
}
