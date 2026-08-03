"use client";

import { useState } from "react";
import { championImageUrl, type ChampionImageVariant } from "@/lib/champions";

type Props = {
  champion: string;
  variant?: ChampionImageVariant;
  className?: string;
  alt?: string;
};

/** Champion portrait with a quiet fallback when CDN/key resolution fails. */
export function ChampionIcon({
  champion,
  variant = "square",
  className = "h-6 w-6 rounded-md border border-border",
  alt = "",
}: Props) {
  const [failed, setFailed] = useState(false);

  if (!champion.trim() || failed) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center bg-inset text-[9px] font-semibold uppercase tracking-wide text-faint ${className}`}
        aria-hidden={alt ? undefined : true}
        title={champion || "Unknown"}
      >
        {(champion.trim() || "?").slice(0, 2)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={championImageUrl(champion, variant)}
      alt={alt}
      className={`shrink-0 object-cover ${className}`}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
