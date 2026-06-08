"""Poll LCU until the EOG stats block is complete."""

from __future__ import annotations

import time
from collections.abc import Callable
from typing import TYPE_CHECKING, Any

from .eog_validate import is_eog_complete

if TYPE_CHECKING:
    from .lcu import LcuClient


def poll_eog_block(
    lcu: LcuClient,
    *,
    poll_interval_sec: float = 0.5,
    timeout_sec: float = 120.0,
    on_wait: Callable[[str | None, list[str]], None] | None = None,
) -> tuple[dict[str, Any] | None, str | None]:
    """
    Poll `/lol-end-of-game/v1/eog-stats-block` until complete or timeout.

    Returns (eog_dict, last_gameflow_phase).
    """
    deadline = time.monotonic() + timeout_sec
    last_phase: str | None = None
    last_issues: list[str] = []
    attempts = 0

    while time.monotonic() < deadline:
        attempts += 1
        last_phase = lcu.gameflow_phase()
        eog = lcu.eog_stats_block()
        if eog:
            ok, issues = is_eog_complete(eog)
            if ok:
                return eog, last_phase
            last_issues = issues
        elif on_wait and attempts % 10 == 1:
            on_wait(last_phase, last_issues)
        time.sleep(poll_interval_sec)

    return None, last_phase
