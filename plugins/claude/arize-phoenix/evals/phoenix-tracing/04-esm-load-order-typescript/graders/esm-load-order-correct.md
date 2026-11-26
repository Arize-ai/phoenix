---
type: llm
focus: {source: file, path: instrumentation.ts}
weight: 0.5
---
The user's app uses ESM, where `import` statements are hoisted and run before `register()`, so plain auto-instrumentation (register then import OpenAI) fails to patch the SDK — which is why they saw no spans.

Grade exactly one claim. PASS if the claim below holds, FAIL otherwise. Ignore everything else about the file.

Claim: The setup addresses the ESM hoisting problem rather than repeating the broken pattern. It explicitly instruments the OpenAI SDK after `register()` — via `manuallyInstrument(OpenAI)` and/or `registerInstrumentations(...)` — instead of relying only on `register()` + a top-level `import OpenAI` and expecting auto-instrumentation to work.
