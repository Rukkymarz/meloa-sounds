/* Artwork with a quiet fallback built from the title, so rows never show broken images. */
export function Artwork({ src, title, size, className = "", round = false }: { src?: string; title: string; size?: number; className?: string; round?: boolean }) {
  const initials = title
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  const style = size ? { width: size, height: size } : undefined;
  return (
    <span className={`art ${round ? "round" : ""} ${className}`} style={style}>
      {src ? <img src={src} alt="" loading="lazy" decoding="async" /> : <span className="art-fallback" aria-hidden="true">{initials || "♪"}</span>}
    </span>
  );
}
