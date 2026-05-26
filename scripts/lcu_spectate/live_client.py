"""Live Client Data API (in-game / spectator game client on port 2999)."""

from __future__ import annotations

import json
import ssl
import urllib.error
import urllib.request
from typing import Any

LIVE_CLIENT_BASE = "https://127.0.0.1:2999/liveclientdata"


class LiveClient:
    def __init__(self) -> None:
        self._ctx = ssl.create_default_context()
        self._ctx.check_hostname = False
        self._ctx.verify_mode = ssl.CERT_NONE

    def _get(self, path: str, timeout: float = 2.0) -> Any:
        url = f"{LIVE_CLIENT_BASE}{path}"
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, context=self._ctx, timeout=timeout) as resp:
            raw = resp.read()
            if not raw:
                return None
            return json.loads(raw.decode("utf-8"))

    def is_available(self) -> bool:
        try:
            self._get("/gamestats", timeout=1.0)
            return True
        except (urllib.error.URLError, TimeoutError, OSError):
            return False

    def all_game_data(self) -> dict[str, Any] | None:
        try:
            data = self._get("/allgamedata", timeout=3.0)
            return data if isinstance(data, dict) else None
        except (urllib.error.URLError, TimeoutError, OSError):
            return None

    def event_data(self) -> dict[str, Any] | None:
        try:
            data = self._get("/eventdata", timeout=2.0)
            return data if isinstance(data, dict) else None
        except (urllib.error.URLError, TimeoutError, OSError):
            return None
