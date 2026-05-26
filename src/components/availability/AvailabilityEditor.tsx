"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { WEEKDAYS, type AvailabilityData, emptyAvailability } from "@/lib/week";

export function AvailabilityEditor({
  playerId,
  playerName,
  weekStart,
  initial,
}: {
  playerId: string;
  playerName: string;
  weekStart: string;
  initial: AvailabilityData;
}) {
  const router = useRouter();
  const [slots, setSlots] = useState<AvailabilityData>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    await fetch("/api/availability", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId, weekStart, slots }),
    });
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-border bg-inset/80 p-4">
      <p className="mb-3 font-medium text-foreground">{playerName}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {WEEKDAYS.map((day) => (
          <label key={day} className="block text-xs capitalize text-muted">
            {day}
            <input
              className="mt-1 w-full"
              placeholder="e.g. 18:00–22:00 or Busy"
              value={slots[day]}
              onChange={(e) =>
                setSlots((s) => ({ ...s, [day]: e.target.value }))
              }
            />
          </label>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save week"}
        </button>
        {saved && <span className="text-xs text-emerald-400">Saved</span>}
      </div>
    </div>
  );
}

export function AvailabilityEditorPlaceholder({
  playerId,
  playerName,
  weekStart,
}: {
  playerId: string;
  playerName: string;
  weekStart: string;
}) {
  return (
    <AvailabilityEditor
      playerId={playerId}
      playerName={playerName}
      weekStart={weekStart}
      initial={emptyAvailability()}
    />
  );
}
