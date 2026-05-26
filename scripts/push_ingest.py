#!/usr/bin/env python3
"""
Push collected team data to LoL Command hub.

Usage:
  python scripts/push_ingest.py data/export.json
  python scripts/push_ingest.py data/export.json --url http://localhost:3000

Environment:
  INGEST_API_KEY  — must match the app's .env (optional locally if unset)
  HUB_URL         — default http://localhost:3000
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request


def main() -> int:
    parser = argparse.ArgumentParser(description="Push JSON export to team hub")
    parser.add_argument("file", help="Path to ingest JSON file")
    parser.add_argument(
        "--url",
        default=os.environ.get("HUB_URL", "http://localhost:3000"),
        help="Hub base URL",
    )
    args = parser.parse_args()

    path = args.file
    if not os.path.isfile(path):
        print(f"File not found: {path}", file=sys.stderr)
        return 1

    with open(path, encoding="utf-8") as f:
        payload = json.load(f)

    url = args.url.rstrip("/") + "/api/ingest"
    api_key = os.environ.get("INGEST_API_KEY", "")

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={
            "Content-Type": "application/json",
            **({"x-api-key": api_key} if api_key else {}),
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            body = json.loads(resp.read().decode())
            print(json.dumps(body, indent=2))
            return 0 if body.get("success", True) else 2
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"HTTP {e.code}: {err}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
