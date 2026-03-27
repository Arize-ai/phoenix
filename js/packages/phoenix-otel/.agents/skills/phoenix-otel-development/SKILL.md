---
name: phoenix-otel-development
description: >
  Guide for the phoenix-otel TypeScript package — OTel registration,
  stack-based global provider management, and provider lifecycle.
license: Apache-2.0
metadata:
  author: oss@arize.com
  version: "1.0.0"
  languages: TypeScript
  internal: true
---

# Phoenix OTel Development

OpenTelemetry registration and provider lifecycle layer for Phoenix. Single source of truth for OTel configuration — other Phoenix packages delegate here rather than importing OTel packages directly.

Read existing code in the directory you're working in before writing new code.

## Rule Files

| Rule file                            | When to read                                                          |
| ------------------------------------ | --------------------------------------------------------------------- |
| `rules/global-provider-lifecycle.md` | Global provider attachment, detachment, snapshot/restore, mount stack |
| `rules/register-api.md`              | `register()`, span processor setup, public API surface                |
| `rules/testing.md`                   | Tests for provider lifecycle, registration, span export               |

## Build and Test

```bash
cd js/
pnpm --filter phoenix-otel test
```

Dual-module output (CJS + ESM). Tests use **vitest**.
