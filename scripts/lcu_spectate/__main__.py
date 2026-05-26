#!/usr/bin/env python3
"""
Renim A. LCU spectate collector.

Usage:
  python -m scripts.lcu_spectate watch
  python -m scripts.lcu_spectate launch --game-id 123 --key TOKEN --platform EUW1
  python -m scripts.lcu_spectate status
  python -m scripts.lcu_spectate export-eog

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
    if live.is_available():
        data = live.all_game_data()
        if data:
            gd = data.get("gameData") or {}
            print("  gameId:", gd.get("gameId"))
            print("  players:", len(data.get("allPlayers") or []))
    return 0


def cmd_export_eog(config: CollectorConfig, push: bool) -> int:
    lcu = LcuClient()
    eog = lcu.eog_stats_block()
    if not eog:
        print("No EOG stats block available. Finish a game in spectator first.", file=sys.stderr)
        return 1
    payload = build_from_eog(eog, config)
    path = save_export(payload, config.export_dir, eog.get("gameId"))
    print(f"Wrote {path}")
    if push:
        print(push_to_hub(payload, config.hub_url))
    return 0


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
    if args.command == "export-eog":
        assert config is not None
        return cmd_export_eog(config, args.push)

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
