import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Plus, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type CreateOption = { value: string; label?: string; hint?: string; cor?: string };

type Props = {
  value: string;
  options: CreateOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Permite criar nova opção digitando (padrão: não). */
  allowCreate?: boolean;
  onSelect: (value: string) => void;
  onCreate?: (label: string) => void | Promise<void>;
};

/**
 * Dropdown pesquisável com criação de nova opção.
 * Usado em campos de lista administrável (categorias, níveis operacionais).
 */
export function ComboCreate({
  value,
  options,
  placeholder = "Selecionar",
  className,
  disabled,
  allowCreate,
  onSelect,
  onCreate,
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return options;
    return options.filter((o) =>
      `${o.value} ${o.label ?? ""} ${o.hint ?? ""}`.toLowerCase().includes(term),
    );
  }, [options, q]);

  const exact = options.some(
    (o) => (o.label ?? o.value).trim().toLowerCase() === q.trim().toLowerCase(),
  );
  const selected = options.find((o) => o.value === value);

  return (
    <div ref={box} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected ? (selected.label ?? selected.value) : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-56 rounded-md border border-border bg-popover p-1 shadow-panel">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pesquisar…"
            className="mb-1 h-8 w-full rounded-sm border border-input bg-background px-2 text-sm outline-none focus:border-aviation"
          />
          <ul className="max-h-56 overflow-y-auto">
            {filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(o.value);
                    setOpen(false);
                    setQ("");
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  {o.cor ? (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: o.cor }}
                    />
                  ) : null}
                  <span className="truncate">{o.label ?? o.value}</span>
                  {o.value === value && <Check className="ml-auto h-3.5 w-3.5 text-aviation" />}
                </button>
              </li>
            ))}
            {!filtered.length && !allowCreate && (
              <li className="px-2 py-2 text-xs text-muted-foreground">Nenhuma opção.</li>
            )}
          </ul>
          {allowCreate && q.trim() && !exact && (
            <button
              type="button"
              onClick={async () => {
                await onCreate?.(q.trim());
                setOpen(false);
                setQ("");
              }}
              className="mt-1 flex w-full items-center gap-2 rounded bg-muted px-2 py-1.5 text-left text-sm font-semibold hover:bg-muted/70"
            >
              <Plus className="h-3.5 w-3.5" />
              Criar “{q.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}
