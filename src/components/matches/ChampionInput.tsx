"use client";

import { CHAMPIONS } from "@/lib/champions";

export const CHAMPION_DATALIST_ID = "lol-champion-names";

/** Render once per page that uses ChampionInput fields. */
export function ChampionDatalist() {
  return (
    <datalist id={CHAMPION_DATALIST_ID}>
      {CHAMPIONS.map((c) => (
        <option key={c} value={c} />
      ))}
    </datalist>
  );
}

export function ChampionInput({
  value,
  onChange,
  placeholder = "Champion",
  className = "",
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      list={CHAMPION_DATALIST_ID}
      placeholder={placeholder}
      required={required}
      className={className}
      autoComplete="off"
    />
  );
}
