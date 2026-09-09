# Phoenix MCP benchmark

This benchmark compares current Phoenix MCP with `px` using Claude Code and Codex.
Implementation is in progress. No live benchmark results exist yet.

Run from the repository root:

```sh
make mcp-setup
make mcp-preflight
make mcp-test
make mcp-plugin-test
make mcp-preflight ARGS=--live
```

Setup creates a dedicated Harbor 0.22.0 environment. It builds the client and evals
wheels from the git revision in `configs/runtime.json`, installs those wheels, and
records their SHA256 digests in `.runtime/build.json`. It does not use PATH Harbor.
The client includes ATIF tracing; the evals wheel includes `CompletenessEvaluator`.
Dependencies are locked separately from the Phoenix application environment.

The requested models remain `opus-5` and `gpt-5.6`. Neither is claimed to be a
verified provider identifier. Both provider keys must come from the runner's
process environment. Preflight reports presence only and never uses Keychain,
personal agent settings, or a credential fallback.

`mcp-smoke` currently fails closed with the outstanding live-run gates. No target
creation, database changes, or paid calls occur. Target provisioning and cleanup,
and an initial spending cap, require the user's decisions. Runtime network,
shutdown, and evidence-transfer checks must also pass before enabling execution.
The results destination defaults to the existing Phoenix instance for additive
records. The shared Phoenix database is never disposable benchmark state.

Private wheels, downloaded TRAIL data, logs, and trajectories belong under ignored
`.runtime/` or `.private/`. Do not publish TRAIL payloads or populated images.
See the [execution plan](../../internal_docs/specs/phoenix-mcp-harbor-benchmark.md).
