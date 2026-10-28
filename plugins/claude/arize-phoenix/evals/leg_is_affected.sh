#!/usr/bin/env bash
# Decide whether the plugin-evals CI leg for one skill needs to run, given the
# repo-relative paths a change touched (one per line on stdin). Prints "true"
# or "false". Run from the repo root.
#
#   git diff --name-only HEAD^1 HEAD | plugins/claude/arize-phoenix/evals/leg_is_affected.sh phoenix-evals
#
# A path is relevant to SKILL when it is:
#   - inside .agents/skills/SKILL/ or the plugin's skills/SKILL symlink
#   - inside an eval case whose prompt.md tags SKILL
#   - inside evals/SKILL/ (a skill's case group, e.g. its README)
#   - anything else in the plugin or the workflow (shared harness, mocks, manifest)
# Paths that belong to another skill are ignored.
set -euo pipefail

skill="${1:?usage: leg_is_affected.sh <skill> < changed-paths}"
plugin="plugins/claude/arize-phoenix"
evals="${plugin}/evals"

# The eval case directory (the one holding prompt.md) that contains a path, if any.
case_dir_of() {
  local dir
  dir="$(dirname "$1")"
  while [ "${dir}" != "${evals}" ] && [ "${dir}" != "." ]; do
    if [ -f "${dir}/prompt.md" ]; then
      echo "${dir}"
      return
    fi
    dir="$(dirname "${dir}")"
  done
}

while IFS= read -r path; do
  [ -z "${path}" ] && continue
  case "${path}" in
    .agents/skills/*)
      name="${path#.agents/skills/}"
      [ "${name%%/*}" = "${skill}" ] && { echo true; exit 0; }
      ;;
    "${plugin}/skills/"*)
      name="${path#"${plugin}"/skills/}"
      [ "${name%%/*}" = "${skill}" ] && { echo true; exit 0; }
      ;;
    "${evals}/"*)
      case_dir="$(case_dir_of "${path}")"
      if [ -n "${case_dir}" ]; then
        grep -qE "^tags:.*\b${skill}\b" "${case_dir}/prompt.md" && { echo true; exit 0; }
        continue
      fi
      # A skill's case group (evals/<skill>/...) outside any case, e.g. its README.
      group="${path#"${evals}"/}"
      group="${group%%/*}"
      if [ -d ".agents/skills/${group}" ]; then
        [ "${group}" = "${skill}" ] && { echo true; exit 0; }
        continue
      fi
      # Shared harness: mocks, the suite README, scripts. A deleted case also
      # lands here (no prompt.md left to read), which errs toward running.
      echo true
      exit 0
      ;;
    *)
      # The workflow file or other plugin files (manifest, .mcp.json, assets).
      echo true
      exit 0
      ;;
  esac
done

echo false
