---
name: phoenix-client-development
description: >
  Design, implementation, and testing guide for the phoenix-client TypeScript package.
  Covers experiment lifecycle, OpenTelemetry tracer provider management, the tracing
  abstraction layer, test conventions, and integration testing patterns. Use when adding
  or modifying experiment code, tracing logic, evaluator wiring, or tests in
  js/packages/phoenix-client/. Also triggers on mentions of tracer provider lifecycle,
  span export, or experiment phases (task, evaluation).
license: Apache-2.0
metadata:
  author: oss@arize.com
  version: "1.0.0"
  languages: TypeScript
  internal: true
---

# Phoenix Client Development

The `@arizeai/phoenix-client` package is the TypeScript SDK for the Phoenix AI observability platform. It provides APIs for datasets, experiments, prompts, sessions, spans, and traces.

Before writing new code, explore the directory you're working in to understand existing patterns — then follow these rules.

## Rule Files

Read the relevant file(s) based on the task:

| Rule file | When to read |
|-----------|-------------|
| `rules/experiments.md` | Adding or modifying experiment execution, task runners, or evaluator wiring |
| `rules/tracing.md` | Working with OpenTelemetry tracer providers, span export, or global state |
| `rules/testing.md` | Writing or modifying unit tests, integration tests, or test fixtures |

## Package Structure

```
src/
  client.ts              # createClient() — typed REST client via openapi-fetch
  datasets/              # Dataset CRUD operations
  experiments/           # Experiment execution engine
    runExperiment.ts     # Primary entry point — task + eval phases
    resumeExperiment.ts  # Resume a partially-completed experiment
    resumeEvaluation.ts  # Resume only the evaluation phase
    tracing.ts           # Tracing abstraction (cleanup helpers)
  prompts/               # Prompt template management
  sessions/              # Session tracking
  spans/                 # Span queries
  traces/                # Trace queries
test/                    # Mirrors src/ structure
```

## Key Dependencies

- `@arizeai/phoenix-otel` — OpenTelemetry registration, tracer provider lifecycle. All OTel machinery lives here; phoenix-client delegates to it.
- `@arizeai/phoenix-config` — Shared configuration resolution.
- `openapi-fetch` — Type-safe REST client generated from OpenAPI schema.

Both `phoenix-otel` and `phoenix-config` are referenced as `workspace:*` in package.json (pnpm workspace protocol).

## Build and Test

```bash
cd js/
pnpm test                         # Run all workspace tests
pnpm --filter phoenix-client test # Run only phoenix-client tests
```

Tests use **vitest**. Test files live in `test/` and are named `*.test.ts`.
