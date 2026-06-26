---
"@arizeai/phoenix-cli": minor
---

**Beta:** Add the `pxi` terminal client to `@arizeai/phoenix-cli`. Launch an interactive PXI (Phoenix Intelligence) chat from your shell with `npx -y @arizeai/phoenix-cli pxi` (or the `pxi` binary). It connects to a running Phoenix instance's server-agent endpoint — the same agent that powers the in-browser experience — and runs a model preflight on launch so configuration problems surface as a clean error. Configure the endpoint via `PHOENIX_HOST`/`--endpoint` and select a model with `--provider`/`--model` (defaults to Anthropic `claude-opus-4-8`).

This feature is in beta and may change in a future release.
