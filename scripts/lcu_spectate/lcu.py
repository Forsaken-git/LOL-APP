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


def _is_league_lockfile_path(path: Path) -> bool:
    normalized = str(path).replace("\\", "/").lower()
    if "riot client" in normalized:
        return False
    return "league of legends" in normalized


def _lockfile_candidates() -> list[Path]:
    local = os.environ.get("LOCALAPPDATA", "")
    home = Path.home()
    explicit = os.environ.get("LCU_LOCKFILE")
    paths: list[Path] = []
    if explicit:
        paths.append(Path(explicit))

    # League lockfile — AppData (some installs) then game install folder (common on Windows).
    paths.extend(
        [
            Path(local) / "Riot Games" / "League of Legends" / "lockfile",
            Path(r"C:\Riot Games\League of Legends\lockfile"),
            Path(r"D:\Riot Games\League of Legends\lockfile"),
            Path(r"E:\Riot Games\League of Legends\lockfile"),
            home
            / "Library"
            / "Application Support"
            / "Riot Games"
            / "League of Legends"
            / "lockfile",
            home / ".wine" / "drive_c" / "Riot Games" / "League of Legends" / "lockfile",
        ]
    )

    install_root = os.environ.get("LEAGUE_INSTALL_DIR")
    if install_root:
        paths.append(Path(install_root) / "lockfile")

    # Riot Client lockfile last — not sufficient for EOG, but used when require_league=False.
    paths.append(Path(local) / "Riot Games" / "Riot Client" / "Config" / "lockfile")
    return paths


def discover_lockfiles() -> list[Path]:
    """Lockfiles under Riot folders; League install paths before Riot Client."""
    found: list[Path] = []
    roots = [
        Path(os.environ.get("LOCALAPPDATA", "")) / "Riot Games",
        Path(r"C:\Riot Games"),
        Path(r"D:\Riot Games"),
        Path(r"E:\Riot Games"),
    ]
    for root in roots:
        if not root.is_dir():
            continue
        for p in root.rglob("lockfile"):
            if p.is_file():
                found.append(p)

    found.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    seen: set[Path] = set()
    league: list[Path] = []
    other: list[Path] = []
    for p in found:
        resolved = p.resolve()
        if resolved in seen:
            continue
        seen.add(resolved)
        (league if _is_league_lockfile_path(resolved) else other).append(resolved)
    return league + other


def read_lockfile(path: Path | None = None, *, require_league: bool = True) -> LcuConnection:
    if path is None:
        for candidate in _lockfile_candidates():
            if not candidate.is_file():
                continue
            if require_league and not _is_league_lockfile_path(candidate):
                continue
            path = candidate
            break
        if path is None:
            for candidate in discover_lockfiles():
                if not candidate.is_file():
                    continue
                if require_league and not _is_league_lockfile_path(candidate):
                    continue
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
            "Expected: C:\\Riot Games\\League of Legends\\lockfile "
            "(or %LOCALAPPDATA%\\Riot Games\\League of Legends\\lockfile)\n"
            "Override: set LCU_LOCKFILE to the full path to your lockfile."
        )

    if require_league and not _is_league_lockfile_path(path):
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

    def champ_select_session(self) -> dict[str, Any] | None:
        data = self.get_optional("/lol-champ-select/v1/session", timeout=3.0)
        return data if isinstance(data, dict) else None

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
