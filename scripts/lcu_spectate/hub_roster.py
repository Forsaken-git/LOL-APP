"""Pull active roster from the Renim A. hub for LCU tracking."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .config import CollectorConfig, RosterEntry


def apply_hub_roster(config: CollectorConfig) -> bool:
    """Replace team_summoners + roster from GET /api/players/lcu-roster."""
    if not config.sync_roster_from_hub:
        return False

    url = config.hub_url.rstrip("/") + "/api/players/lcu-roster"
    api_key = os.environ.get("INGEST_API_KEY", "")
    try:
        req = urllib.request.Request(
            url,
            method="GET",
            headers={**({"x-api-key": api_key} if api_key else {})},
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"[roster] Hub returned HTTP {e.code} — using config file roster")
        return False
    except OSError as e:
        print(f"[roster] Could not reach hub ({e}) — using config file roster")
        return False

    summoners = data.get("teamSummoners") or data.get("team_summoners") or []
    roster_raw = data.get("roster") or {}

    if not summoners:
        print(
            "[roster] Hub has no players with summoner names — "
            "add players on the website first"
        )
        return False

    from .config import RosterEntry

    roster: dict[str, RosterEntry] = {}
    for key, entry in roster_raw.items():
        if not isinstance(entry, dict):
            continue
        roster[str(key).lower()] = RosterEntry(
            external_id=str(
                entry.get("externalId") or entry.get("external_id") or key
            ),
            display_name=str(
                entry.get("displayName") or entry.get("display_name") or key
            ),
            summoner_name=entry.get("summonerName") or entry.get("summoner_name"),
            team_role=entry.get("teamRole") or entry.get("team_role"),
            member_role=entry.get("memberRole") or entry.get("member_role"),
        )

    config.team_summoners = [str(s) for s in summoners]
    config.roster = roster
    print(
        f"[roster] Loaded {len(config.team_summoners)} summoner(s) from hub "
        f"({len(config.roster)} roster entries)"
    )
    return True
