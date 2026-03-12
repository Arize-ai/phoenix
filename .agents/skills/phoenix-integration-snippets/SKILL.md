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

1. **Find the integration docs.** Read the relevant file in `docs/phoenix/integrations/` for the framework. Also check the OpenInference repo for example code: https://github.com/Arize-ai/openinference
2. **Determine language support.** Check if the integration has Python, TypeScript, or both.
3. **Generate snippets** following the format below.
4. **Wire into the onboarding UI** following the steps below.
5. **Test the snippet** against a running Phoenix instance. Install deps, run the code, and confirm traces appear in the Phoenix UI.

## Snippet Format

Each snippet has two parts:

**Packages:** An array of package names. List phoenix-otel first, then instrumentation package, then SDK.

**Implementation:** Working, copy-pasteable code that produces at least one trace. 10-20 lines, meaningful example prompt, no print/log statements.

## Adding to the Onboarding UI

### 1. Add implementation function

**File:** `app/src/components/project/integrationSnippets.ts`

Add a function following the existing pattern:

```typescript
export function get<Name>Code<Language>(projectName: string): string {
  return `...`;
}
```

The function receives `projectName` to pass to `register()`. See `getOtelInitCodeTypescript` for reference.

### 2. Register the integration

**File:** `app/src/pages/project/integrationRegistry.tsx`

Import your function and add an entry to `ONBOARDING_INTEGRATIONS`:

```typescript
{
  id: "my-integration",
  name: "My Integration",
  icon: <MyIcon />,
  supportedLanguages: ["TypeScript"],
  snippets: {
    TypeScript: {
      packages: ["@arizeai/phoenix-otel", "my-sdk"],
      getImplementationCode: ({ projectName }) =>
        getMyIntegrationCodeTypescript(projectName),
    },
  },
}
```

Types are defined in `app/src/pages/project/integrationDefinitions.ts`.

## Gotchas

- **Python:** Use `from phoenix.otel import register` with `auto_instrument=True` — no manual instrumentor calls needed
- **TypeScript:** `register({})` requires an object arg — `register()` with no args throws
- **TypeScript:** `register()` must be called before importing the SDK being instrumented
- **TypeScript:** `await provider.forceFlush()` is required in short-lived scripts — not needed in long-running servers
- **Comments:** Only add comments for non-obvious behavior (e.g., import ordering, flush requirement)
