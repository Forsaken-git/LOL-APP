"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { itemImageUrl, summonerSpellImageUrl } from "@/lib/items";
import {
  getCatalogItem,
  loadItemCatalog,
  type ItemCatalogEntry,
} from "@/lib/item-catalog";
import {
  getCatalogSpell,
  loadSpellCatalog,
  type SpellCatalogEntry,
} from "@/lib/spell-catalog";
import {
  getCatalogRune,
  loadRuneCatalog,
  type RuneCatalogEntry,
} from "@/lib/rune-catalog";

export type ScoreboardCatalogs = {
  items: Map<number, ItemCatalogEntry> | null;
  spells: Map<number, SpellCatalogEntry> | null;
  runes: Map<number, RuneCatalogEntry> | null;
};

function HoverWrap({
  children,
  tooltip,
}: {
  children: ReactNode;
  tooltip: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  return (
    <>
      <span
        className="inline-flex shrink-0 cursor-help"
        onMouseEnter={(e) => {
          setAnchor(e.currentTarget.getBoundingClientRect());
          setHover(true);
        }}
        onMouseLeave={() => {
          setHover(false);
          setAnchor(null);
        }}
      >
        {children}
      </span>
      {hover && anchor && typeof document !== "undefined"
        ? createPortal(
            <TooltipShell anchor={anchor}>{tooltip}</TooltipShell>,
            document.body,
          )
        : null}
    </>
  );
}

function TooltipShell({
  anchor,
  children,
}: {
  anchor: DOMRect;
  children: ReactNode;
}) {
  const top = Math.max(8, anchor.top - 8);
  const left = anchor.left + anchor.width / 2;
  const flipBelow = anchor.top < 120;

  return (
    <div
      className="pointer-events-none fixed z-[300] w-56 rounded-lg border border-white/15 bg-[#1a1d26] px-3 py-2 text-left shadow-xl"
      style={{
        left,
        top: flipBelow ? anchor.bottom + 8 : top,
        transform: flipBelow
          ? "translate(-50%, 0)"
          : "translate(-50%, -100%)",
      }}
      role="tooltip"
    >
      {children}
    </div>
  );
}

function ItemTooltipBody({
  item,
  itemId,
}: {
  item: ItemCatalogEntry | null;
  itemId: number;
}) {
  if (!item) {
    return <p className="text-sm text-muted">Item {itemId}</p>;
  }

  return (
    <>
      <p className="text-sm font-semibold text-foreground">{item.name}</p>
      {item.gold != null && item.gold > 0 ? (
        <p className="mt-0.5 text-xs tabular-nums text-amber-400/90">
          {item.gold.toLocaleString()}g
        </p>
      ) : null}
      {item.statLines.length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-xs text-emerald-300/95">
          {item.statLines.map((line) => (
            <li key={line.label}>{line.label}</li>
          ))}
        </ul>
      ) : null}
      {item.plaintext ? (
        <p className="mt-2 text-xs leading-snug text-muted">{item.plaintext}</p>
      ) : null}
    </>
  );
}

function NameDescTooltip({
  name,
  description,
  fallback,
  subtitle,
}: {
  name: string;
  description: string;
  fallback: string;
  subtitle?: string;
}) {
  return (
    <>
      <p className="text-sm font-semibold text-foreground">{name}</p>
      {subtitle ? (
        <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted">
          {subtitle}
        </p>
      ) : null}
      {description ? (
        <p className="mt-2 text-xs leading-snug text-muted">{description}</p>
      ) : (
        <p className="mt-2 text-xs text-muted">{fallback}</p>
      )}
    </>
  );
}

export function ScoreboardItemIcon({
  itemId,
  className = "size-9 shrink-0 rounded object-cover",
  catalog,
}: {
  itemId: number;
  className?: string;
  catalog: Map<number, ItemCatalogEntry> | null;
}) {
  const item = getCatalogItem(catalog, itemId);
  return (
    <HoverWrap tooltip={<ItemTooltipBody item={item} itemId={itemId} />}>
      <img src={itemImageUrl(itemId)} alt="" className={className} />
    </HoverWrap>
  );
}

export function ScoreboardSpellIcon({
  spellId,
  className = "size-9 shrink-0 rounded object-cover",
  catalog,
}: {
  spellId: number;
  className?: string;
  catalog: Map<number, SpellCatalogEntry> | null;
}) {
  const spell = getCatalogSpell(catalog, spellId);
  const src = summonerSpellImageUrl(spellId);
  if (!src) return null;

  return (
    <HoverWrap
      tooltip={
        <NameDescTooltip
          name={spell?.name ?? `Spell ${spellId}`}
          description={spell?.description ?? ""}
          fallback={`Summoner spell ${spellId}`}
          subtitle="Summoner spell"
        />
      }
    >
      <img src={src} alt="" className={className} />
    </HoverWrap>
  );
}

export function ScoreboardRuneIcon({
  runeId,
  imageUrl,
  className = "size-9 shrink-0 rounded object-cover",
  catalog,
  fallbackName,
}: {
  runeId: number | null;
  imageUrl: string | null;
  className?: string;
  catalog: Map<number, RuneCatalogEntry> | null;
  fallbackName?: string;
}) {
  if (!imageUrl) {
    return (
      <span
        className={`border border-dashed border-white/10 bg-white/[0.02] ${className}`}
      />
    );
  }

  const rune = runeId != null ? getCatalogRune(catalog, runeId) : null;
  const subtitle =
    rune?.kind === "style"
      ? "Rune tree"
      : rune?.kind === "perk"
        ? "Keystone"
        : "Rune";

  return (
    <HoverWrap
      tooltip={
        <NameDescTooltip
          name={rune?.name ?? fallbackName ?? "Rune"}
          description={rune?.description ?? ""}
          fallback={fallbackName ?? "Rune"}
          subtitle={subtitle}
        />
      }
    >
      <img src={imageUrl} alt="" className={className} />
    </HoverWrap>
  );
}

export function useScoreboardCatalogs(): ScoreboardCatalogs {
  const [catalogs, setCatalogs] = useState<ScoreboardCatalogs>({
    items: null,
    spells: null,
    runes: null,
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadItemCatalog(), loadSpellCatalog(), loadRuneCatalog()])
      .then(([items, spells, runes]) => {
        if (!cancelled) setCatalogs({ items, spells, runes });
      })
      .catch(() => {
        if (!cancelled) {
          setCatalogs({
            items: new Map(),
            spells: new Map(),
            runes: new Map(),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return catalogs;
}

/** @deprecated use useScoreboardCatalogs */
export function useItemCatalog() {
  const catalogs = useScoreboardCatalogs();
  return catalogs.items;
}
