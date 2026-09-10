# Phoenix MCP benchmark

Run the `trace-count` task once per condition: Claude Code with MCP or `px`, and
Codex with MCP or `px`. The sample is serial, has no retries, and does not run a
larger task suite. Requested models are `opus-5` (provider ID `claude-opus-5`) and
`gpt-5.6`; authenticated OpenAI inference resolves the latter to `gpt-5.6-sol`.

## Setup and execution

Run commands from the repository root:

```sh
make mcp-setup
make install-python
make mcp-smoke-images
make mcp-test mcp-smoke-boundary-test mcp-lint
```

The dedicated benchmark environment uses Harbor 0.22.0 and builds the Phoenix
client and evals wheels from the revision in `configs/runtime.json`. Their hashes
must match `configs/wheels.json`. The separate Phoenix development environment
uses the checkout's server dependencies. Images contain pinned agent versions;
only CLI images contain `px`. No image contains TRAIL payloads or credentials.

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
```

The runner reads credentials from its environment, never from Keychain or a
personal agent login. Only the trusted gateway receives the actual provider key;
agents receive a placeholder. The judge receives an explicit OpenAI key. HF
credentials are used only for fixture preparation.

## Isolation and verification

The scoped dev endpoint runs native Phoenix MCP code mode and native REST/GraphQL
reads over the shared database. An outer boundary blocks writes, results access,
and reads outside the fixture. SQL is restricted to project and trace relations,
with a fixture predicate inserted into every physical relation. This boundary is
specific to the count smoke; it is not authorization for broader benchmark tasks.

Each Harbor agent runs on a Docker internal network with isolated gateway mode.
A separate trusted gateway admits only the assigned Phoenix interface and model
inference. It recursively rejects hosted tools, including web search. Codex uses
HTTP Responses transport through this gateway. Same-container probes check public
hosts, direct IPs, host Phoenix endpoints, protected files, and hosted search
before agent execution. This avoids Harbor's default nftables path, which requires
`CONFIG_NFT_FIB_INET` on the Docker host.

The agent's verifier directory is not mounted from the host. A probe plants a
forged reward there. Harbor stops the agent, the runner independently inspects its
container state, and a separate offline verifier receives the declared answer and
trusted evidence. Missing evidence yields no reward. The native completeness
evaluator runs after shutdown; its rubric excludes factual correctness. Count,
evidence IDs, unchanged fixture state, and access policy have separate scores.

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
linkage, requires one run per selected condition, checks every evaluation, and
confirms that the linked trace contains spans. `--condition` can select completed
conditions from a sample that stopped on an infrastructure failure. Reports and
raw artifacts stay in ignored `.private/`; do not publish restricted trajectories.

`make mcp-smoke-verifier-probe ARGS='<sample>/<condition>'` tests the verifier with
an already-stopped trial's saved evidence without another agent or judge call.
The general metadata-filtered report remains available through `make mcp-report`;
filters are in `configs/filters/`. No repetitions or broader sweep are implied by
a successful smoke.
