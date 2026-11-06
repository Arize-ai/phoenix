#!/usr/bin/env bash
set -o pipefail

cd "$(git rev-parse --show-toplevel)" || exit 2

# Files changed relative to HEAD, plus new untracked files. The diff filter
# includes regular edits and excludes deletions, because these checks need
# paths that still exist on disk. We use git instead of hook tool input because
# Codex apply_patch provides the patch text in tool_input.command, not a single
# file_path like Claude Write/Edit hooks.
files="$(
  {
  git diff --name-only --diff-filter=ACMRTUXB HEAD --
  git ls-files --others --exclude-standard
  } | sort -u
)"

status=0
hook_state_dir="$(git rev-parse --git-path codex-hooks)"
mkdir -p "$hook_state_dir"

run() {
  "$@" || status=2
}

# macOS ships Bash 3, which does not support mapfile.
collect_matches() {
  local pattern="$1"
  local output="$2"

  eval "$output=()"
  while IFS= read -r file; do
    eval "$output+=(\"\$file\")"
  done < <(grep -E "$pattern" <<<"$files" || true)
}

hash_files() {
  printf '%s\n' "$@" | sort -u | while IFS= read -r file; do
    [ -f "$file" ] && shasum -a 256 "$file"
  done | shasum -a 256 | awk '{print $1}'
}

# Run `command...` once per `files...` content hash, storing state under `key`.
# Usage: run_once_for_hash key files... -- command...
run_once_for_hash() {
  local key="$1"
  shift

  local -a watched_files=()
  while (($#)); do
    if [[ "$1" == "--" ]]; then
      shift
      break
    fi
    watched_files+=("$1")
    shift
  done

  local current_hash
  current_hash="$(hash_files "${watched_files[@]}")"

  local hash_file="$hook_state_dir/$key.sha"
  local previous_hash
  previous_hash="$(cat "$hash_file" 2>/dev/null || true)"

  [ "$current_hash" != "$previous_hash" ] || return 0

  if "$@"; then
    printf '%s\n' "$current_hash" >"$hash_file"
  else
    status=2
  fi
}

collect_matches '\.py$' py_files
collect_matches 'src/phoenix/db/migrations/versions' migration_files
collect_matches '(^|/)(pyproject\.toml|uv\.lock)$' python_dep_files
collect_matches 'schemas/openapi\.json$' openapi_files

if ((${#py_files[@]})); then
  run uv tool run ruff format "${py_files[@]}"
  run uv tool run ruff check --fix --unfixable=F401 "${py_files[@]}"
fi

if ((${#migration_files[@]})); then
  run_once_for_hash schema-ddl "${migration_files[@]}" -- \
    sh -c 'make schema-ddl >&2'
fi

if ((${#python_dep_files[@]})); then
  run_once_for_hash python-deps "${python_dep_files[@]}" -- \
    sh -c 'uv sync >&2'
fi

if ((${#openapi_files[@]})); then
  run_once_for_hash openapi "${openapi_files[@]}" -- \
    sh -c 'cd js && { pnpm i && pnpm build; } >&2'
fi

exit "$status"
