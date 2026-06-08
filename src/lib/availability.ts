import {
  WEEKDAYS,
  type AvailabilityData,
  type Weekday,
  emptyAvailability,
} from "@/lib/week";

export const AVAILABILITY_PRESETS = [
  { key: "unset", label: "Not set", shortLabel: "—", value: "" },
  {
    key: "evening",
    label: "Evening",
    shortLabel: "18–22",
    value: "18:00–22:00",
  },
  {
    key: "afternoon",
    label: "Afternoon",
    shortLabel: "14–18",
    value: "14:00–18:00",
  },
  {
    key: "allday",
    label: "All day",
    shortLabel: "All day",
    value: "10:00–22:00",
  },
  { key: "busy", label: "Busy", shortLabel: "Busy", value: "Busy" },
] as const;

export type PresetKey = (typeof AVAILABILITY_PRESETS)[number]["key"] | "custom";

export type PresetOption = (typeof AVAILABILITY_PRESETS)[number];

const presetByValue = new Map(
  AVAILABILITY_PRESETS.filter((p) => p.value).map((p) => [p.value.toLowerCase(), p]),
);

export function resolveSlot(value: string): {
  key: PresetKey;
  label: string;
  shortLabel: string;
} {
  const trimmed = value.trim();
  if (!trimmed) {
    return { key: "unset", label: "Not set", shortLabel: "—" };
  }

  if (trimmed.toLowerCase() === "busy") {
    const p = AVAILABILITY_PRESETS.find((x) => x.key === "busy")!;
    return { key: "busy", label: p.label, shortLabel: p.shortLabel };
  }

  const preset = presetByValue.get(trimmed.toLowerCase());
  if (preset) {
    return { key: preset.key, label: preset.label, shortLabel: preset.shortLabel };
  }

  return { key: "custom", label: trimmed, shortLabel: trimmed };
}

export function isSlotAvailable(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !trimmed.toLowerCase().includes("busy");
}

export function applyPresetToWeek(
  data: AvailabilityData,
  preset: PresetOption,
): AvailabilityData {
  const next = { ...data };
  for (const day of WEEKDAYS) {
    next[day] = preset.value;
  }
  return next;
}

export function applyPresetToDay(
  data: AvailabilityData,
  day: Weekday,
  preset: PresetOption,
): AvailabilityData {
  return { ...data, [day]: preset.value };
}

export { emptyAvailability, WEEKDAYS };
export type { AvailabilityData, Weekday };
