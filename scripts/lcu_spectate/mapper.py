"""Map LCU / Live Client responses to Renim A. ingest JSON."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .champions import champion_name, load_champion_map
from .config import CollectorConfig, RosterEntry

TEAM_BLUE = 100
TEAM_RED = 200


def _stats_kda(stats: dict[str, Any]) -> tuple[int, int, int]:
    return (
        int(stats.get("CHAMPIONS_KILLED", 0) or 0),
        int(stats.get("NUM_DEATHS", 0) or 0),
        int(stats.get("ASSISTS", 0) or 0),
    )


def _pick_mvp(participants: list[dict[str, Any]]) -> str | None:
    best_id: str | None = None
    best_score = -1.0
    for p in participants:
        k = p.get("kills") or 0
        d = p.get("deaths") or 0
        a = p.get("assists") or 0
        score = k + a - d * 0.5
        if score > best_score:
            best_score = score
            best_id = p.get("playerExternalId") or p.get("displayName")
    return best_id


def build_from_eog(
    eog: dict[str, Any],
    config: CollectorConfig,
) -> dict[str, Any]:
    load_champion_map(config.ddragon_version)

    game_id = eog.get("gameId") or eog.get("reportGameId")
    platform = config.platform_id
    external_id = f"{platform}_{game_id}" if game_id else None

    teams = eog.get("teams") or []
    our_team_id: int | None = None
    enemy_names: list[str] = []

    for team in teams:
        if not isinstance(team, dict):
            continue
        players = team.get("players") or []
        team_ids_on_roster = 0
        for pl in players:
            if not isinstance(pl, dict):
                continue
            name = str(pl.get("summonerName") or "")
            if config.is_team_summoner(name):
                team_ids_on_roster += 1
        if team_ids_on_roster > 0:
            our_team_id = int(team.get("teamId") or 0) or None
        else:
            for pl in players:
                if isinstance(pl, dict) and pl.get("summonerName"):
                    enemy_names.append(str(pl["summonerName"]))

    if our_team_id is None and teams:
        # Spectator EOG may not flag isPlayerTeam — use first team with any roster hit
        for team in teams:
            if not isinstance(team, dict):
                continue
            for pl in team.get("players") or []:
                if isinstance(pl, dict) and config.is_team_summoner(
                    str(pl.get("summonerName") or "")
                ):
                    our_team_id = int(team.get("teamId") or TEAM_BLUE)
                    break

    our_team = next(
        (t for t in teams if isinstance(t, dict) and t.get("teamId") == our_team_id),
        None,
    )
    won = bool(our_team.get("isWinningTeam")) if our_team else False
    side = "BLUE" if our_team_id == TEAM_BLUE else "RED"

    participants: list[dict[str, Any]] = []
    players_out: list[dict[str, Any]] = []
    seen_roster: set[str] = set()

    if our_team:
        for pl in our_team.get("players") or []:
            if not isinstance(pl, dict):
                continue
            summoner = str(pl.get("summonerName") or "")
            if not config.is_team_summoner(summoner):
                continue
            cid = int(pl.get("championId") or 0)
            champ = champion_name(cid, config.ddragon_version)
            stats = pl.get("stats") or {}
            k, d, a = _stats_kda(stats)

            roster_entry = config.roster_for_summoner(summoner)
            part = _participant_dict(summoner, champ, k, d, a, roster_entry)
            participants.append(part)
            if roster_entry and roster_entry.external_id not in seen_roster:
                seen_roster.add(roster_entry.external_id)
                players_out.append(_player_dict(roster_entry, summoner))

    pick_bans = _pick_bans_from_teams(teams, config.ddragon_version)

    game_length = int(eog.get("gameLength") or 0)
    played_at = datetime.now(timezone.utc).isoformat()
    opponent = config.opponent or _default_opponent(enemy_names)

    match: dict[str, Any] = {
        "externalId": external_id,
        "playedAt": played_at,
        "league": config.league,
        "opponent": opponent,
        "result": "WIN" if won else "LOSS",
        "side": side,
        "gameType": config.game_type,
        "source": config.source,
        "notes": f"LCU spectate · {game_length}s",
        "participants": participants,
        "pickBans": pick_bans,
    }
    mvp = _pick_mvp(participants)
    if mvp:
        match["mvpExternalId"] = mvp

    return {
        "source": config.source,
        "players": players_out,
        "matches": [match],
        "events": [],
    }


def build_from_live_snapshot(
    live: dict[str, Any],
    config: CollectorConfig,
    *,
    result: str = "WIN",
) -> dict[str, Any] | None:
    """Fallback when EOG block is unavailable (incomplete data)."""
    game_data = live.get("gameData") or {}
    game_id = game_data.get("gameId")
    if not game_id:
        return None

    all_players = live.get("allPlayers") or []
    our_side: str | None = None
    participants: list[dict[str, Any]] = []
    players_out: list[dict[str, Any]] = []
    seen: set[str] = set()

    for pl in all_players:
        if not isinstance(pl, dict):
            continue
        summoner = str(pl.get("riotId") or pl.get("summonerName") or "")
        if not config.is_team_summoner(summoner):
            continue
        our_side = str(pl.get("team") or "ORDER")
        scores = pl.get("scores") or {}
        champ = str(pl.get("championName") or "Unknown")
        roster_entry = config.roster_for_summoner(summoner)
        participants.append(
            _participant_dict(
                summoner,
                champ,
                int(scores.get("kills", 0)),
                int(scores.get("deaths", 0)),
                int(scores.get("assists", 0)),
                roster_entry,
            )
        )
        if roster_entry and roster_entry.external_id not in seen:
            seen.add(roster_entry.external_id)
            players_out.append(_player_dict(roster_entry, summoner))

    if not participants:
        return None

    side = "BLUE" if our_side in ("ORDER", "100") else "RED"
    external_id = f"{config.platform_id}_{game_id}"

    return {
        "source": config.source,
        "players": players_out,
        "matches": [
            {
                "externalId": external_id,
                "playedAt": datetime.now(timezone.utc).isoformat(),
                "league": config.league,
                "opponent": config.opponent or "Unknown",
                "result": result,
                "side": side,
                "gameType": config.game_type,
                "source": config.source,
                "notes": "LCU spectate (live snapshot — verify result)",
                "participants": participants,
            }
        ],
        "events": [],
    }


def _participant_dict(
    summoner: str,
    champion: str,
    kills: int,
    deaths: int,
    assists: int,
    roster: RosterEntry | None,
) -> dict[str, Any]:
    part: dict[str, Any] = {
        "champion": champion,
        "kills": kills,
        "deaths": deaths,
        "assists": assists,
    }
    if roster:
        part["playerExternalId"] = roster.external_id
    else:
        part["summonerName"] = summoner
        part["displayName"] = summoner.split("#")[0]
    return part


def _player_dict(roster: RosterEntry, summoner: str) -> dict[str, Any]:
    p: dict[str, Any] = {
        "externalId": roster.external_id,
        "displayName": roster.display_name,
    }
    if roster.summoner_name or summoner:
        p["summonerName"] = roster.summoner_name or summoner
    if roster.team_role:
        p["teamRole"] = roster.team_role
    return p


def _pick_bans_from_teams(
    teams: list[Any],
    ddragon_version: str,
) -> list[dict[str, Any]]:
    pick_bans: list[dict[str, Any]] = []
    order = 0
    for team in teams:
        if not isinstance(team, dict):
            continue
        team_id = int(team.get("teamId") or 0)
        side = "BLUE" if team_id == TEAM_BLUE else "RED"
        for ban_id in team.get("championBans") or []:
            pick_bans.append(
                {
                    "champion": champion_name(int(ban_id), ddragon_version),
                    "type": "BAN",
                    "side": side,
                    "order": order,
                }
            )
            order += 1
        for pl in team.get("players") or []:
            if not isinstance(pl, dict):
                continue
            cid = pl.get("championId")
            if cid is None:
                continue
            pick_bans.append(
                {
                    "champion": champion_name(int(cid), ddragon_version),
                    "type": "PICK",
                    "side": side,
                    "order": order,
                }
            )
            order += 1
    return pick_bans


def _default_opponent(enemy_names: list[str]) -> str:
    if not enemy_names:
        return "Scrim opponent"
    labels = sorted({n.split("#")[0] for n in enemy_names[:5]})
    return " / ".join(labels) if len(labels) <= 3 else f"Scrim ({len(enemy_names)} players)"
