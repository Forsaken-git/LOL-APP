"""League item slot helpers — keep in sync with src/lib/items.ts + build-normalize.ts."""

from __future__ import annotations

TRINKET_IDS = frozenset(
    {
        1104,
        3330,
        3340,
        3348,
        3349,
        3363,
        3364,
        3513,
        6702,
    }
)

LANE_QUEST_IDS = frozenset(
    {1205, 1206, 1207, 1208, 1209, 1210, 1211, 1220, 1221}
)

JUNGLE_PET_IDS = frozenset({1101, 1102, 1103, 1105, 1106, 1107})

SUPPORT_QUEST_IDS = frozenset(
    {3850, 3851, 3853, 3854, 3855, 3857, 3858}
)

BOOT_IDS = frozenset(
    {
        1001,
        2422,
        3005,
        3006,
        3008,
        3009,
        3010,
        3013,
        3020,
        3023,
        3024,
        3041,
        3047,
        3111,
        3112,
        3113,
        3114,
        3117,
        3151,
        3152,
        3158,
        3168,
        3170,
        3171,
        3172,
        3173,
        3174,
        3175,
        3176,
        3177,
        223005,
        223006,
        223008,
        223009,
        223020,
        223047,
        223111,
        223158,
    }
)

ADC_POSITIONS = frozenset({"BOTTOM", "ADC"})

LIVE_ITEM_OFFSET = 220000


def canonical_item_id(item_id: int) -> int:
  if 223000 <= item_id < 224000:
    classic = 3000 + (item_id - 223000)
    if classic in BOOT_IDS:
      return classic
  if LIVE_ITEM_OFFSET <= item_id < 230000:
    classic = item_id - LIVE_ITEM_OFFSET
    if 0 < classic < 100000:
      return classic
  return item_id


def is_boot_item(item_id: int) -> bool:
    if item_id in BOOT_IDS:
        return True
    if 223000 <= item_id < 224000:
        classic = 3000 + (item_id - 223000)
        return classic in BOOT_IDS
    return False


def is_trinket_item(item_id: int) -> bool:
    cid = canonical_item_id(item_id)
    return (item_id in TRINKET_IDS or cid in TRINKET_IDS) and not is_boot_item(item_id)


def is_lane_quest_item(item_id: int) -> bool:
    cid = canonical_item_id(item_id)
    return item_id in LANE_QUEST_IDS or cid in LANE_QUEST_IDS


def is_quest_item(item_id: int) -> bool:
    cid = canonical_item_id(item_id)
    return (
        item_id in LANE_QUEST_IDS
        or cid in LANE_QUEST_IDS
        or item_id in JUNGLE_PET_IDS
        or cid in JUNGLE_PET_IDS
        or item_id in SUPPORT_QUEST_IDS
        or cid in SUPPORT_QUEST_IDS
    )


def is_adc_position(position: str | None) -> bool:
    return (position or "").upper() in ADC_POSITIONS


def normalize_build_slots(
    item_ids: list[int],
    position: str | None,
) -> dict[str, list[int] | int]:
    """
    ADC: boots → questItemId, trinket → trinketItemId, up to 6 core itemIds.
  Other roles: first trinket pulled out; rest stay in itemIds (max 6).
    """
    if is_adc_position(position):
        quest_boots: int | None = None
        trinket: int | None = None
        core: list[int] = []
        for iid in item_ids:
            cid = canonical_item_id(iid)
            if is_boot_item(iid):
                quest_boots = cid
                continue
            if is_trinket_item(iid) and trinket is None:
                trinket = cid
                continue
            core.append(cid)
        out: dict[str, list[int] | int] = {"itemIds": core[:6]}
        if quest_boots is not None:
            out["questItemId"] = quest_boots
        if trinket is not None:
            out["trinketItemId"] = trinket
        return out

    quest: int | None = None
    trinket: int | None = None
    core: list[int] = []
    for iid in item_ids:
        cid = canonical_item_id(iid)
        if is_quest_item(iid) and quest is None:
            quest = cid
            continue
        if is_trinket_item(iid) and trinket is None:
            trinket = cid
            continue
        core.append(cid)
    out: dict[str, list[int] | int] = {"itemIds": core[:6]}
    if quest is not None:
        out["questItemId"] = quest
    if trinket is not None:
        out["trinketItemId"] = trinket
    return out
