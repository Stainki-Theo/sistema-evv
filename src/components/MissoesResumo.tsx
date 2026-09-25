import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { ResumoCategoria } from "@/lib/categorias";

type Props = {
  resumo: ResumoCategoria[];
  /** Rótulo curto exibido quando não há missões. */
  empty?: string;
  className?: string;
};

/**
 * Resumo compacto de missões por categoria global, com expansão opcional
 * para ver as missões reais que compõem cada categoria.
 * Usado no Panorama, Histórico, Quadro e Resumo pós-operação.
 */
export function MissoesResumo({ resumo, empty = "Sem missões lançadas.", className }: Props) {
  const [open, setOpen] = useState<string[]>([]);
  if (!resumo.length) return <p className="text-xs text-muted-foreground">{empty}</p>;

  const toggle = (key: string) =>
    setOpen((o) => (o.includes(key) ? o.filter((k) => k !== key) : [...o, key]));

  return (
    <ul className={className ?? "space-y-1"}>
      {resumo.map((c) => {
        const aberto = open.includes(c.key);
        return (
          <li key={c.key} className="rounded border border-border/60">
            <button
              type="button"
              onClick={() => toggle(c.key)}
              aria-expanded={aberto}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-muted/60"
            >
              <ChevronRight
                className={`h-3 w-3 shrink-0 transition ${aberto ? "rotate-90" : ""}`}
              />
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: c.cor }} />
              <span className="truncate font-semibold uppercase tracking-wider">{c.key}</span>
              <span className="ml-auto shrink-0 font-mono text-muted-foreground">
                {c.total} {c.total === 1 ? "missão" : "missões"}
              </span>
            </button>
            {aberto && (
              <ul className="border-t border-border/60 px-3 py-1.5">
                {c.missoes.map((m) => (
                  <li
                    key={m.missao}
                    className="flex items-baseline justify-between gap-2 py-0.5 text-[11px] text-muted-foreground"
                  >
                    <span className="truncate font-mono">{m.missao}</span>
                    {m.total > 1 && <span className="shrink-0 font-mono">×{m.total}</span>}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
