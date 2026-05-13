#!/usr/bin/env bash
# Bash-callable wrapper to get one annotation opinion from Codex (OpenAI side).
#
# Reads a prompt on stdin, writes the model's final message to stdout. Runs
# Codex non-interactively in read-only sandbox mode so the annotator can read
# the repo (toolset specs, evaluator source, existing datasets) but cannot
# modify anything.
#
# The pxi-eval-dataset skill fans out ground-truth annotation across three
# independent opinions: Sonnet + Opus (via the Claude Code Agent tool) and
# one OpenAI-side opinion (this script). The cross-provider opinion gets the
# same environment access as a Claude subagent — i.e. it is not a single
# chat-completion shot. This keeps the three opinions symmetric.
#
# Usage:
#   cat prompt.txt | ./tests/pxi/evals/annotate_via_codex.sh [--model MODEL]
#
# Options:
#   --model MODEL   Override the Codex default model (e.g. o3, gpt-5.5).
#                   If not given, uses whatever ~/.codex/config.toml prescribes.
#
# Exit codes:
#   0  success; the model's final message is on stdout
#   1  usage error or codex failure
#
# Requires: codex CLI (`codex --version` should print codex-cli) and an
# active ChatGPT login (`codex login status`).

set -euo pipefail

MODEL_FLAG=()
while [[ $# -gt 0 ]]; do
    case "$1" in
        --model)
            if [[ -z "${2:-}" ]]; then
                echo "ERROR: --model requires a value" >&2
                exit 1
            fi
            MODEL_FLAG=(--model "$2")
            shift 2
            ;;
        -h|--help)
            sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *)
            echo "ERROR: unknown argument: $1" >&2
            exit 1
            ;;
    esac
done

if ! command -v codex >/dev/null 2>&1; then
    echo "ERROR: codex CLI not found on PATH; install or fix PATH" >&2
    exit 1
fi

# Reject empty stdin early — codex exec with no prompt is a no-op and the
# failure mode is opaque.
PROMPT_FILE=$(mktemp -t codex_annotate.XXXXXX)
trap 'rm -f "$PROMPT_FILE" "$OUTPUT_FILE"' EXIT
cat > "$PROMPT_FILE"
if [[ ! -s "$PROMPT_FILE" ]]; then
    echo "ERROR: empty prompt on stdin" >&2
    exit 1
fi

OUTPUT_FILE=$(mktemp -t codex_output.XXXXXX)

# --sandbox read-only: annotator may read files but cannot write or run
#   commands that mutate the workspace.
# --ephemeral: don't persist session files; each invocation is independent.
# --skip-git-repo-check: harness may be invoked from non-git working dirs.
# --color never: keep tool output free of ANSI escapes.
# --output-last-message: write only the model's final message to a file,
#   isolating it from progress chatter on stderr.
# -C "$(pwd)": run with the current working directory as the workspace root.
codex exec \
    --sandbox read-only \
    --ephemeral \
    --skip-git-repo-check \
    --color never \
    --output-last-message "$OUTPUT_FILE" \
    -C "$(pwd)" \
    "${MODEL_FLAG[@]}" \
    - < "$PROMPT_FILE" >&2

if [[ ! -s "$OUTPUT_FILE" ]]; then
    echo "ERROR: codex returned no final message" >&2
    exit 1
fi

cat "$OUTPUT_FILE"
