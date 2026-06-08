"""Map LCU / Live Client responses to Renim A. ingest JSON."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .champions import champion_name, load_champion_map
from .config import CollectorConfig, RosterEntry
from .eog_extract import extract_participant, riot_id

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
        if p.get("opponent"):
            continue
        k = p.get("kills") or 0
        d = p.get("deaths") or 0
        a = p.get("assists") or 0
        score = k + a - d * 0.5
        if score > best_score:
            best_score = score
            best_id = p.get("playerExternalId") or p.get("displayName")
    return best_id


def _find_our_team(teams: list[Any], config: CollectorConfig) -> dict[str, Any] | None:
    for team in teams:
        if not isinstance(team, dict):
            continue
        hits = 0
        for pl in team.get("players") or []:
            if not isinstance(pl, dict):
                continue
            name = riot_id(pl) or str(pl.get("summonerName") or "")
            if config.is_team_summoner(name):
                hits += 1
        if hits > 0:
            return team
    return None


def build_from_eog(
    eog: dict[str, Any],
    config: CollectorConfig,
    *,
    pick_bans_override: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    load_champion_map(config.ddragon_version)

    game_id = eog.get("gameId") or eog.get("reportGameId")
    platform = config.platform_id
    external_id = f"{platform}_{game_id}" if game_id else None

    teams = [t for t in (eog.get("teams") or []) if isinstance(t, dict)]
    our_team = _find_our_team(teams, config)
    if our_team is None and teams:
        our_team = teams[0]

    enemy_team = None
    if our_team:
        our_id = int(our_team.get("teamId") or TEAM_BLUE)
        enemy_team = next(
            (t for t in teams if int(t.get("teamId") or 0) != our_id),
            None,
        )

    our_team_id = int(our_team.get("teamId") or TEAM_BLUE) if our_team else TEAM_BLUE
    won = bool(our_team.get("isWinningTeam")) if our_team else False
    our_side = "BLUE" if our_team_id == TEAM_BLUE else "RED"
    enemy_side = "RED" if our_side == "BLUE" else "BLUE"

    participants: list[dict[str, Any]] = []
    players_out: list[dict[str, Any]] = []
    seen_roster: set[str] = set()
    enemy_names: list[str] = []

    def add_team_players(team: dict[str, Any] | None, side: str, opponent: bool) -> None:
        if not team:
            return
        for pl in team.get("players") or []:
            if not isinstance(pl, dict):
                continue
            summoner = riot_id(pl) or str(pl.get("summonerName") or "")
            if opponent:
                if summoner:
                    enemy_names.append(summoner)

            cid = int(pl.get("championId") or 0)
            champ = champion_name(cid, config.ddragon_version)
            if pl.get("championName"):
                champ = str(pl["championName"])

            part = extract_participant(
                pl, side=side, opponent=opponent, champion_name=champ
            )
            roster_entry = None if opponent else config.roster_for_summoner(summoner)
            if roster_entry:
                part["playerExternalId"] = roster_entry.external_id
                role = (roster_entry.team_role or "").upper()
                if role and role != "FILL":
                    part["teamRole"] = roster_entry.team_role
                if roster_entry.external_id not in seen_roster:
                    seen_roster.add(roster_entry.external_id)
                    players_out.append(_player_dict(roster_entry, summoner))
            participants.append(part)

    add_team_players(our_team, our_side, False)
    add_team_players(enemy_team, enemy_side, True)

    if pick_bans_override:
        pick_bans = pick_bans_override
    else:
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
        "side": our_side,
        "gameType": config.game_type,
        "gameDurationSec": game_length or None,
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
        part = _participant_dict(
            summoner,
            champ,
            int(scores.get("kills", 0)),
            int(scores.get("deaths", 0)),
            int(scores.get("assists", 0)),
            roster_entry,
        )
        cs = scores.get("creepScore")
        if isinstance(cs, (int, float)):
            part["cs"] = int(cs)
        items = []
        for item in pl.get("items") or []:
            if isinstance(item, dict):
                iid = item.get("itemID") or item.get("itemId")
                if isinstance(iid, int) and iid > 0:
                    items.append(iid)
        spells = pl.get("summonerSpells") or {}
        s1 = spells.get("summonerSpellOne") or {}
        s2 = spells.get("summonerSpellTwo") or {}
        build: dict[str, Any] = {}
        if items:
            build["itemIds"] = items
        if isinstance(s1.get("rawDisplayName"), str):
            pass
        if s1.get("rawDescription"):
            pass
        spell_ids: list[int] = []
        for key in ("summonerSpellOne", "summonerSpellTwo"):
            sp = spells.get(key) or {}
            sid = sp.get("id") or sp.get("spellId")
            if isinstance(sid, int) and sid > 0:
                spell_ids.append(sid)
        if len(spell_ids) >= 1:
            build["spell1Id"] = spell_ids[0]
        if len(spell_ids) >= 2:
            build["spell2Id"] = spell_ids[1]
        if build:
            part["build"] = build
        participants.append(part)
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
                "notes": "LCU spectate (live snapshot — verify W/L)",
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
    if roster.member_role:
        p["memberRole"] = roster.member_role
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
