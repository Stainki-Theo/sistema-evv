import type { CSSProperties } from "react";
import { usePhotoUrl } from "@/lib/data";
import { cn } from "@/lib/utils";

/**
 * Foto pessoal / de produto guardada no espaço privado de arquivos.
 * O endereço é assinado sob demanda — nada fica público.
 */
export function PhotoAvatar({
  path,
  alt,
  fallback,
  className,
  imageStyle,
}: {
  path?: string | null;
  alt: string;
  fallback?: string;
  className?: string;
  imageStyle?: CSSProperties;
}) {
  const { data: url } = usePhotoUrl(path);
  const inicial = (fallback || alt || "?").trim().slice(0, 2).toUpperCase();

  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-muted text-xs font-bold uppercase text-muted-foreground",
        "h-12 w-12",
        className,
      )}
    >
      {url ? (
        <img src={url} alt={alt} loading="lazy" className="h-full w-full bg-muted object-cover object-center" style={imageStyle} />
      ) : (
        inicial
      )}
    </span>
  );
}

/** Variante retangular para fotos de produto do Comercial. */
export function PhotoThumb({
  path,
  alt,
  className,
}: {
  path?: string | null;
  alt: string;
  className?: string;
}) {
  const { data: url } = usePhotoUrl(path);
  return (
    <span
      className={cn(
        "grid h-24 w-full place-items-center overflow-hidden rounded border border-border bg-muted text-[11px] uppercase tracking-wider text-muted-foreground",
        className,
      )}
    >
      {url ? (
        <img src={url} alt={alt} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        "sem foto"
      )}
    </span>
  );
}
