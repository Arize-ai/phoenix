---
name: phoenix-otel-development
description: >
  Design, implementation, and testing guide for the phoenix-otel TypeScript package.
  Covers the stack-based global tracer provider mount system, snapshot/restore of OTel
  globals, the pnpm module identity workaround, span processor configuration, and
  provider lifecycle management. Use when adding or modifying registration logic, global
  provider attachment, span export, or tests in js/packages/phoenix-otel/. Also triggers
  on mentions of tracer provider lifecycle, OTel global state, or provider registration.
license: Apache-2.0
metadata:
  author: oss@arize.com
  version: "1.0.0"
  languages: TypeScript
  internal: true
---

# Phoenix OTel Development

The `@arizeai/phoenix-otel` package is the OpenTelemetry registration and provider lifecycle layer for Phoenix. It is the **single source of truth** for OTel configuration — other Phoenix packages (`phoenix-client`, `phoenix-evals`) delegate to it rather than importing OTel packages directly.

Before writing new code, explore the directory you're working in to understand existing patterns — then follow these rules.

## Rule Files

Read the relevant file(s) based on the task:

| Rule file | When to read |
|-----------|-------------|
| `rules/global-provider-lifecycle.md` | Working with global tracer provider attachment, detachment, snapshot/restore, or the mount stack |
| `rules/register-api.md` | Modifying `register()`, span processor setup, URL normalization, or the public API surface |
| `rules/testing.md` | Writing or modifying tests for provider lifecycle, registration, or span export |

## Package Structure

```
src/
  index.ts               # Public API surface (re-exports)
  register.ts            # Core: register(), attach/detach, stack management (~650 lines)
  config.ts              # Env var helpers (PHOENIX_COLLECTOR_ENDPOINT, PHOENIX_API_KEY)
  utils.ts               # objectAsAttributes() utility
  createNoOpProvider.ts  # No-op provider factory for dry runs
test/
  register.test.ts       # Provider lifecycle and registration tests
  suppressTracing.test.ts # Re-export verification
examples/
  register_example.ts    # Usage example
```

## Public API Surface

| Export | Purpose |
|--------|---------|
| `register(params)` | Create and configure a `NodeTracerProvider` with OTLP export |
| `attachGlobalTracerProvider(provider)` | Mount a provider onto the OTel global stack, returns `{ detach }` |
| `detachGlobalTracerProvider()` | Detach the topmost mounted provider |
| `createNoOpProvider()` | Provider with no processors (dry runs) |
| `objectAsAttributes(obj)` | Convert object to OTel attribute map |
| `ensureCollectorEndpoint(url)` | Normalize URL to include `/v1/traces` |
| `getDefaultSpanProcessor(params)` | Create OTLP-backed batch or simple processor |
| Re-exports | `trace`, `context`, `DiagLogLevel`, `SpanStatusCode`, `suppressTracing`, `NodeTracerProvider`, etc. |

## Key Dependencies

- `@opentelemetry/api` — Core OTel APIs (tracer, context, propagation)
- `@opentelemetry/sdk-trace-node` — `NodeTracerProvider`
- `@opentelemetry/exporter-trace-otlp-proto` — OTLP HTTP/proto exporter
- `@opentelemetry/context-async-hooks` — `AsyncLocalStorageContextManager`
- `@opentelemetry/core` — W3C propagators
- `@arizeai/openinference-vercel` — OpenInference batch and simple span processors

## Build

Dual-module output (CJS + ESM):

```bash
pnpm build       # tsc → dist/src/ (CJS) + dist/esm/ (ESM)
pnpm test        # vitest run
pnpm typecheck   # tsc --noEmit
```
