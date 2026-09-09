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

Fixture preparation is separate from seeding:

```sh
# Trusted setup process only; requires authorized HF_TOKEN in its environment.
make mcp-fixture
# Or use private local rows without any network request:
make mcp-fixture ARGS='--input /absolute/private/rows.json'
```

The default revision is immutable. Outputs under `.private/trail` include source
payload and protected truth. Repeated preparation accepts identical contents;
changed contents require a new output directory. Fixture preparation creates no
Phoenix server or database. The programmatic `fixture.seed` helper requires a
caller-managed, authorized fresh target and refuses an existing fixture project.

`make mcp-isolation-probe` runs Harbor's pinned ephemeral Alpine capability probe.
It does not create Phoenix state or make model calls. A passing probe is only a
prerequisite: actual egress, web-tool, repository, grader, reward, and shutdown
probes must pass for each installed agent condition before execution is enabled.
The current Docker Desktop kernel lacks `CONFIG_NFT_FIB_INET`, so this gate fails.

Task staging requires a prepared manifest and reviewed runtime image digests:

```sh
make mcp-stage-task ARGS='--manifest /private/manifest.json --output /private/tasks --agent-image registry/agent@sha256:DIGEST --verifier-image registry/python@sha256:DIGEST'
```

Replace `DIGEST` with actual 64-character image hashes. The canonical task has no
MCP registration, so CLI conditions cannot inherit an MCP server. Network defaults
are closed. This staging command does not configure a runnable trial: trusted
truth/audit transfer and condition access must be attached by the pending runner.
The verifier emits no authoritative reward without trusted evidence.
