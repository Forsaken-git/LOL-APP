#!/usr/bin/env python3
"""
Renim A. LCU spectate collector.

Usage:
  python -m scripts.lcu_spectate watch
  python -m scripts.lcu_spectate launch --game-id 123 --key TOKEN --platform EUW1
  python -m scripts.lcu_spectate status
  python -m scripts.lcu_spectate export-eog
  python -m scripts.lcu_spectate inspect-eog

Config: data/lcu-spectate.config.json (see .example file)
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .config import CollectorConfig, DEFAULT_CONFIG_PATH
from .lcu import LcuClient, read_lockfile
from .live_client import LiveClient
from .eog_extract import extract_participant
from .eog_validate import validate_extracted_match
from .champ_select import extract_pick_bans_from_session, format_draft_line
from .mapper import build_from_eog
from .hub import push_to_hub, save_export
from .watcher import SpectateWatcher


def cmd_watch(config: CollectorConfig) -> int:
    watcher = SpectateWatcher(config)
    try:
        watcher.run_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    return 0


def cmd_launch(args: argparse.Namespace) -> int:
    lcu = LcuClient()
    print(
        lcu.launch_spectate(
            game_id=int(args.game_id),
            encryption_key=args.key,
            platform_id=args.platform,
        )
    )
    print("Spectate launch requested — use `watch` in another terminal to capture stats.")
    return 0


def cmd_status(_: argparse.Namespace) -> int:
    try:
        lcu = LcuClient()
    except FileNotFoundError as e:
        print(e)
        return 1

    live = LiveClient()
    print("LCU connected:", lcu.conn.base_url)
    phase = lcu.gameflow_phase()
    print("Gameflow phase:", phase if phase else "(unavailable — is League Client open?)")
    spec = lcu.spectate_state()
    if spec is not None:
        print("Spectate state:", json.dumps(spec, indent=2)[:500])
    else:
        print("Spectate state: (not available)")
    print("Live client (2999):", "up" if live.is_available() else "down")
    if phase == "ChampSelect":
        session = lcu.champ_select_session()
        if session:
            try:
                cfg = CollectorConfig.load()
                rows = extract_pick_bans_from_session(
                    session, ddragon_version=cfg.ddragon_version
                )
            except FileNotFoundError:
                rows = extract_pick_bans_from_session(session, ddragon_version="14.24.1")
            print(f"Champ select: {len(rows)} completed actions")
            for row in rows:
                print(format_draft_line(row))
        else:
            print("Champ select: no session (not in draft?)")
    if live.is_available():
        data = live.all_game_data()
        if data:
            gd = data.get("gameData") or {}
            print("  gameId:", gd.get("gameId"))
            print("  players:", len(data.get("allPlayers") or []))
    return 0


def cmd_inspect_eog(_: argparse.Namespace) -> int:
    """Print EOG player field names and a sample extraction (debug)."""
    lcu = LcuClient()
    eog = lcu.eog_stats_block()
    if not eog:
        print(
            "No EOG stats block. Spectate a game through post-game, then retry.",
            file=sys.stderr,
        )
        return 1
    teams = eog.get("teams") or []
    print(f"gameId={eog.get('gameId')} gameLength={eog.get('gameLength')} teams={len(teams)}")
    for team in teams:
        if not isinstance(team, dict):
            continue
        tid = team.get("teamId")
        print(f"\nTeam {tid} isPlayerTeam={team.get('isPlayerTeam')} bans={team.get('championBans')}")
        for pl in (team.get("players") or [])[:1]:
            if not isinstance(pl, dict):
                continue
            print("  player keys:", ", ".join(sorted(pl.keys())))
            stats = pl.get("stats") or {}
            stat_keys = [k for k in stats if "VISION" in k or "GOLD" in k or "PERK" in k or "WARD" in k]
            print("  sample stat keys:", ", ".join(stat_keys[:20]))
            print("  items:", pl.get("items"))
            print("  spells:", pl.get("spell1Id"), pl.get("spell2Id"))
            champ = str(pl.get("championName") or "Unknown")
            sample = extract_participant(
                pl, side="BLUE", opponent=False, champion_name=champ
            )
            print("  extracted:", json.dumps(sample, indent=2)[:1200])

    try:
        cfg = CollectorConfig.load()
        payload = build_from_eog(eog, cfg)
        if payload and payload.get("matches"):
            match = payload["matches"][0]
            ok, issues = validate_extracted_match(match)
            print(f"\nValidation: {'OK' if ok else 'INCOMPLETE'} ({len(issues)} issues)")
            for line in issues[:15]:
                print(f"  - {line}")
            if len(issues) > 15:
                print(f"  … and {len(issues) - 15} more")
    except FileNotFoundError:
        print("\n(skip full validation — no data/lcu-spectate.config.json)")
    return 0


def cmd_export_eog(config: CollectorConfig, push: bool) -> int:
    watcher = SpectateWatcher(config)
    do_push = push or config.push_on_complete
    return 0 if watcher.capture_end_of_game_blocking(push=do_push) else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Renim A. LCU spectate collector")
    parser.add_argument(
        "--config",
        type=Path,
        default=None,
        help=f"Config path (default: {DEFAULT_CONFIG_PATH})",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("watch", help="Daemon: capture games while spectating")

    launch = sub.add_parser("launch", help="Start spectating via LCU")
    launch.add_argument("--game-id", required=True, type=int)
    launch.add_argument("--key", required=True, help="Spectator encryption key")
    launch.add_argument("--platform", default="EUW1", help="Platform id e.g. EUW1")

    sub.add_parser("status", help="Print LCU + live client status")

    export = sub.add_parser("export-eog", help="Export current EOG block once")
    export.add_argument("--push", action="store_true", help="Also POST to hub")

    sub.add_parser(
        "inspect-eog",
        help="Show EOG fields available (after a spectator game ends)",
    )

    args = parser.parse_args()

    config: CollectorConfig | None = None
    if args.command in ("watch", "export-eog"):
        try:
            config = CollectorConfig.load(args.config)
        except FileNotFoundError as e:
            print(e, file=sys.stderr)
            return 1

    if args.command == "watch":
        assert config is not None
        return cmd_watch(config)
    if args.command == "launch":
        return cmd_launch(args)
    if args.command == "status":
        return cmd_status(args)
    if args.command == "inspect-eog":
        return cmd_inspect_eog(args)
    if args.command == "export-eog":
        assert config is not None
        return cmd_export_eog(config, args.push)

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
