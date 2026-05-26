"""Push ingest payloads to the Renim A. hub."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


def save_export(payload: dict[str, Any], export_dir: str, game_id: str | int | None) -> Path:
    out_dir = Path(export_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = game_id or "unknown"
    path = out_dir / f"lcu-{stamp}.json"
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return path


def push_to_hub(payload: dict[str, Any], hub_url: str, api_key: str | None = None) -> dict[str, Any]:
    url = hub_url.rstrip("/") + "/api/ingest"
    key = api_key if api_key is not None else os.environ.get("INGEST_API_KEY", "")

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={
            "Content-Type": "application/json",
            **({"x-api-key": key} if key else {}),
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Hub ingest failed HTTP {e.code}: {e.read().decode()}") from e
