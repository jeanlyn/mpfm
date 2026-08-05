#!/usr/bin/env bash

if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
gate_script="$repo_root/scripts/ci-gate.sh"
ci_workflow="$repo_root/.github/workflows/ci.yml"

assert_succeeds() {
  if ! "$@"; then
    echo "Expected command to succeed: $*" >&2
    exit 1
  fi
}

assert_fails() {
  if "$@"; then
    echo "Expected command to fail: $*" >&2
    exit 1
  fi
}

assert_succeeds bash "$gate_script" \
  "Basic Checks=success" \
  "Full Tests=success" \
  "Windows Release Script Tests=success"

assert_fails bash "$gate_script" \
  "Basic Checks=failure" \
  "Full Tests=success" \
  "Windows Release Script Tests=success"
assert_fails bash "$gate_script" \
  "Basic Checks=success" \
  "Full Tests=skipped" \
  "Windows Release Script Tests=success"
assert_fails bash "$gate_script" \
  "Basic Checks=success" \
  "Full Tests=success" \
  "Windows Release Script Tests=cancelled"
assert_fails bash "$gate_script"

ruby - "$ci_workflow" <<'RUBY'
require "yaml"

workflow = YAML.load_file(ARGV.fetch(0))
events = workflow["on"] || workflow[true]
abort "CI workflow must define pull_request" unless events.is_a?(Hash) && events.key?("pull_request")

pull_request = events.fetch("pull_request")
abort "pull_request must target master and develop" unless pull_request.fetch("branches") == ["master", "develop"]
abort "pull_request must always emit the required check" if pull_request.key?("paths-ignore")

concurrency = workflow.fetch("concurrency")
expected_group = '${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}'
abort "CI concurrency group must be stable per pull request or branch" unless concurrency["group"] == expected_group
abort "Obsolete CI runs must be cancelled" unless concurrency["cancel-in-progress"] == true

gate = workflow.fetch("jobs").fetch("ci-gate")
abort "Aggregate job must have the stable name CI Gate" unless gate["name"] == "CI Gate"
expected_needs = ["basic-checks", "full-tests", "windows-release-script-tests"]
abort "CI Gate dependencies are incomplete" unless gate["needs"] == expected_needs
condition = gate.fetch("if")
abort "CI Gate must evaluate dependency results even after failures" unless condition.include?("always()")
abort "CI Gate must run for pull requests" unless condition.include?("github.event_name == 'pull_request'")

gate_step = gate.fetch("steps").find { |step| step["name"] == "Require successful CI jobs" }
abort "CI Gate execution step is missing" unless gate_step
command = gate_step.fetch("run")
[
  'Basic Checks=${{ needs.basic-checks.result }}',
  'Full Tests=${{ needs.full-tests.result }}',
  'Windows Release Script Tests=${{ needs.windows-release-script-tests.result }}'
].each do |argument|
  abort "CI Gate does not pass #{argument}" unless command.include?(argument)
end
RUBY

echo "[test-ci-workflow] OK"
