---
name: test-integration
description: Run and extend Phoenix's executable integration documentation checks. Use when changing an integration doc, its runnable example, or the CI harness.
---

# Integration documentation checks

The harness runs published Phoenix integration examples against a local Phoenix
server and verifies the result in Phoenix. The enabled set is deliberately
incremental: `scripts/testing/integration_docs/integrations.json` lists the
documents CI executes. `INTEGRATION_CHECKS.md` is only an onboarding inventory.

## Run checks locally

Start Phoenix at `http://127.0.0.1:6006`, set the credentials required by the
selected integration, then run:

```bash
make test-integration-docs
```

Run a single configured document with:

```bash
make test-integration-docs INTEGRATION_DOCS_ARGS="--doc docs/phoenix/integrations/llm-providers/openai/openai-tracing.mdx"
```

The runner parses the selected page before checking credentials, installs its
documented dependencies into a disposable environment, executes the example,
and verifies spans using the Phoenix API. Reports are written under
`ci-results/integration-docs/`. `PHOENIX_ENDPOINT` can override the local
endpoint.

For Ollama checks, also start Ollama and pull the configured model before
running the harness. The current Ollama entries use `llama3.2:1b`; Python uses
the native Ollama client, while Node.js and Go use the OpenAI SDK against
Ollama's local OpenAI-compatible endpoint. CI reads each integration's
`services` declaration, starts Ollama when that shard needs it, and pulls the
declared model. Ollama checks do not require a provider API key.

## CI behavior

- Pull requests classify changed files. Enabled integration docs run only when
  changed; shared snippets are routed to the docs that consume them.
- Changes to the runner, routing config, workflow, skill scripts, or Makefile
  run the full enabled set. Inventory-only edits do not trigger checks.
- Monday's scheduled workflow and manual dispatch run all enabled docs. A
  manual `docs` input accepts space-separated paths from `integrations.json`.
- Selected docs are distributed deterministically across a matrix of shards;
  shard reports are merged into one artifact, job summary, and PR comment.
- Each invocation uses a unique Phoenix project, so shards do not contend for
  shared project state.
- Local services are declared per integration in `integrations.json` and
  prepared only in the shards assigned to those docs.

## Add an integration

1. Confirm the page has clearly delimited install, setup, and run sections that
   the runner can extract. Add an adapter only when the existing extractors do
   not support the example structure.
2. Add an entry to `integrations.json` with a stable id, document path,
   language, required environment variables, setup rules, output expectations,
   and a verifier that checks the page's promised behavior.
3. Add the page to `INTEGRATION_CHECKS.md` and document any routing needs in
   `scripts/skip_config.json`.
4. Run the document locally against Phoenix and inspect both the generated
   report and the spans in its unique project before enabling it in CI.

Keep credentials in environment variables. Do not put API keys in docs,
fixtures, or reports.
