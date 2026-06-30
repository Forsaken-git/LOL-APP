"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import {
  CHAMPIONS,
  championImageUrl,
} from "@/lib/champions";
import { championPlaysDraftLane, type DraftLane } from "@/lib/draft-positions";

const PICKER_BG = "#141414";
const PICKER_BORDER = "#3a3530";

const ROLE_FILTERS: { id: DraftLane; label: string }[] = [
  { id: "TOP", label: "Top" },
  { id: "JUNGLE", label: "Jng" },
  { id: "MID", label: "Mid" },
  { id: "ADC", label: "ADC" },
  { id: "SUPPORT", label: "Sup" },
];

function RoleFilterIcon({
  lane,
  active,
  onClick,
}: {
  lane: DraftLane;
  active: boolean;
  onClick: () => void;
}) {
  const paths: Record<DraftLane, string> = {
    TOP: "M4 18 12 4l8 14H4Z",
    JUNGLE: "M12 3c-2 4-6 5-6 9a6 6 0 0 0 12 0c0-4-4-5-6-9Z",
    MID: "M12 2v4M8 8h8M6 12h12M8 16h8M12 18v4",
    ADC: "M4 12h6l2-8 2 8h6",
    SUPPORT: "M12 3 4 9v10h16V9L12 3Z",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded border transition-colors ${
        active
          ? "border-[#a68b7c] bg-[#a68b7c]/15"
          : "border-[#4a4540] bg-[#1e1e1e] hover:border-[#6b635d]"
      }`}
      aria-label={lane}
      title={lane}
    >
      <svg
        viewBox="0 0 24 24"
        className={`h-4 w-4 ${active ? "text-[#d1c7c1]" : "text-[#8a8078]"}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d={paths[lane]} />
      </svg>
    </button>
  );
}

export function PrepChampionPicker({
  scenarioTitle,
  slotLabel,
  slotType = "BAN",
  onConfirm,
  onClose,
}: {
  scenarioTitle: string;
  slotLabel: string;
  slotType?: "BAN" | "PICK";
  onConfirm: (champion: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [roleTab, setRoleTab] = useState<DraftLane | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const champions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return CHAMPIONS.filter((name) => {
      if (roleTab && !championPlaysDraftLane(name, roleTab)) return false;
      if (query && !name.toLowerCase().includes(query)) return false;
      return true;
    }).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [roleTab, search]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${slotType === "PICK" ? "Pick" : "Ban"} champion for ${slotLabel}`}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        aria-label="Close picker"
        onClick={onClose}
      />
      <div
        className="relative flex w-full max-w-[26rem] flex-col overflow-hidden rounded-lg border shadow-2xl"
        style={{
          backgroundColor: PICKER_BG,
          borderColor: PICKER_BORDER,
          maxHeight: "min(34rem, 90vh)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 space-y-2 border-b border-[#2a2622] p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b635d]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search champions..."
              autoFocus
              className="w-full rounded border border-[#3a3530] bg-[#0d0d0d] py-2 pl-9 pr-3 text-sm text-[#d1c7c1] placeholder:text-[#6b635d] focus:border-[#a68b7c] focus:outline-none focus:ring-1 focus:ring-[#a68b7c]/40"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setRoleTab(null)}
              className={`rounded border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                roleTab === null
                  ? "border-[#a68b7c] bg-[#a68b7c]/10 text-[#d1c7c1]"
                  : "border-[#4a4540] bg-[#1e1e1e] text-[#8a8078] hover:border-[#6b635d]"
              }`}
            >
              All
            </button>
            {ROLE_FILTERS.map(({ id }) => (
              <RoleFilterIcon
                key={id}
                lane={id}
                active={roleTab === id}
                onClick={() => setRoleTab((prev) => (prev === id ? null : id))}
              />
            ))}
            <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-[#6b635d]">
              Roles
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-5 gap-2">
            {champions.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => onConfirm(name)}
                className="group flex flex-col items-center"
                title={name}
              >
                <img
                  src={championImageUrl(name)}
                  alt={name}
                  className="aspect-square w-full rounded-sm border border-[#3a3530] object-cover transition-all group-hover:border-[#a68b7c] group-hover:ring-2 group-hover:ring-[#a68b7c]/50"
                />
              </button>
            ))}
          </div>
          {champions.length === 0 && (
            <p className="py-8 text-center text-sm text-[#6b635d]">
              No champions match your filters.
            </p>
          )}
        </div>

        <div
          className="flex shrink-0 items-center justify-between gap-3 border-t border-[#2a2622] p-3"
          style={{ backgroundColor: "#101010" }}
        >
          <p className="text-xs font-bold uppercase tracking-wide text-[#9a9088]">
            {scenarioTitle} — {slotLabel}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-xs font-bold uppercase tracking-wider text-rose-400 transition-colors hover:text-rose-300"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
