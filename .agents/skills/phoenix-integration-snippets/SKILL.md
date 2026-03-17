---
name: phoenix-integration-snippets
description: >
  Generates onboarding code snippets for Phoenix tracing integrations and wires
  them into the project onboarding UI. Produces install dependencies and
  implementation sections for SDKs like OpenAI, LangChain, Vercel AI SDK, and
  others. Supports Python and TypeScript. Use when asked to create onboarding
  code, tracing setup snippets, quickstart examples, or getting-started code
  for a framework integration.
license: Apache-2.0
metadata:
  author: oss@arize.com
  version: "2.0.0"
  languages: Python, TypeScript
  internal: true
---

# Phoenix Integration Snippets

Generate onboarding snippets (install + implementation) for Phoenix tracing integrations and add them to the project onboarding UI.

## Workflow

Copy this checklist and track progress:

```
- [ ] 1. Research: read integration docs and OpenInference repo
- [ ] 2. Determine language support (Python, TypeScript, or both)
- [ ] 3. Generate snippets following the format below
- [ ] 4. Test every language variant against Phoenix
- [ ] 5. Wire into the onboarding UI
- [ ] 6. Report results with links to trace pages
```

**Step 1: Research.** Read the relevant file in `docs/phoenix/integrations/` for the framework. Also check the OpenInference repo for example code: https://github.com/Arize-ai/openinference

**Step 4: Test.** See [Testing](#testing) below. Only proceed to wiring into the UI when traces are confirmed.

**Step 5: Wire into the onboarding UI.** After adding `docsHref` and `githubHref`, verify every URL returns HTTP 200 before committing. For GitHub links, prefer the OpenInference repo (`https://github.com/Arize-ai/openinference/tree/main/...`).

**Step 6: Report.** Provide clickable links to the Phoenix project pages (e.g., `http://localhost:6006/projects/<base64-id>/traces`).

## Snippet Format

Each snippet has two parts:

**Packages:** Array of package names. Order: phoenix-otel first, then instrumentation package, then SDK.

**Implementation:** Working, copy-pasteable code that produces at least one trace. 10-20 lines, meaningful example prompt, no print/log statements.

## Adding to the Onboarding UI

### 1. Add implementation function

**File:** `app/src/components/project/integrationSnippets.ts`

The onboarding UI already displays env vars (including `PHOENIX_COLLECTOR_ENDPOINT`) in a separate section before the code snippet. Both `phoenix.otel.register` (Python) and `@arizeai/phoenix-otel` `register` (TypeScript) read this env var automatically. Do NOT pass `endpoint`/`url` in the snippet code — rely on the env var.

**Python:** Use `auto_instrument=True` — no manual instrumentor calls. SDK imports must come _after_ `register()`.

**TypeScript:** ESM imports are hoisted so import ordering doesn't matter. `await provider.forceFlush()` is required in short-lived scripts.

### 2. Register the integration

**File:** `app/src/pages/project/integrationRegistry.tsx`

Import your function and add an entry to `ONBOARDING_INTEGRATIONS`. Pass snippet functions as direct references (they match the `getImplementationCode` type in `integrationDefinitions.ts`).

## Testing

Test snippets **as written** — the exact code the user will see in the onboarding UI. If any modification is required to make a snippet work, that is a bug.

### Isolated test environments

Create a **fresh environment per integration** with only the packages from that snippet's `packages` array. This prevents false positives from cross-contamination (e.g., an installed `openinference-instrumentation-openai` producing extra traces when testing a LangChain snippet).

Set `PHOENIX_COLLECTOR_ENDPOINT` and run the snippet code verbatim.

### Validation checklist

For each snippet, verify:

- No export errors (no `405`, no `Failed to export span batch`)
- Traces appear in Phoenix under the expected project name
- Trace kind and structure match expectations (e.g., LangChain shows `chain` spans, not just bare `llm` spans)
- Only one top-level trace per invocation (multiple top-level traces suggest instrumentor cross-contamination)

### When a snippet doesn't work as-is

If you must modify the snippet code to get traces flowing, **do not silently work around it and continue**. Instead:

1. **Fix the snippet** if the change is small and clearly correct (e.g., a typo, missing import)
2. **Flag to the user** if the fix requires a design decision (e.g., the SDK doesn't support env-var-based config, or auto-instrumentation doesn't work for this framework)
