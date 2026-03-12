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
  version: "1.0.0"
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

**Step 4: Test.** For each supported language, install deps, run the snippet, and confirm traces appear in Phoenix. Use a dedicated project name per language (e.g., `my-integration-python-test`, `my-integration-ts-test`). If traces don't appear: check the Phoenix logs, verify the endpoint URL, and re-run. Only proceed to wiring into the UI when traces are confirmed.

**Step 6: Report.** Provide clickable links to the Phoenix project pages (e.g., `http://localhost:6006/projects/<base64-id>/traces`).

## Snippet Format

Each snippet has two parts:

**Packages:** Array of package names. Order: phoenix-otel first, then instrumentation package, then SDK.

**Implementation:** Working, copy-pasteable code that produces at least one trace. 10-20 lines, meaningful example prompt, no print/log statements.

## Adding to the Onboarding UI

### 1. Add implementation function

**File:** `app/src/components/project/integrationSnippets.ts`

**Python pattern:**

```python
export function get<Name>CodePython({
  projectName,
  isHosted,
}: {
  projectName: string;
  isHosted: boolean;
}): string {
  return `from phoenix.otel import register

tracer_provider = register(
  project_name="${projectName}",
  endpoint="${isHosted ? HOSTED_PHOENIX_URL : BASE_URL}",
  auto_instrument=True
)

# SDK imports must come after register() so auto-instrumentation can patch them
...`;
}
```

**TypeScript pattern:**

```typescript
export function get<Name>CodeTypescript({
  projectName,
  isHosted,
}: {
  projectName: string;
  isHosted: boolean;
}): string {
  return `import { register } from "@arizeai/phoenix-otel";
import ...

const provider = register({
  projectName: "${projectName}",
  url: "${isHosted ? HOSTED_PHOENIX_URL : BASE_URL}",
});

...

await provider.forceFlush();`;
}
```

Use `isHosted` to select the endpoint URL:

- `isHosted` → `HOSTED_PHOENIX_URL` (imported from `./hosting`)
- not hosted → `BASE_URL` (imported from `@phoenix/config`)

### 2. Register the integration

**File:** `app/src/pages/project/integrationRegistry.tsx`

Import your function and add an entry to `ONBOARDING_INTEGRATIONS`. Pass snippet functions as direct references (they match the `getImplementationCode` type in `integrationDefinitions.ts`):

```typescript
{
  id: "my-integration",
  name: "My Integration",
  icon: <MyIcon />,
  supportedLanguages: ["Python", "TypeScript"],
  snippets: {
    Python: {
      packages: ["arize-phoenix-otel", "openinference-instrumentation-my-sdk", "my-sdk"],
      getImplementationCode: getMyIntegrationCodePython,
    },
    TypeScript: {
      packages: ["@arizeai/phoenix-otel", "@arizeai/openinference-instrumentation-my-sdk", "my-sdk"],
      getImplementationCode: getMyIntegrationCodeTypescript,
    },
  },
}
```

## Gotchas

### Both languages

- **Hosted URL:** All snippet functions must use `isHosted` to select between `HOSTED_PHOENIX_URL` and `BASE_URL`. Never hardcode `BASE_URL` alone.
- **Comments:** Only add comments for non-obvious behavior (e.g., import ordering in Python, flush requirement, manual instrumentation).

### Python

- Use `from phoenix.otel import register` with `auto_instrument=True` — no manual instrumentor calls needed.
- SDK imports must come _after_ `register()` so auto-instrumentation can patch them.

### TypeScript

- ESM `import` statements are hoisted — placing them after runtime code has no effect. Put all imports at the top. (Import ordering only matters in Python.)
- `await provider.forceFlush()` is required in short-lived scripts — not needed in long-running servers.
