"""League Client Update (LCU) HTTP client via lockfile auth."""

from __future__ import annotations

import base64
import json
import os
import ssl
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class LcuConnection:
    port: int
    password: str
    protocol: str = "https"

    @property
    def base_url(self) -> str:
        return f"{self.protocol}://127.0.0.1:{self.port}"

    @property
    def auth_header(self) -> str:
        token = base64.b64encode(f"riot:{self.password}".encode()).decode()
        return f"Basic {token}"


def _lockfile_candidates() -> list[Path]:
    local = os.environ.get("LOCALAPPDATA", "")
    home = Path.home()
    explicit = os.environ.get("LCU_LOCKFILE")
    paths: list[Path] = []
    if explicit:
        paths.append(Path(explicit))
    # Prefer League Client (has gameflow / EOG). Riot Client alone is not enough.
    paths.extend(
        [
            Path(local) / "Riot Games" / "League of Legends" / "lockfile",
            home
            / "Library"
            / "Application Support"
            / "Riot Games"
            / "League of Legends"
            / "lockfile",
            home / ".wine" / "drive_c" / "Riot Games" / "League of Legends" / "lockfile",
            Path(local) / "Riot Games" / "Riot Client" / "Config" / "lockfile",
        ]
    )
    return paths


def discover_lockfiles() -> list[Path]:
    """All lockfiles under Riot Games (newest first)."""
    local = Path(os.environ.get("LOCALAPPDATA", "")) / "Riot Games"
    found: list[Path] = []
    if local.is_dir():
        for p in local.rglob("lockfile"):
            if p.is_file():
                found.append(p)
    found.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    # De-dupe while preserving order
    seen: set[Path] = set()
    unique: list[Path] = []
    for p in found:
        resolved = p.resolve()
        if resolved not in seen:
            seen.add(resolved)
            unique.append(p)
    return unique


def read_lockfile(path: Path | None = None, *, require_league: bool = True) -> LcuConnection:
    if path is None:
        for candidate in _lockfile_candidates():
            if candidate.is_file():
                path = candidate
                break
        if path is None:
            for candidate in discover_lockfiles():
                if candidate.is_file():
                    path = candidate
                    break
    if path is None or not path.is_file():
        riot_only = (
            Path(os.environ.get("LOCALAPPDATA", ""))
            / "Riot Games"
            / "Riot Client"
            / "Config"
            / "lockfile"
        ).is_file()
        hint = (
            "Only Riot Client is running — open League of Legends (click Play on LoL) "
            "and stay logged in, then retry."
            if riot_only
            else "Open the League of Legends client and log in, then retry."
        )
        raise FileNotFoundError(
            f"League Client lockfile not found. {hint}\n"
            "Expected: %LOCALAPPDATA%\\Riot Games\\League of Legends\\lockfile\n"
            "Override: set LCU_LOCKFILE to the full path to your lockfile."
        )

    path_str = str(path).replace("\\", "/")
    if require_league and "League of Legends" not in path_str and "league of legends" not in path_str.lower():
        raise FileNotFoundError(
            f"Found lockfile at {path} but this is not the League Client "
            "(Riot Client only). Launch League of Legends from the Riot Client, then retry."
        )

    # name:pid:port:password:protocol
    parts = path.read_text(encoding="utf-8").strip().split(":")
    if len(parts) < 5:
        raise ValueError(f"Invalid lockfile format at {path}")
    return LcuConnection(port=int(parts[2]), password=parts[3], protocol=parts[4])


class LcuClient:
    def __init__(self, conn: LcuConnection | None = None, *, require_league: bool = True) -> None:
        self.conn = conn or read_lockfile(require_league=require_league)
        self._ctx = ssl.create_default_context()
        self._ctx.check_hostname = False
        self._ctx.verify_mode = ssl.CERT_NONE

    def is_league_client(self) -> bool:
        """True if this connection responds like the LoL client (not Riot Client only)."""
        data = self.get_optional("/lol-summoner/v1/current-summoner", timeout=2.0)
        return isinstance(data, dict) and "displayName" in data

    def request(
        self,
        method: str,
        path: str,
        body: dict[str, Any] | None = None,
        timeout: float = 8.0,
    ) -> Any:
        url = f"{self.conn.base_url}{path}"
        data = None
        headers = {
            "Authorization": self.conn.auth_header,
            "Accept": "application/json",
        }
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"

        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, context=self._ctx, timeout=timeout) as resp:
                raw = resp.read()
                if not raw:
                    return None
                return json.loads(raw.decode("utf-8"))
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"LCU {method} {path} -> HTTP {e.code}: {err_body}") from e

    def get(self, path: str, timeout: float = 8.0) -> Any:
        return self.request("GET", path, timeout=timeout)

    def get_optional(self, path: str, timeout: float = 8.0) -> Any:
        try:
            return self.get(path, timeout=timeout)
        except RuntimeError as e:
            if "HTTP 404" in str(e):
                return None
            raise

    def post(self, path: str, body: dict[str, Any] | None = None, timeout: float = 15.0) -> Any:
        return self.request("POST", path, body=body, timeout=timeout)

    def gameflow_phase(self) -> str | None:
        phase = self.get_optional("/lol-gameflow/v1/gameflow-phase")
        return phase if isinstance(phase, str) else None

    def spectate_state(self) -> Any:
        return self.get_optional("/lol-spectator/v1/spectate")

    def eog_stats_block(self) -> dict[str, Any] | None:
        data = self.get_optional("/lol-end-of-game/v1/eog-stats-block", timeout=3.0)
        return data if isinstance(data, dict) else None

    def match_history_game(self, game_id: int | str) -> dict[str, Any] | None:
        data = self.get(f"/lol-match-history/v1/games/{game_id}", timeout=10.0)
        return data if isinstance(data, dict) else None

    def launch_spectate(
        self,
        game_id: int,
        encryption_key: str,
        platform_id: str,
    ) -> Any:
        """Launch spectator via LCU (client must be open)."""
        body = {
            "gameId": game_id,
            "encryptionKey": encryption_key,
            "platformId": platform_id,
        }
        # Try newer endpoint first, then legacy.
        for path in (
            "/lol-gameflow/v2/spectate/launch",
            "/lol-spectator/v1/spectate/launch",
            "/lol-gameflow/v1/spectate/launch",
        ):
            try:
                return self.post(path, body=body, timeout=30.0)
            except RuntimeError:
                continue
        raise RuntimeError("Could not launch spectate — no LCU spectate endpoint accepted the request")
