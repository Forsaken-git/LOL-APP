"""Check whether LCU EOG / extracted ingest payloads are complete enough."""

from __future__ import annotations

from typing import Any


def is_eog_complete(eog: dict[str, Any]) -> tuple[bool, list[str]]:
    issues: list[str] = []

    game_id = eog.get("gameId") or eog.get("reportGameId")
    if not game_id:
        issues.append("missing gameId")

    teams = [t for t in (eog.get("teams") or []) if isinstance(t, dict)]
    if len(teams) < 2:
        issues.append("need two teams")

    player_count = 0
    with_stats = 0
    for team in teams:
        players = [p for p in (team.get("players") or []) if isinstance(p, dict)]
        player_count += len(players)
        for pl in players:
            stats = pl.get("stats") or {}
            if any(
                stats.get(k) is not None
                for k in ("CHAMPIONS_KILLED", "NUM_DEATHS", "ASSISTS", "GOLD_EARNED")
            ):
                with_stats += 1

    if player_count < 10:
        issues.append(f"only {player_count}/10 players")
    if with_stats < 8:
        issues.append(f"only {with_stats} players with stats")

    if not eog.get("gameLength"):
        issues.append("missing gameLength")

    return len(issues) == 0, issues


def _label(part: dict[str, Any], index: int) -> str:
    name = str(part.get("displayName") or part.get("summonerName") or "").strip()
    return name or f"player#{index}"


def validate_extracted_participant(
    part: dict[str, Any],
    *,
    index: int = 0,
) -> list[str]:
    issues: list[str] = []
    who = _label(part, index)

    if not str(part.get("displayName") or part.get("summonerName") or "").strip():
        issues.append(f"{who}: missing player name")
    champ = str(part.get("champion") or "").strip()
    if not champ or champ == "Unknown":
        issues.append(f"{who}: missing champion name")

    for key in ("kills", "deaths", "assists", "cs", "damage"):
        if part.get(key) is None:
            issues.append(f"{who}: missing {key}")
    if part.get("goldEarned") is None:
        issues.append(f"{who}: missing goldEarned")

    build = part.get("build")
    if not isinstance(build, dict):
        issues.append(f"{who}: missing build")
        return issues

    if not build.get("spell1Id") and not build.get("spell2Id"):
        issues.append(f"{who}: missing summoner spells")
    perks = build.get("perks") or {}
    if not (perks.get("slots") if isinstance(perks, dict) else None):
        issues.append(f"{who}: missing runes")
    if build.get("trinketItemId") is None:
        issues.append(f"{who}: missing trinket")

    role = str(part.get("position") or part.get("teamRole") or "").upper()
    if role in ("BOTTOM", "ADC") and build.get("questItemId") is None:
        issues.append(f"{who}: ADC missing quest boots")
    if role in ("JUNGLE", "JG") and build.get("questItemId") is None:
        issues.append(f"{who}: jungle missing quest pet")
    if not build.get("itemIds") and build.get("questItemId") is None:
        issues.append(f"{who}: no core items")

    return issues


def validate_extracted_match(match: dict[str, Any]) -> tuple[bool, list[str]]:
    issues: list[str] = []

    if not match.get("gameDurationSec"):
        issues.append("match: missing gameDurationSec")

    parts = [p for p in (match.get("participants") or []) if isinstance(p, dict)]
    if len(parts) < 10:
        issues.append(f"match: only {len(parts)}/10 participants")

    for i, part in enumerate(parts):
        issues.extend(validate_extracted_participant(part, index=i))

    return len(issues) == 0, issues
