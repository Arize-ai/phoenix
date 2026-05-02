---
name: phoenix-client-development
description: >
  Guide for the phoenix-client TypeScript package — experiment lifecycle,
  tracer provider management, and test conventions.
license: Apache-2.0
metadata:
  author: oss@arize.com
  version: "1.0.0"
  languages: TypeScript
  internal: true
---

# Phoenix Client Development

TypeScript SDK for Phoenix AI observability: datasets, experiments, prompts, sessions, spans, traces.

Read existing code in the directory you're working in before writing new code.

## Rule Files

| Rule file              | When to read                                              |
| ---------------------- | --------------------------------------------------------- |
| `rules/experiments.md` | Experiment execution, task runners, evaluator wiring      |
| `rules/tracing.md`     | OpenTelemetry tracer providers, span export, global state |
| `rules/testing.md`     | Unit tests, integration tests, test fixtures              |

## Build and Test

```bash
cd js/
pnpm --filter phoenix-client test
```

Tests use **vitest**. Test files live in `test/` named `*.test.ts`.
