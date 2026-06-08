"""Champion select draft capture — standard 20-turn competitive order."""

from __future__ import annotations

from typing import Any

from .champions import champion_name

# Same 20-turn order as src/lib/draft.ts DRAFT_TURNS (6 bans + 10 picks in draft phases).
EXPECTED_DRAFT_TURNS = 20

BLUE_CELL_IDS = frozenset(range(0, 5))
RED_CELL_IDS = frozenset(range(5, 10))


def cell_id_to_side(cell_id: int) -> str:
    return "BLUE" if cell_id in BLUE_CELL_IDS else "RED"


def extract_pick_bans_from_session(
    session: dict[str, Any],
    *,
    ddragon_version: str,
) -> list[dict[str, Any]]:
    """
    Flatten LCU champ-select `actions` in turn order.

    Each completed ban/pick becomes one row: champion, type, side, order (0..19).
    """
    actions = session.get("actions")
    if not isinstance(actions, list):
        return []

    pick_bans: list[dict[str, Any]] = []
    order = 0

    for turn in actions:
        if not isinstance(turn, list):
            continue
        for action in turn:
            if not isinstance(action, dict):
                continue
            if not action.get("completed"):
                continue
            champion_id = int(action.get("championId") or 0)
            if champion_id <= 0:
                continue
            raw_type = str(action.get("type") or "").lower()
            if raw_type not in ("ban", "pick"):
                continue
            cell_id = int(action.get("actorCellId") or 0)
            pick_bans.append(
                {
                    "champion": champion_name(champion_id, ddragon_version),
                    "type": raw_type.upper(),
                    "side": cell_id_to_side(cell_id),
                    "order": order,
                }
            )
            order += 1

    return pick_bans


def merge_incremental_draft(
    existing: list[dict[str, Any]],
    seen_ids: set[int],
    session: dict[str, Any],
    *,
    ddragon_version: str,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Append newly completed actions (by LCU action id).

    Returns (updated_list, new_rows_this_poll).
    """
    actions = session.get("actions")
    if not isinstance(actions, list):
        return existing, []

    updated = list(existing)
    new_rows: list[dict[str, Any]] = []
    order = len(updated)

    for turn in actions:
        if not isinstance(turn, list):
            continue
        for action in turn:
            if not isinstance(action, dict):
                continue
            action_id = action.get("id")
            if not isinstance(action_id, int) or action_id in seen_ids:
                continue
            if not action.get("completed"):
                continue
            champion_id = int(action.get("championId") or 0)
            if champion_id <= 0:
                continue
            raw_type = str(action.get("type") or "").lower()
            if raw_type not in ("ban", "pick"):
                continue

            seen_ids.add(action_id)
            cell_id = int(action.get("actorCellId") or 0)
            row = {
                "champion": champion_name(champion_id, ddragon_version),
                "type": raw_type.upper(),
                "side": cell_id_to_side(cell_id),
                "order": order,
            }
            updated.append(row)
            new_rows.append(row)
            order += 1

    return updated, new_rows


def is_standard_draft_complete(pick_bans: list[dict[str, Any]]) -> bool:
    return len(pick_bans) >= EXPECTED_DRAFT_TURNS


def format_draft_line(row: dict[str, Any]) -> str:
    slot = row.get("order", "?")
    return f"  {int(slot) + 1:2d}. {row['side']:4s} {row['type']:4s} {row['champion']}"
