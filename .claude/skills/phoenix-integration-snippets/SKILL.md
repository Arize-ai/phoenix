---
name: phoenix-integration-snippets
description: >
  Generates onboarding code snippets for Phoenix tracing integrations.
  Produces three sections (install dependencies, environment variables,
  implementation) for SDKs like OpenAI, LangChain, Vercel AI SDK, and others.
  Supports Python and TypeScript. Use when asked to create onboarding code,
  tracing setup snippets, quickstart examples, or getting-started code for
  a framework integration.
license: Apache-2.0
metadata:
  author: oss@arize.com
  version: "1.0.0"
  languages: Python, TypeScript
  internal: true
---

# Phoenix Integration Snippets

Generate three-section onboarding snippets (install, env vars, implementation) for Phoenix tracing integrations.

## Workflow

1. **Find the integration docs.** Read the relevant file in `docs/phoenix/integrations/` for the framework. This has the correct packages and setup pattern. Also check the OpenInference repo for example code: https://github.com/Arize-ai/openinference
2. **Determine language support.** Check if the integration has Python, TypeScript, or both. Generate snippets for all supported languages.
3. **Generate all three sections** following the output format below.
4. **Test the snippet** against a running Phoenix instance. Install deps, run the code, and confirm traces appear in the Phoenix UI.

## Output Format

Every snippet has exactly three sections:

**Section 1 — Install dependencies:** A single install command. List phoenix-otel first, then instrumentation package, then SDK.

**Section 2 — Environment variables:** API keys and Phoenix connection config. Use `<your-...>` placeholders in single quotes. Always include `PHOENIX_COLLECTOR_ENDPOINT` and `PHOENIX_API_KEY`.

**Section 3 — Implementation:** Working, copy-pasteable code that produces at least one trace. Keep it to 10-20 lines. Use a meaningful example prompt. No print/log statements for the result.

## Where to Find Info

- **Integration docs and packages:** `docs/phoenix/integrations/` — each integration has an `.mdx` file with install commands and setup code
- **Python phoenix-otel source and README:** `src/phoenix/otel/`
- **TypeScript phoenix-otel source and README:** `js/packages/phoenix-otel/`
- **Working TypeScript example:** `js/examples/apps/tracing-tutorial/`
- **OpenInference instrumentation packages:** https://github.com/Arize-ai/openinference

## Gotchas

These are easy to get wrong and were discovered through testing:

- **Python:** Use `from phoenix.otel import register` with `auto_instrument=True` — this handles all instrumentation automatically, no manual instrumentor calls needed
- **TypeScript:** `register({})` requires an object arg — `register()` with no args throws
- **TypeScript:** `register()` must be called before importing the SDK being instrumented
- **TypeScript:** `await provider.forceFlush()` is required in short-lived scripts — the batch processor drops spans if the process exits immediately. Not needed in long-running servers.
- **Comments:** Only add comments for non-obvious behavior (e.g., import ordering, flush requirement). Do not comment self-explanatory code.
