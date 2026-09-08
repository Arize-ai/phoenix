# Harbor plugin integration tests

These tests run real Harbor jobs against Phoenix. They require Docker, download Terminal-Bench
tasks, and make paid model API calls, so they run manually rather than in the normal test suite or CI.

Start Phoenix with `make dev-backend`, or use an existing server. From another terminal at the
repository root, run the compaction case with `OPENAI_API_KEY` available to the command:

```bash
HARBOR_E2E_ENDPOINT=http://localhost:6006 \
HARBOR_E2E_ATIF_CASES=compaction \
HARBOR_E2E_KEEP=1 \
make harbor-plugin-e2e
```

Select only the cases needed for the change with the comma-separated `HARBOR_E2E_ATIF_CASES`
variable. If omitted, it runs `terminus,compaction,multi-step`.

| Case | Agent | What it checks |
| --- | --- | --- |
| `terminus` | Terminus-2 on `HARBOR_ATIF_MODEL` | Three Terminal-Bench trials in one experiment, run linkage, measured LLM timing, equal-time ordering, and idempotent resume |
| `compaction` | Terminus-2 with forced summarization | The compaction span, continuation trajectory, three summarizer subagent trajectories, and idempotent resume |
| `multi-step` | Claude Code on `HARBOR_ATIF_CLAUDE_MODEL` | The synthetic three-step `fixtures/tasks/word-count` task, step spans, step rewards, and idempotent resume |

`terminus` and `compaction` default to `openai/gpt-5-mini` and require `OPENAI_API_KEY`.
`multi-step` defaults to `anthropic/claude-sonnet-4-5` and requires `ANTHROPIC_API_KEY`.
The multi-step case passes that key to Claude Code and uses API billing, not subscription billing.
Override models with `HARBOR_ATIF_MODEL` and `HARBOR_ATIF_CLAUDE_MODEL`.

The runner builds the current Phoenix client wheel. Harbor defaults to `0.21.0`, the minimum
supported version; use `HARBOR_VERSION` to test another version.

Set `HARBOR_E2E_ENDPOINT` to keep results in your existing Phoenix instance. Without it, the runner
starts a temporary server with a separate database. Successful runs remove their temporary
workspace unless `HARBOR_E2E_KEEP=1`. Failed runs keep it and print its path. An external Phoenix
server's data is not removed.
