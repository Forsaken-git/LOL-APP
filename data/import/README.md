# Import JSON from other tools

Three competition types — use one folder per type:

```
data/import/
  cwl/              → CWL (official)
  titans league/    → Titans League (official)
  scrims/           → Scrims
```

Legacy folder name `officials/` is treated as **CWL**.

## Import all team folders

```bash
npm run ingest:teams -- --dry-run
npm run ingest:teams -- --local
```

## Canonical JSON shape

See [`../example-export.json`](../example-export.json). Set `league` to `CWL`, `Titans League`, or `Scrim` to match the type.
