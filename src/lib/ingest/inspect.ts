function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describeValue(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `array[${value.length}]`;
  return typeof value;
}

function sampleKeys(item: unknown): string[] {
  if (!isRecord(item)) return [];
  return Object.keys(item).slice(0, 12);
}

/** Print a short structural summary of unknown JSON (for mapping external tools). */
export function inspectJsonStructure(raw: unknown): string {
  const lines: string[] = [];

  if (Array.isArray(raw)) {
    lines.push(`Root: array with ${raw.length} item(s)`);
    if (raw[0]) {
      lines.push(`  First item keys: ${sampleKeys(raw[0]).join(", ") || "(not an object)"}`);
    }
    return lines.join("\n");
  }

  if (!isRecord(raw)) {
    return `Root: ${describeValue(raw)}`;
  }

  lines.push("Root object:");
  for (const [key, value] of Object.entries(raw)) {
    lines.push(`  ${key}: ${describeValue(value)}`);
    if (Array.isArray(value) && value[0] && isRecord(value[0])) {
      lines.push(`    → item keys: ${sampleKeys(value[0]).join(", ")}`);
    }
    if (isRecord(value)) {
      const nestedArrays = Object.entries(value).filter(([, v]) => Array.isArray(v));
      for (const [nk, nv] of nestedArrays.slice(0, 3)) {
        const arr = nv as unknown[];
        lines.push(`    → ${key}.${nk}: array[${arr.length}]`);
        if (arr[0] && isRecord(arr[0])) {
          lines.push(`      keys: ${sampleKeys(arr[0]).join(", ")}`);
        }
      }
    }
  }

  return lines.join("\n");
}
