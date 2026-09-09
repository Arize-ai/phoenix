# Execution handoff

Started from `origin/main` at `e2e514329b5b93c912d6d2e8cea478e96211b115`.
The first stack branch is `ehutt/mcp-harbor/runtime`, never the parent docs branch.
The copied execution plan has SHA256
`6e20be27c4e25ac3433553c14d24eda4b75b8d09eeba4120703501250b013342`.

## Stage 0: runtime contracts

Built the client 3.4.0 and evals 3.6.0 wheels from the pinned commit. Harbor 0.22.0
runs in `evals/mcp/.venv`. Existing plugin and ATIF tests: **331 passed**.
The benchmark's initial credential/evaluator contract tests: **3 passed**.
This is offline compatibility evidence, not an end-to-end benchmark result.

Official documentation identifies `claude-opus-5` as the Opus 5 API ID and
`gpt-5.6` as an alias for `gpt-5.6-sol`. Requested values remain unchanged in the
runtime contract; authenticated resolution and agent verification are pending.
Sources checked September 9, 2026:

- https://platform.claude.com/docs/en/models/opus-5/whats-new-opus-5
- https://developers.openai.com/api/docs/models/gpt-5.6-sol
- https://learn.chatgpt.com/docs/config-file/config-reference

Both provider keys are absent from the process. No Keychain fallback was used.
No Phoenix DB was created or modified. No paid API calls were made.

## Gates before live execution

- User authorization for new disposable targets, their cleanup, and failed artifact retention.
- User monetary cap for the first live smoke.
- Provider keys supplied in the runner process and authenticated model resolution.
- Actual Docker isolation, separate verifier evidence transfer, and shutdown checks.

Full corpus research, task expansion, pilot, candidate patch, frozen sweep, and
publication remain deferred until the end-to-end smoke meets its acceptance gate.
