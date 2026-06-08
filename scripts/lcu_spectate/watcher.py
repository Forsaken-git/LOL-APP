"""Watch LCU + Live Client while spectating and capture completed games."""

from __future__ import annotations

import json
import time
from enum import Enum
from typing import Any

from .champ_select import (
    EXPECTED_DRAFT_TURNS,
    format_draft_line,
    is_standard_draft_complete,
    merge_incremental_draft,
)
from .config import CollectorConfig
from .eog_fetch import poll_eog_block
from .eog_validate import is_eog_complete, validate_extracted_match
from .hub import push_to_hub, save_export, save_jsonl_backup
from .lcu import LcuClient
from .live_client import LiveClient
from .mapper import build_from_eog, build_from_live_snapshot


POST_GAME_PHASES = frozenset({"PreEndOfGame", "EndOfGame", "WaitingForStats"})
CHAMP_SELECT_PHASE = "ChampSelect"


class _State(str, Enum):
    IDLE = "idle"
    LIVE = "live"
    EOG_HUNT = "eog_hunt"


class SpectateWatcher:
    def __init__(self, config: CollectorConfig) -> None:
        self.config = config
        self.lcu: LcuClient | None = None
        self.live = LiveClient()
        self._state = _State.IDLE
        self._last_live: dict[str, Any] | None = None
        self._last_game_id: int | str | None = None
        self._captured_ids: set[str] = set()
        self._waiting_logged = False
        self._eog_deadline: float | None = None
        self._live_was_up = False
        self._eog_attempts = 0
        self._empty_live_logged = False
        self._champ_select_active = False
        self._draft_pick_bans: list[dict[str, Any]] = []
        self._draft_seen_action_ids: set[int] = set()
        self._draft_complete_logged = False

    def run_forever(self) -> None:
        print("Renim A. LCU spectate collector")
        print(f"  Hub: {self.config.hub_url}")
        print(f"  League: {self.config.league} · Type: {self.config.game_type}")
        print(f"  Roster: {len(self.config.team_summoners)} summoners configured")
        print(
            f"  EOG: poll every {self.config.eog_poll_interval_sec}s, "
            f"timeout {self.config.post_game_timeout_sec}s"
        )
        if self.config.capture_champ_select_draft:
            print(
                f"  Draft: champ-select capture on ({EXPECTED_DRAFT_TURNS}-turn order)"
            )
        print("  Waiting for League Client…")
        print(
            "  Start before champ select for full pick/ban order; "
            "keep running through spectate + post-game."
        )
        print("  Ctrl+C to stop\n")

        while True:
            try:
                self._tick()
            except Exception as e:  # noqa: BLE001 — keep daemon alive
                print(f"[error] {e}")

            if self._state == _State.EOG_HUNT:
                time.sleep(self.config.eog_poll_interval_sec)
            else:
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

        if self._state == _State.EOG_HUNT:
            self._eog_tick(lcu, phase)
            return

        if lcu and self.config.capture_champ_select_draft:
            self._tick_champ_select(lcu, phase)

        if live_up:
            data = self.live.all_game_data()
            players = data.get("allPlayers") if isinstance(data, dict) else None
            has_players = isinstance(players, list) and len(players) > 0
            game_id = None
            if isinstance(data, dict):
                gd = data.get("gameData") or {}
                if isinstance(gd, dict):
                    game_id = gd.get("gameId")

            if has_players or game_id:
                self._last_live = data
                if game_id:
                    self._last_game_id = game_id
                if self._state == _State.IDLE:
                    gid = self._last_game_id or "?"
                    print(f"[game] Spectator live client up · game {gid} · phase={phase}")
                    self._state = _State.LIVE
                self._live_was_up = True
                self._empty_live_logged = False
                # Live client often stays up with stale data through EndOfGame — start EOG
                # before waiting for port 2999 to close (otherwise capture never begins).
                if self._state == _State.LIVE:
                    end_reason: str | None = None
                    if phase in POST_GAME_PHASES:
                        end_reason = f"phase={phase}"
                    elif self._has_game_end_event():
                        end_reason = "GameEnd event"
                    if end_reason:
                        if self._already_captured_current_game():
                            return
                        print(
                            f"[game] End detected ({end_reason}) · hunting EOG · phase={phase}"
                        )
                        self._begin_eog_hunt()
                        return
            elif not self._empty_live_logged:
                print(
                    "[live] Endpoint is up but match data is empty "
                    "(players=0, no gameId) — waiting for active spectator feed."
                )
                self._empty_live_logged = True
            return

        if self._state == _State.LIVE:
            reason = self._end_reason(phase, live_up)
            print(f"[game] End detected ({reason}) · hunting EOG · phase={phase}")
            self._begin_eog_hunt()
            return

        if (
            lcu
            and phase in POST_GAME_PHASES
            and (self._last_game_id or self._live_was_up)
        ):
            print(f"[game] Post-game phase {phase} · hunting EOG")
            self._begin_eog_hunt()

    def _end_reason(self, phase: str | None, live_up: bool) -> str:
        if not live_up and self._live_was_up:
            return "live client closed"
        if phase in POST_GAME_PHASES:
            return f"phase={phase}"
        if self._has_game_end_event():
            return "GameEnd event"
        return "spectator session ended"

    def _has_game_end_event(self) -> bool:
        ev = self.live.event_data()
        if not ev:
            return False
        for item in ev.get("Events") or []:
            if isinstance(item, dict) and item.get("EventName") == "GameEnd":
                return True
        return False

    def _tick_champ_select(self, lcu: LcuClient, phase: str | None) -> None:
        if phase == CHAMP_SELECT_PHASE:
            if not self._champ_select_active:
                self._champ_select_active = True
                self._draft_pick_bans = []
                self._draft_seen_action_ids = set()
                self._draft_complete_logged = False
                print("[draft] Champion select started — recording pick/ban order")
            session = lcu.champ_select_session()
            if not session:
                return
            self._draft_pick_bans, new_rows = merge_incremental_draft(
                self._draft_pick_bans,
                self._draft_seen_action_ids,
                session,
                ddragon_version=self.config.ddragon_version,
            )
            for row in new_rows:
                print(f"[draft]{format_draft_line(row)}")
            if (
                not self._draft_complete_logged
                and is_standard_draft_complete(self._draft_pick_bans)
            ):
                self._draft_complete_logged = True
                print(f"[draft] All {EXPECTED_DRAFT_TURNS} turns recorded")
                self._save_draft_snapshot()
            return

        if self._champ_select_active:
            self._champ_select_active = False
            n = len(self._draft_pick_bans)
            if n > 0:
                print(f"[draft] Champion select ended · {n} actions saved for this game")
            elif not self._draft_complete_logged:
                print("[draft] Champion select ended · no actions captured")

    def _save_draft_snapshot(self) -> None:
        from pathlib import Path

        path = Path(self.config.export_dir) / "draft-latest.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps({"pickBans": self._draft_pick_bans}, indent=2),
            encoding="utf-8",
        )

    def _pick_bans_for_match(self) -> list[dict[str, Any]] | None:
        if not self._draft_pick_bans:
            return None
        bans = sum(1 for r in self._draft_pick_bans if r.get("type") == "BAN")
        picks = sum(1 for r in self._draft_pick_bans if r.get("type") == "PICK")
        if is_standard_draft_complete(self._draft_pick_bans):
            return self._draft_pick_bans
        if len(self._draft_pick_bans) >= 12 and bans >= 3 and picks >= 3:
            return self._draft_pick_bans
        return None

    def _already_captured_current_game(self) -> bool:
        gid = self._last_game_id
        if not gid:
            return False
        key = f"{self.config.platform_id}_{gid}"
        return key in self._captured_ids

    def _begin_eog_hunt(self) -> None:
        if self._already_captured_current_game():
            return
        self._state = _State.EOG_HUNT
        self._eog_deadline = time.monotonic() + self.config.post_game_timeout_sec
        self._live_was_up = False
        self._eog_attempts = 0

    def _eog_tick(self, lcu: LcuClient | None, phase: str | None) -> None:
        if self._eog_deadline is not None and time.monotonic() > self._eog_deadline:
            print(
                f"[timeout] No complete EOG after {self.config.post_game_timeout_sec}s "
                f"(last phase={phase}). Try `npm run lcu:export -- --push` on post-game screen."
            )
            self._reset_after_capture(failed=True)
            return

        if not lcu:
            return

        self._eog_attempts += 1
        eog = lcu.eog_stats_block()
        if eog:
            ok, issues = is_eog_complete(eog)
            if ok:
                self._finalize_capture(eog, phase)
                return
            if issues and self._eog_attempts % 12 == 1:
                print(f"[eog] incomplete: {', '.join(issues)} · phase={phase}")
        elif self._eog_attempts % 12 == 1:
            print(f"[eog] waiting for stats block · phase={phase}")

        if phase in POST_GAME_PHASES and eog is None:
            pass  # keep polling — block often appears a moment after phase change

    def _finalize_capture(
        self,
        eog: dict[str, Any],
        phase: str | None,
        *,
        push: bool | None = None,
    ) -> None:
        game_id = eog.get("gameId") or self._last_game_id
        if game_id:
            self._last_game_id = game_id
        external_key = f"{self.config.platform_id}_{game_id}" if game_id else None
        if external_key and external_key in self._captured_ids:
            self._reset_after_capture(failed=False)
            return

        draft_pb = self._pick_bans_for_match()
        payload = build_from_eog(
            eog,
            self.config,
            pick_bans_override=draft_pb,
        )
        if not payload or not payload.get("matches"):
            print("[skip] EOG present but could not build match payload (check roster / teamSummoners)")
            self._reset_after_capture(failed=True)
            return

        match = payload["matches"][0]
        if draft_pb:
            print(f"        draft: {len(draft_pb)} pick/ban rows (champ select)")
        complete, field_issues = validate_extracted_match(match)
        if not complete:
            print(
                "[warn] Extracted match missing fields:",
                "; ".join(field_issues[:8]),
                ("…" if len(field_issues) > 8 else ""),
            )

        ext = match.get("externalId") or external_key
        if ext and ext in self._captured_ids:
            self._reset_after_capture(failed=False)
            return
        if ext:
            self._captured_ids.add(str(ext))

        path = save_export(payload, self.config.export_dir, game_id or ext)
        print(f"[saved] {path}")
        print(
            f"        {match.get('result')} vs {match.get('opponent')} · "
            f"{len(match.get('participants', []))} players"
        )

        if self.config.save_jsonl_backup:
            jl = save_jsonl_backup(
                self.config.export_dir, eog, gameflow_phase=phase
            )
            print(f"[backup] {jl}")

        do_push = self.config.push_on_complete if push is None else push
        if do_push:
            try:
                result = push_to_hub(payload, self.config.hub_url)
                print(f"[hub] {json.dumps(result)}")
            except RuntimeError as e:
                print(f"[hub] failed: {e}")

        self._reset_after_capture(failed=False)

    def _reset_after_capture(self, *, failed: bool) -> None:
        self._state = _State.IDLE
        self._eog_deadline = None
        if not failed:
            self._last_live = None
            self._draft_pick_bans = []
            self._draft_seen_action_ids = set()
            self._draft_complete_logged = False
            # Keep _last_game_id so we do not re-hunt EOG while spectate client stays open.

    def capture_end_of_game_blocking(self, *, push: bool | None = None) -> bool:
        """One-shot EOG hunt (used by export-eog). Returns True if saved."""
        lcu = self._ensure_lcu()
        if not lcu:
            print("[skip] League Client not connected")
            return False

        def on_wait(phase: str | None, issues: list[str]) -> None:
            hint = f" · issues={','.join(issues)}" if issues else ""
            print(f"[eog] waiting… phase={phase}{hint}")

        eog, phase = poll_eog_block(
            lcu,
            poll_interval_sec=self.config.eog_poll_interval_sec,
            timeout_sec=self.config.post_game_timeout_sec,
            on_wait=on_wait,
        )
        if not eog:
            phase = lcu.gameflow_phase()
            print(
                f"[skip] No complete EOG (phase={phase}). "
                "Stay on the post-game / stats screen in the League client."
            )
            if self._last_live:
                print("[warn] Trying live snapshot fallback (partial stats)")
                payload = build_from_live_snapshot(self._last_live, self.config)
                if payload and payload.get("matches"):
                    match = payload["matches"][0]
                    path = save_export(
                        payload, self.config.export_dir, self._last_game_id
                    )
                    print(f"[saved] {path} (live fallback)")
                    return True
            return False

        self._finalize_capture(eog, phase, push=push)
        return True


def refresh_lcu_connection(watcher: SpectateWatcher) -> None:
    from .lcu import read_lockfile

    watcher.lcu = LcuClient(read_lockfile())
