import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type ComboOption = { value: string; label?: string; hint?: string };

type Props = {
  value: string;
  options: ComboOption[];
  placeholder?: string;
  className?: string;
  /** Texto livre permitido (padrão: sim) — a planilha aceita exceções operacionais. */
  onCommit: (value: string, option?: ComboOption) => void;
};

/**
 * Dropdown pesquisável com autocomplete, próprio para uso em planilha:
 * clique mostra as opções, digitação filtra, ↑/↓ navegam e ENTER seleciona.
 */
export function SearchCombo({ value, options, placeholder, className, onCommit }: Props) {
  const [text, setText] = useState(value ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => setText(value ?? ""), [value]);

  const filtered = useMemo(() => {
    const q = text.trim().toLowerCase().replace(/\s+/g, " ");
    if (!q) return options;
    const parts = q.split(" ");
    return options.filter((o) => {
      const hay = `${o.value} ${o.label ?? ""} ${o.hint ?? ""}`.toLowerCase();
      return parts.every((p) => hay.includes(p));
    });
  }, [options, text]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function choose(option: ComboOption) {
    setText(option.value);
    setOpen(false);
    onCommit(option.value, option);
  }

  return (
    <div ref={box} className="relative">
      <input
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          if (text !== value) onCommit(text);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, filtered.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            const option = open ? filtered[active] : undefined;
            if (option) choose(option);
            else {
              setOpen(false);
              onCommit(text);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className={cn(
          "h-8 w-full min-w-0 rounded-sm border border-input bg-background px-2 text-sm outline-none focus:border-aviation focus:ring-1 focus:ring-aviation",
          className,
        )}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute left-0 top-full z-50 mt-0.5 max-h-56 w-56 overflow-y-auto rounded border border-border bg-popover p-1 shadow-panel">
          {filtered.slice(0, 60).map((o, i) => (
            <li key={`${o.value}-${i}`}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(o)}
                className={cn(
                  "flex w-full items-baseline justify-between gap-2 rounded px-2 py-1 text-left text-sm",
                  i === active ? "bg-aviation text-navy-foreground" : "hover:bg-muted",
                )}
              >
                <span className="truncate font-medium">{o.label ?? o.value}</span>
                {o.hint ? <span className="shrink-0 text-xs opacity-70">{o.hint}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
