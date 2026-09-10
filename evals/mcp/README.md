# Phoenix MCP benchmark

Run the `trace-count` task once per condition: Claude Code with MCP or `px`, and
Codex with MCP or `px`. The sample is serial and has no automatic retries.
The optional review suite inspects trace structure, stored annotations, and a
dataset/experiment with a recorded failure. Requested models are `opus-5` (provider ID `claude-opus-5`) and
`gpt-5.6`; authenticated OpenAI inference resolves the latter to `gpt-5.6-sol`.

## Setup and execution

Run commands from the repository root:

```sh
make mcp-setup
make install-python
make mcp-smoke-images
make mcp-test mcp-typecheck mcp-smoke-boundary-test mcp-lint
```

The dedicated benchmark environment uses Harbor 0.22.0 and builds the Phoenix
client and evals wheels from the revision in `configs/runtime.json`. Their hashes
must match `configs/wheels.json`. Isolated wheel builds use the backend and dependency
versions in `configs/build-constraints.txt`. The separate Phoenix development environment
uses the checkout's server dependencies. Images contain pinned agent versions.
CLI agents use a transport executable named `px`; a separate broker image runs
the pinned Phoenix CLI. No image contains TRAIL payloads or credentials.

Prepare the pinned TRAIL fixture with `HF_TOKEN` in the trusted downloader's
process environment:

```sh
make mcp-fixture
```

Preparation writes ignored private files and does not create a database. Seed the
prepared payload through `fixture.seed` into the existing Phoenix instance at
`http://localhost:6006`; this additive helper refuses an existing project. Do not
reset or delete a project to make seeding pass. Reuse an existing fixture only
when its IDs and annotation content match `smoke_run.check_fixture`.

The sample uses `~/.phoenix/phoenix.db` for both the fixture and results. Leave
`PHOENIX_WORKING_DIR` unset. Start the scoped development endpoint in another
terminal, then inject provider keys into the runner process and run the sample:

```sh
make mcp-smoke-target
# In another terminal, with OPENAI_API_KEY and ANTHROPIC_API_KEY supplied:
make mcp-live-sample
# Or select conditions after fixing an infrastructure failure:
make mcp-live-sample ARGS='--condition codex-mcp --condition codex-cli'
# Prepare a separate three-example fixture, then restart mcp-smoke-target:
make mcp-smoke-review-fixture
make mcp-live-sample ARGS='--suite review'
# Select only tasks affected by a corrected failure:
make mcp-live-sample ARGS='--suite review --condition claude-cli --task experiment-review'
```

The runner reads credentials from its environment, never from Keychain or a
personal agent login. Only the trusted gateway receives the actual provider key;
agents receive a placeholder. The judge receives an explicit OpenAI key. HF
credentials are used only for fixture preparation.

## Isolation and verification

The scoped dev endpoint runs native Phoenix MCP code mode and native REST/GraphQL
reads over the shared database. An outer boundary blocks writes, results access,
and reads outside the fixture. SQL inserts fixture predicates into every physical
relation. Tracing and annotation reads are confined to the TRAIL project. Dataset
and experiment reads are confined to the IDs created by `mcp-smoke-review-fixture`.
The review fixture contains synthetic outcomes, including an intentional timeout;
these are task inputs, separate from the benchmark's recorded results.

Each Harbor agent runs on a Docker internal network with isolated gateway mode.
A separate trusted gateway admits only the assigned Phoenix interface and model
inference. It rejects hosted tools, remote document/image URL inputs, and references
to external provider files. Inline text and image data remain
available. Codex uses
HTTP Responses transport through this gateway. Same-container probes check public
hosts, direct IPs, host Phoenix endpoints, protected files, and hosted search
before agent execution. This avoids Harbor's default nftables path, which requires
`CONFIG_NFT_FIB_INET` on the Docker host.

For CLI conditions, the gateway admits Phoenix requests only from the broker's
container IP. The broker runs the real `px` binary with argv and stdin, never a
shell or inherited agent environment. It has no provider keys or public network.
The agent and broker share only their task workspace and temporary files, so CLI
downloads and relative paths work. Probes verify that direct HTTP is rejected and
that files written by `px` are visible to the agent. The broker stops before grading.

The agent's verifier directory is not mounted from the host. A probe plants a
forged reward there. Harbor stops the agent, the runner independently inspects its
container state, and a separate offline verifier receives the declared answer and
trusted evidence. Missing trusted evidence yields no reward. Missing, malformed,
or oversized agent answers receive a zero behavioral reward. The native completeness
evaluator runs after shutdown; its rubric excludes factual correctness. Count,
evidence IDs, unchanged fixture state, and access policy have separate scores.
Review tasks compare requested records against private references, ignoring list
order. The runner also snapshots the review dataset and experiment before and
after execution. Zero rewards remain recorded and subsequent conditions run.
Infrastructure failures or missing rewards stop the remaining matrix.

Review preparation resumes from checkpointed IDs after interruption, including a
lost response after a successful create. It validates existing examples and runs
before reusing them, then freezes the tracing and review state. Run
`make mcp-smoke-review-fixture` once for fixtures prepared before this validation
was added. It preserves the existing resources and validates their content.
Changed state is rejected rather than silently accepted as a new baseline.
Review references and state hashes contribute to every review task's dataset
identity. Each sample saves its references and checks the same baseline across
conditions.

Native SQL and schema calls produce correlated start/completion audit records.
The runner saves `measurements.json` and records `sql_attempted`, `sql_succeeded`,
`schema_inspected`, and `sql_measurement_complete` through the Harbor verifier.
SQL error envelopes do not count as success. Incomplete or legacy audit records
report unavailable measurements, not zero use. These measurements do not change
the behavioral reward. Unsupported fixture query shapes are distinct from denied
access to other resources; fixture-only span queries and named GraphQL fragments
are supported.

The reusable TRAIL converter upserts annotations by identifier: this fixture has
585 source span-annotation records representing 581 stored annotations, plus 585
trace annotations. The runner checks every stored target, label, score, explanation,
name and annotator kind, as well as trace/span identities and before/after state.

## Inspect recorded results

The runner uses only the native `arize-phoenix` Harbor plugin for the dataset,
experiments, verifier evaluations and linked ATIF traces. Failed diagnostic jobs
remain recorded. A sample prints its private output directory; inspect it with:

```sh
make mcp-smoke-check ARGS='evals/mcp/.private/sample-TIMESTAMP'
```

The checker reads Phoenix records back, validates dataset facets and version
linkage, requires one run per selected task and condition, checks every stored evaluation against the terminal verifier rewards, and
confirms that the linked trace contains spans. `--condition` can select completed
conditions from a sample that stopped on an infrastructure failure. Reports and
raw artifacts stay in ignored `.private/`; do not publish restricted trajectories.

Experiment names show the configuration, for example `Claude Code · Opus 5 · MCP`
or `Codex · GPT-5.6 · CLI`. Timestamps remain in private artifact paths and Harbor
job metadata. The checker uses stored Harbor identity rather than display names,
so experiments can be renamed in Phoenix without breaking verification.

`make mcp-smoke-verifier-probe ARGS='<sample>/<condition>'` tests the verifier with
an already-stopped trial's saved evidence without another agent or judge call.
The general metadata-filtered report remains available through `make mcp-report`;
filters are in `configs/filters/`. No repetitions or broader sweep are implied by
a successful smoke.
