#!/usr/bin/env bash

if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

tag=""
repo_url=""

usage() {
  cat <<'EOF' >&2
Usage: scripts/release-notes.sh --tag <release-tag> [--repo-url <url>]

Generate grouped Markdown release notes from Conventional Commit subjects
between the previous v* tag and the requested release tag.
EOF
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag)
      tag="${2:-}"
      shift 2
      ;;
    --repo-url)
      repo_url="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      ;;
  esac
done

if [ -z "$tag" ]; then
  usage
fi

if ! git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
  echo "Release tag '$tag' was not found." >&2
  exit 1
fi

previous_tag="$(
  git tag --merged "$tag" --sort=-v:refname 'v*' |
    grep -Fxv "$tag" |
    head -n 1 || true
)"

if [ -n "$previous_tag" ]; then
  range="$previous_tag..$tag"
  echo "## Changes since $previous_tag"
  if [ -n "$repo_url" ]; then
    echo
    echo "Compare: $repo_url/compare/$previous_tag...$tag"
  fi
else
  range="$tag"
  echo "## Changes in $tag"
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

commits_file="$tmp_dir/commits"
git log --no-merges --reverse --format='%h%x1f%s' "$range" > "$commits_file"

if [ ! -s "$commits_file" ]; then
  echo
  echo "No commits found for this release."
  exit 0
fi

sections=(
  "feat|Features"
  "fix|Fixes"
  "perf|Performance"
  "refactor|Refactoring"
  "docs|Documentation"
  "test|Tests"
  "build|Build"
  "ci|CI"
  "chore|Chores"
  "style|Styles"
  "revert|Reverts"
  "other|Other Changes"
)

for section in "${sections[@]}"; do
  key="${section%%|*}"
  title="${section#*|}"
  output_file="$tmp_dir/$key.md"
  : > "$output_file"
done

while IFS=$'\x1f' read -r short_sha subject; do
  type="other"
  scope=""
  breaking=""
  description="$subject"

  if [[ "$subject" =~ ^([A-Za-z]+)(\(([^\)]+)\))?(!)?:[[:space:]]+(.+)$ ]]; then
    type="${BASH_REMATCH[1],,}"
    scope="${BASH_REMATCH[3]:-}"
    breaking="${BASH_REMATCH[4]:-}"
    description="${BASH_REMATCH[5]}"
  fi

  output_file="$tmp_dir/other.md"
  for section in "${sections[@]}"; do
    key="${section%%|*}"
    if [ "$type" = "$key" ]; then
      output_file="$tmp_dir/$key.md"
      break
    fi
  done

  prefix=""
  if [ -n "$breaking" ]; then
    prefix="**BREAKING** "
  fi
  if [ -n "$scope" ]; then
    prefix="${prefix}${scope}: "
  fi

  printf -- '- %s%s (`%s`)\n' "$prefix" "$description" "$short_sha" >> "$output_file"
done < "$commits_file"

for section in "${sections[@]}"; do
  key="${section%%|*}"
  title="${section#*|}"
  output_file="$tmp_dir/$key.md"

  if [ -s "$output_file" ]; then
    echo
    echo "### $title"
    cat "$output_file"
  fi
done

cat <<'EOF'

## FAQ

### What should I do if macOS blocks the app during installation?

If macOS shows a Gatekeeper warning such as "cannot verify the developer" or "is damaged and cannot be opened":

1. Make sure the installer was downloaded from this repository's GitHub Release page.
2. Try opening it from System Settings > Privacy & Security by choosing Open Anyway.
3. If it still cannot be opened, move the app to Applications and run:

```bash
xattr -dr com.apple.quarantine /Applications/mpfm.app
```

Then open the app again.

### Will future release notes be updated automatically?

Yes. Future releases will generate grouped release notes from Conventional Commit messages between the current `v*` tag and the previous `v*` tag, then write them back to the GitHub Release.
EOF
