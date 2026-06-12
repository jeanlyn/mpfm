#!/usr/bin/env bash

if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
expected_tag=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --expect-tag)
      expected_tag="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

python3 - "$repo_root" "$expected_tag" <<'PY'
import json
import pathlib
import re
import sys

repo_root = pathlib.Path(sys.argv[1])
expected_tag = sys.argv[2]

cargo_toml = (repo_root / "Cargo.toml").read_text(encoding="utf-8")
match = re.search(r'^version = "([^"]+)"', cargo_toml, re.MULTILINE)
if not match:
    raise SystemExit("Failed to read version from Cargo.toml")

version = match.group(1)
versions = {
    "Cargo.toml": version,
    "package.json": json.loads((repo_root / "package.json").read_text(encoding="utf-8"))["version"],
    "ui/package.json": json.loads((repo_root / "ui/package.json").read_text(encoding="utf-8"))["version"],
    "tauri.conf.json": json.loads((repo_root / "tauri.conf.json").read_text(encoding="utf-8"))["version"],
    "tauri.win.conf.json": json.loads((repo_root / "tauri.win.conf.json").read_text(encoding="utf-8"))["version"],
}

mismatches = {path: value for path, value in versions.items() if value != version}
if mismatches:
    details = ", ".join(f"{path}={value}" for path, value in mismatches.items())
    raise SystemExit(f"Version mismatch detected: Cargo.toml={version}, {details}")

if expected_tag:
    normalized = expected_tag[1:] if expected_tag.startswith("v") else expected_tag
    if normalized != version:
        raise SystemExit(f"Tag/version mismatch: tag={expected_tag}, version={version}")

print(version)
PY
