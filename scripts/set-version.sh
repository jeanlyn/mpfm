#!/usr/bin/env bash

if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

if [ "${1:-}" = "--" ]; then
  shift
fi

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <version>" >&2
  exit 1
fi

version="${1#v}"

python3 - "$version" <<'PY'
import json
import pathlib
import re
import sys

version = sys.argv[1]
if not re.fullmatch(r"\d+\.\d+\.\d+(?:[-.][0-9A-Za-z.-]+)?", version):
    raise SystemExit(f"Invalid version: {version}")

repo_root = pathlib.Path.cwd()

cargo_path = repo_root / "Cargo.toml"
cargo_text = cargo_path.read_text(encoding="utf-8")
cargo_pattern = re.compile(r'(?ms)(^\[package\].*?^version = ")([^"]+)(")')

if not cargo_pattern.search(cargo_text):
    raise SystemExit("Failed to locate [package] version in Cargo.toml")

cargo_text = cargo_pattern.sub(lambda m: f'{m.group(1)}{version}{m.group(3)}', cargo_text, count=1)
cargo_path.write_text(cargo_text, encoding="utf-8")

json_files = [
    repo_root / "package.json",
    repo_root / "ui" / "package.json",
    repo_root / "tauri.conf.json",
    repo_root / "tauri.win.conf.json",
]

for path in json_files:
    data = json.loads(path.read_text(encoding="utf-8"))
    data["version"] = version
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

print(version)
PY
