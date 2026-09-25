import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type PersonOption = {
  id: string;
  war_name: string;
  full_name: string;
};

type Props = {
  people: PersonOption[];
  value: string;
  profileId?: string | null;
  placeholder?: string;
  onChange: (next: { responsavel: string; profile_id: string | null }) => void;
};

/**
 * Dropdown pesquisável de pessoas (nome de guerra ou nome completo),
 * com opção de digitar manualmente quem ainda não tem cadastro.
 */
export function PersonSelect({ people, value, profileId, placeholder, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter(
      (p) =>
        p.war_name.toLowerCase().includes(q) ||
        p.full_name.toLowerCase().includes(q),
    );
  }, [people, query]);

  const selected = people.find((p) => p.id === profileId);
  const label = selected ? selected.war_name || selected.full_name : value;

  function pick(p: PersonOption) {
    onChange({ responsavel: p.war_name || p.full_name, profile_id: p.id });
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "min-w-0 flex-1 justify-between font-normal",
              !label && "text-muted-foreground",
            )}
          >
            <span className="truncate">{label || (placeholder ?? "Selecionar…")}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-2">
          <Input
            autoFocus
            placeholder="Pesquisar nome ou nome de guerra"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="mt-2 max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">
                Ninguém encontrado no cadastro.
              </p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pick(p)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      p.id === profileId ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {p.war_name || p.full_name || "—"}
                    </span>
                    {p.full_name && p.war_name ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {p.full_name}
                      </span>
                    ) : null}
                  </span>
                </button>
              ))
            )}
          </div>
          <div className="mt-2 border-t border-border pt-2">
            <p className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
              Ou digitar manualmente
            </p>
            <div className="flex gap-1">
              <Input
                placeholder="Nome livre"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && query.trim()) {
                    onChange({ responsavel: query.trim(), profile_id: null });
                    setOpen(false);
                    setQuery("");
                  }
                }}
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  if (!query.trim()) return;
                  onChange({ responsavel: query.trim(), profile_id: null });
                  setOpen(false);
                  setQuery("");
                }}
              >
                Usar
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {label ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Remover seleção"
          onClick={() => onChange({ responsavel: "", profile_id: null })}
        >
          <X className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}
