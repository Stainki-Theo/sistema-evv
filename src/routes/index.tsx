import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "EVV — Sistema de Operações do Voo a Vela" },
      {
        name: "description",
        content:
          "Painel único para a operação diária de Voo a Vela: escala, meteorologia, briefing, aeronaves e sequência de voos.",
      },
      { property: "og:title", content: "EVV — Sistema de Operações do Voo a Vela" },
      {
        property: "og:description",
        content:
          "Centralize escala, meteorologia, briefing, aeronaves e sequência de voos em um único painel operacional.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    throw redirect({ to: data.user ? "/home" : "/auth" });
  },
  component: () => null,
});
