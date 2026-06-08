"""Extract full participant stats from LCU end-of-game player objects."""

from __future__ import annotations

from typing import Any

from .item_slots import normalize_build_slots

# LCU stats keys ITEM0..ITEM7 (inventory + dedicated ADC boot slot + trinket).
ITEM_SLOT_COUNT = 8


def riot_id(player: dict[str, Any]) -> str:
    game = str(player.get("riotIdGameName") or "").strip()
    if not game:
        return str(player.get("summonerName") or "").strip()
    tag = str(player.get("riotIdTagLine") or "").strip()
    return f"{game}#{tag}" if tag else game


def display_name(player: dict[str, Any]) -> str:
    game = str(player.get("riotIdGameName") or "").strip()
    if game:
        return game
    summoner = str(player.get("summonerName") or "").strip()
    return summoner.split("#")[0] if summoner else "Unknown"


def position_to_role(pos: str | None) -> str:
    p = (pos or "").upper()
    return {
        "TOP": "TOP",
        "JUNGLE": "JUNGLE",
        "MIDDLE": "MID",
        "MID": "MID",
        "BOTTOM": "ADC",
        "ADC": "ADC",
        "UTILITY": "SUPPORT",
        "SUPPORT": "SUPPORT",
    }.get(p, "FILL")


def _append_item(item_ids: list[int], seen: set[int], item_id: int) -> None:
    if item_id > 0 and item_id not in seen:
        seen.add(item_id)
        item_ids.append(item_id)


def collect_item_ids(player: dict[str, Any]) -> list[int]:
    """
    Build ordered item id list from EOG player payload.

    Prefer stats.ITEM0..ITEM7 so dedicated ADC boot / trinket slots are not dropped
    when the top-level `items` array only lists six inventory items.
    """
    stats = player.get("stats") or {}
    item_ids: list[int] = []
    seen: set[int] = set()

    for slot in range(ITEM_SLOT_COUNT):
        v = stats.get(f"ITEM{slot}")
        if isinstance(v, (int, float)):
            _append_item(item_ids, seen, int(v))

    for raw in player.get("items") or []:
        try:
            iid = int(raw)
        except (TypeError, ValueError):
            continue
        _append_item(item_ids, seen, iid)

    # Season role quest (ADC boots, jungle pet, etc.) — not always in `items` / ITEM0..7.
    rbi = stats.get("ROLE_BOUND_ITEM")
    if isinstance(rbi, (int, float)):
        _append_item(item_ids, seen, int(rbi))

    return item_ids


def extract_build(player: dict[str, Any]) -> dict[str, Any] | None:
    item_ids = collect_item_ids(player)

    slots: list[int] = []
    stats = player.get("stats") or {}
    for i in range(6):
        perk = stats.get(f"PERK{i}")
        if isinstance(perk, (int, float)) and int(perk) > 0:
            slots.append(int(perk))
    primary = stats.get("PERK_PRIMARY_STYLE")
    sub = stats.get("PERK_SUB_STYLE")
    spell1 = player.get("spell1Id")
    spell2 = player.get("spell2Id")

    has_perks = bool(slots) or (isinstance(primary, (int, float)) and int(primary) > 0)
    has_spells = (isinstance(spell1, int) and spell1 > 0) or (
        isinstance(spell2, int) and spell2 > 0
    )
    if not item_ids and not has_perks and not has_spells:
        return None

    position = player.get("detectedTeamPosition")
    partitioned = normalize_build_slots(item_ids, str(position) if position else None)

    build: dict[str, Any] = {
        "itemIds": partitioned.get("itemIds", []),
    }
    if partitioned.get("questItemId") is not None:
        build["questItemId"] = partitioned["questItemId"]
    if partitioned.get("trinketItemId") is not None:
        build["trinketItemId"] = partitioned["trinketItemId"]

    if isinstance(spell1, int) and spell1 > 0:
        build["spell1Id"] = spell1
    if isinstance(spell2, int) and spell2 > 0:
        build["spell2Id"] = spell2
    if has_perks:
        perks: dict[str, Any] = {"slots": slots}
        if isinstance(primary, (int, float)) and int(primary) > 0:
            perks["primaryStyle"] = int(primary)
        if isinstance(sub, (int, float)) and int(sub) > 0:
            perks["subStyle"] = int(sub)
        build["perks"] = perks
    return build


def extract_participant(
    player: dict[str, Any],
    *,
    side: str,
    opponent: bool,
    champion_name: str,
) -> dict[str, Any]:
    stats = player.get("stats") or {}
    cs = int(stats.get("MINIONS_KILLED", 0) or 0) + int(
        stats.get("NEUTRAL_MINIONS_KILLED", 0) or 0
    )
    part: dict[str, Any] = {
        "displayName": display_name(player),
        "summonerName": riot_id(player) or None,
        "champion": champion_name,
        "side": side,
        "opponent": opponent,
        "teamRole": position_to_role(player.get("detectedTeamPosition")),
        "position": player.get("detectedTeamPosition"),
        "kills": int(stats.get("CHAMPIONS_KILLED", 0) or 0),
        "deaths": int(stats.get("NUM_DEATHS", 0) or 0),
        "assists": int(stats.get("ASSISTS", 0) or 0),
        "cs": cs,
        "damage": int(stats.get("TOTAL_DAMAGE_DEALT_TO_CHAMPIONS", 0) or 0),
    }
    gold = stats.get("GOLD_EARNED")
    vision = stats.get("VISION_SCORE")
    if isinstance(gold, (int, float)):
        part["goldEarned"] = int(gold)
    if isinstance(vision, (int, float)):
        part["visionScore"] = int(vision)
    build = extract_build(player)
    if build:
        part["build"] = build
    return part
