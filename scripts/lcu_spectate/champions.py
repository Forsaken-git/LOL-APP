"""Champion id ↔ name helpers (Data Dragon cache)."""

from __future__ import annotations

import json
import os
import urllib.request
from pathlib import Path
from typing import Any

DEFAULT_DDRAGON_VERSION = "14.24.1"
CACHE_DIR = Path(__file__).resolve().parents[2] / "data" / "cache"


def _cache_path(version: str) -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return CACHE_DIR / f"champions-{version}.json"


def load_champion_map(version: str = DEFAULT_DDRAGON_VERSION) -> dict[int, str]:
    path = _cache_path(version)
    if path.is_file():
        data = json.loads(path.read_text(encoding="utf-8"))
        return {int(k): v for k, v in data.items()}

    url = (
        f"https://ddragon.leagueoflegends.com/cdn/{version}/data/en_US/champion.json"
    )
    with urllib.request.urlopen(url, timeout=20) as resp:
        payload = json.loads(resp.read().decode("utf-8"))

    mapping: dict[int, str] = {}
    for entry in payload.get("data", {}).values():
        if not isinstance(entry, dict):
            continue
        cid = entry.get("key")
        name = entry.get("name") or entry.get("id")
        if cid is not None and name:
            mapping[int(cid)] = str(name)

    path.write_text(
        json.dumps({str(k): v for k, v in mapping.items()}, indent=2),
        encoding="utf-8",
    )
    return mapping


def champion_name(champion_id: int, version: str = DEFAULT_DDRAGON_VERSION) -> str:
    global _MAP  # noqa: PLW0603
    if _MAP is None:
        _MAP = load_champion_map(version)
    return _MAP.get(champion_id, f"Champion{champion_id}")


_MAP: dict[int, str] | None = None


def normalize_summoner(name: str) -> str:
    return name.strip().lower()
