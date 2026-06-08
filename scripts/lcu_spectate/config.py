"""Load collector configuration."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

DEFAULT_CONFIG_PATH = (
    Path(__file__).resolve().parents[2] / "data" / "lcu-spectate.config.json"
)


@dataclass
class RosterEntry:
    external_id: str
    display_name: str
    summoner_name: str | None = None
    team_role: str | None = None
    member_role: str | None = None


@dataclass
class CollectorConfig:
    hub_url: str = "http://localhost:3000"
    league: str = "Scrim"
    game_type: str = "SCRIM"
    platform_id: str = "EUW1"
    opponent: str | None = None
    team_summoners: list[str] = field(default_factory=list)
    roster: dict[str, RosterEntry] = field(default_factory=dict)
    export_dir: str = "data/exports"
    push_on_complete: bool = True
    poll_interval_sec: float = 2.0
    eog_poll_interval_sec: float = 0.5
    post_game_timeout_sec: float = 120.0
    save_jsonl_backup: bool = True
    capture_champ_select_draft: bool = True
    ddragon_version: str = "14.24.1"
    source: str = "lcu-spectate"

    @classmethod
    def load(cls, path: Path | None = None) -> CollectorConfig:
        path = path or Path(
            os.environ.get("LCU_SPECTATE_CONFIG", str(DEFAULT_CONFIG_PATH))
        )
        if not path.is_file():
            example = path.with_suffix(".example.json")
            raise FileNotFoundError(
                f"Config not found: {path}\n"
                f"Copy {example.name} to {path.name} and add your roster."
            )

        raw = json.loads(path.read_text(encoding="utf-8"))
        return cls.from_dict(raw)

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> CollectorConfig:
        roster: dict[str, RosterEntry] = {}
        for key, entry in (raw.get("roster") or {}).items():
            if not isinstance(entry, dict):
                continue
            roster[key.lower()] = RosterEntry(
                external_id=str(entry.get("externalId") or entry.get("external_id") or key),
                display_name=str(entry.get("displayName") or entry.get("display_name") or key),
                summoner_name=entry.get("summonerName") or entry.get("summoner_name"),
                team_role=entry.get("teamRole") or entry.get("team_role"),
                member_role=entry.get("memberRole") or entry.get("member_role"),
            )

        summoners = raw.get("teamSummoners") or raw.get("team_summoners") or []
        if not summoners and roster:
            summoners = [
                e.summoner_name or e.display_name
                for e in roster.values()
                if e.summoner_name or e.display_name
            ]

        return cls(
            hub_url=str(raw.get("hubUrl") or raw.get("hub_url") or "http://localhost:3000"),
            league=str(raw.get("league", "Scrim")),
            game_type=str(raw.get("gameType") or raw.get("game_type") or "SCRIM"),
            platform_id=str(raw.get("platformId") or raw.get("platform_id") or "EUW1"),
            opponent=raw.get("opponent"),
            team_summoners=[str(s) for s in summoners],
            roster=roster,
            export_dir=str(raw.get("exportDir") or raw.get("export_dir") or "data/exports"),
            push_on_complete=bool(raw.get("pushOnComplete", raw.get("push_on_complete", True))),
            poll_interval_sec=float(
                raw.get("pollIntervalSec") or raw.get("poll_interval_sec") or 2.0
            ),
            eog_poll_interval_sec=float(
                raw.get("eogPollIntervalSec") or raw.get("eog_poll_interval_sec") or 0.5
            ),
            post_game_timeout_sec=float(
                raw.get("postGameTimeoutSec") or raw.get("post_game_timeout_sec") or 120.0
            ),
            save_jsonl_backup=bool(
                raw.get("saveJsonlBackup", raw.get("save_jsonl_backup", True))
            ),
            capture_champ_select_draft=bool(
                raw.get(
                    "captureChampSelectDraft",
                    raw.get("capture_champ_select_draft", True),
                )
            ),
            ddragon_version=str(
                raw.get("ddragonVersion") or raw.get("ddragon_version") or "14.24.1"
            ),
            source=str(raw.get("source", "lcu-spectate")),
        )

    def roster_for_summoner(self, summoner_name: str) -> RosterEntry | None:
        key = summoner_name.strip().lower()
        if key in self.roster:
            return self.roster[key]
        # Match without tag
        base = key.split("#")[0]
        for k, entry in self.roster.items():
            if k.split("#")[0] == base:
                return entry
        return None

    def is_team_summoner(self, summoner_name: str) -> bool:
        norm = summoner_name.strip().lower()
        configured = {s.strip().lower() for s in self.team_summoners}
        if norm in configured:
            return True
        base = norm.split("#")[0]
        return any(s.split("#")[0] == base for s in configured)
