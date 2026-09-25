import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/evv";

const toneClass: Record<Tone, string> = {
  neutral: "bg-secondary text-secondary-foreground border-border",
  info: "bg-info/12 text-info border-info/30",
  success: "bg-success/12 text-success border-success/30",
  warning: "bg-warning/20 text-warning-foreground border-warning/40",
  danger: "bg-danger/12 text-danger border-danger/30",
};

export function StatusBadge({
  tone = "neutral",
  children,
  className,
  size = "sm",
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "lg";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border font-semibold uppercase tracking-wide",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-base",
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
