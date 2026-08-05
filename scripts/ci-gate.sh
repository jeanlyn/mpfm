#!/usr/bin/env bash

if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

if [[ "$#" -eq 0 ]]; then
  echo "[ci-gate] no required job results were provided" >&2
  exit 1
fi

failed=0
for entry in "$@"; do
  if [[ "$entry" != *=* ]]; then
    echo "[ci-gate] malformed job result: $entry" >&2
    failed=1
    continue
  fi

  job_name="${entry%%=*}"
  result="${entry#*=}"
  echo "[ci-gate] $job_name: $result"
  if [[ -z "$job_name" || "$result" != "success" ]]; then
    failed=1
  fi
done

if [[ "$failed" -ne 0 ]]; then
  echo "[ci-gate] one or more required jobs did not succeed" >&2
  exit 1
fi

echo "[ci-gate] OK"
