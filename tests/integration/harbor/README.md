# Harbor plugin integration tests

These tests run real Harbor jobs against Phoenix. They are intentionally excluded from the
normal test suite and CI because they require Docker, download Terminal-Bench tasks, and call
external model APIs.

Run the full matrix manually from the repository root:

```bash
OPENAI_API_KEY=... ANTHROPIC_API_KEY=... make harbor-plugin-e2e
```

Select cases with the comma-separated `HARBOR_E2E_ATIF_CASES` variable. The default is
`terminus,compaction,multi-step`.

| Case | Agent | What it checks |
| --- | --- | --- |
| `terminus` | Terminus-2 on `HARBOR_ATIF_MODEL` | Three Terminal-Bench trials in one experiment, run linkage, measured LLM timing, equal-time ordering, and idempotent resume |
| `compaction` | Terminus-2 with forced summarization | The compaction span, continuation trajectory, and three summarizer subagent trajectories |
| `multi-step` | Claude Code on `HARBOR_ATIF_CLAUDE_MODEL` | The synthetic three-step `fixtures/tasks/word-count` task, step spans, step rewards, and idempotent resume |

The runner builds the current Phoenix client wheel and starts an isolated Phoenix server unless
`HARBOR_E2E_ENDPOINT` points to an existing server. Successful runs remove their temporary
workspace. Failed runs retain it and print its path. Set `HARBOR_E2E_KEEP=1` to retain successful
runs too.
