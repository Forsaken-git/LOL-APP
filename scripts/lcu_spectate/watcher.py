"""Watch LCU + Live Client while spectating and capture completed games."""

from __future__ import annotations

import json
import time
from typing import Any

from .config import CollectorConfig
from .hub import push_to_hub, save_export
from .lcu import LcuClient, read_lockfile
from .live_client import LiveClient
from .mapper import build_from_eog, build_from_live_snapshot


class SpectateWatcher:
    def __init__(self, config: CollectorConfig) -> None:
        self.config = config
        self.lcu: LcuClient | None = None
        self.live = LiveClient()
        self._in_game = False
        self._last_live: dict[str, Any] | None = None
        self._last_game_id: int | str | None = None
        self._captured_ids: set[str] = set()
        self._waiting_logged = False

    def run_forever(self) -> None:
        print("Renim A. LCU spectate collector")
        print(f"  Hub: {self.config.hub_url}")
        print(f"  League: {self.config.league} · Type: {self.config.game_type}")
        print(f"  Roster: {len(self.config.team_summoners)} summoners configured")
        print("  Waiting for League Client + spectator game…")
        print("  (Open LoL from Riot Client -> log in -> start spectating)")
        print("  Ctrl+C to stop\n")

        while True:
            try:
                self._tick()
            except Exception as e:  # noqa: BLE001 — keep daemon alive
                print(f"[error] {e}")
            time.sleep(self.config.poll_interval_sec)

    def _ensure_lcu(self) -> LcuClient | None:
        if self.lcu is not None:
            if self.lcu.is_league_client():
                return self.lcu
            self.lcu = None

        try:
            client = LcuClient()
            if not client.is_league_client():
                if not self._waiting_logged:
                    print(
                        "[lcu] Connected but not League Client — "
                        "launch League of Legends (Play button), not only Riot Client."
                    )
                    self._waiting_logged = True
                return None
            self.lcu = client
            self._waiting_logged = False
            print(f"[lcu] Connected to {client.conn.base_url}")
            return self.lcu
        except FileNotFoundError as e:
            if not self._waiting_logged:
                print(f"[lcu] {e}")
                self._waiting_logged = True
            return None

    def _tick(self) -> None:
        lcu = self._ensure_lcu()
        phase = lcu.gameflow_phase() if lcu else None
        live_up = self.live.is_available()

        if live_up:
            data = self.live.all_game_data()
            if data:
                self._last_live = data
                gd = data.get("gameData") or {}
                self._last_game_id = gd.get("gameId")
            if not self._in_game:
                self._in_game = True
                gid = self._last_game_id or "?"
                print(f"[game] Spectator client active · game {gid} · phase={phase}")
        elif self._in_game:
            print(f"[game] Client closed · capturing stats (phase={phase})…")
            self._capture_end_of_game()
            self._in_game = False
            self._last_live = None
            self._last_game_id = None

        if (
            lcu
            and phase in ("EndOfGame", "PreEndOfGame", "WaitingForStats")
            and self._last_game_id
        ):
            self._capture_end_of_game()

    def _capture_end_of_game(self) -> None:
        lcu = self._ensure_lcu()
        game_id = self._last_game_id
        external_key = f"{self.config.platform_id}_{game_id}" if game_id else None
        if external_key and external_key in self._captured_ids:
            return

        payload: dict[str, Any] | None = None

        if lcu:
            for _ in range(8):
                eog = lcu.eog_stats_block()
                if eog:
                    payload = build_from_eog(eog, self.config)
                    game_id = eog.get("gameId") or game_id
                    break
                time.sleep(1.5)

        if payload is None and self._last_live:
            print("[warn] EOG block unavailable — using last live snapshot (verify W/L)")
            payload = build_from_live_snapshot(self._last_live, self.config)

        if payload is None and game_id and lcu:
            try:
                mh = lcu.match_history_game(int(game_id))
                if mh:
                    print(
                        "[info] Match history returned data but mapper not implemented for MH yet"
                    )
            except RuntimeError:
                pass

        if not payload or not payload.get("matches"):
            print("[skip] Could not build match payload")
            return

        match = payload["matches"][0]
        ext = match.get("externalId") or external_key
        if ext and ext in self._captured_ids:
            return
        if ext:
            self._captured_ids.add(str(ext))

        path = save_export(payload, self.config.export_dir, game_id or ext)
        print(f"[saved] {path}")
        print(
            f"        {match.get('result')} vs {match.get('opponent')} · "
            f"{len(match.get('participants', []))} players"
        )

        if self.config.push_on_complete:
            try:
                result = push_to_hub(payload, self.config.hub_url)
                print(f"[hub] {json.dumps(result)}")
            except RuntimeError as e:
                print(f"[hub] failed: {e}")


def refresh_lcu_connection(watcher: SpectateWatcher) -> None:
    watcher.lcu = LcuClient(read_lockfile())
