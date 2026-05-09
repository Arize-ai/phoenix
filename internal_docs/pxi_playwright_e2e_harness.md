# PXI Playwright E2E Harness Proposal

This proposal describes a Playwright harness for evaluating PXI through the Phoenix frontend, grounded in the current PXI request flow and Phoenix experiment APIs.

## Goals

- Make PXI E2E tests easy to author for complex, frontend-driven agent scenarios.
- Run Phoenix in an isolated test environment with deterministic seed data.
- Exercise PXI through the real UI, including route context, model selection, streaming, and browser-executed tools.
- Persist each test case as a Phoenix experiment run with an LLM-as-judge evaluation.
- Capture enough artifacts to debug agent failures without rerunning locally.

## Current PXI Mechanisms

PXI chat is owned by the frontend runtime but server-defined at the model boundary.

- `app/src/components/agent/useAgentChat.ts` creates an AI SDK `Chat` runtime and binds it to React with `useChat`.
- `app/src/components/agent/useAgentChatPanelState.ts` builds the chat URL as `/chat?provider_type=...&provider=...&model_name=...` or `/chat?provider_type=custom&provider_id=...&model_name=...`.
- `app/src/agent/chat/buildAgentChatRequestBody.ts` adds PXI-specific request fields: `userInstructions`, `traceNameSuffix`, `sessionId`, `ingestTraces`, `exportRemoteTraces`, `contexts`, and `capabilities`.
- `src/phoenix/server/api/routers/chat.py` handles `POST /chat`, builds the model from query params, injects Phoenix context into the message history, resolves server-owned tools, and streams the response.
- `src/phoenix/server/agents/tools/registry.py` advertises external tools and context-gated tools. External tools currently include `ask_user` and `bash`; contextual tools currently include `set_spans_filter` when required UI context is present.
- `app/src/agent/extensions/toolRegistry.ts` dispatches browser-executed tools by name, validates tool inputs, checks capabilities, and returns tool outputs through the AI SDK runtime.
- `app/src/store/agentStore.ts` persists sessions in local storage under `arize-phoenix-agent` and stores ephemeral runtime state for contexts, client actions, pending elicitations, and chat status.

The harness should not duplicate tool schemas in tests. It should observe the same user-visible transcript and, where needed, instrument the existing stream/store/request surfaces.

## Current Experiment APIs

Phoenix already has the REST endpoints needed to persist PXI test results as experiments.

- Create or update a dataset with examples: `POST /v1/datasets/upload?sync=true` from `src/phoenix/server/api/routers/v1/datasets.py`.
- Create an experiment for a dataset: `POST /v1/datasets/{dataset_id}/experiments` from `src/phoenix/server/api/routers/v1/experiments.py`.
- Create an experiment run: `POST /v1/experiments/{experiment_id}/runs` from `src/phoenix/server/api/routers/v1/experiment_runs.py`.
- Upsert an experiment evaluation: `POST /v1/experiment_evaluations` from `src/phoenix/server/api/routers/v1/experiment_evaluations.py`.

The TypeScript client already wraps most of this flow for normal task experiments in `js/packages/phoenix-client/src/experiments/runExperiment.ts`, but PXI tests should use direct REST calls or small wrappers because the task is an already-completed browser interaction, not a function that the experiment runner owns.

## Harness Architecture

Add a PXI-specific Playwright fixture under `app/tests/pxi/`.

```ts
import { test as base } from "@playwright/test";

export const test = base.extend<{
  phoenix: PhoenixE2EApp;
  pxi: PxiDriver;
}>({
  phoenix: async ({}, use, testInfo) => {
    const app = await startPhoenixForPxiTest(testInfo);
    await use(app);
    await app.stop();
  },
  pxi: async ({ page, phoenix }, use, testInfo) => {
    const driver = new PxiDriver({ page, phoenix, testInfo });
    await use(driver);
    await driver.attachArtifactsOnFailure();
  },
});
```

`PhoenixE2EApp` should encapsulate server lifecycle and API access.

```ts
type PhoenixE2EApp = {
  baseURL: string;
  databaseURL: string;
  api: PhoenixApiClient;
  seed(seed: PxiSeedSpec): Promise<PxiSeedResult>;
  logs(): Promise<string[]>;
  stop(): Promise<void>;
};
```

The first implementation can reuse the existing Playwright `webServer` path when practical, but the target state should be a per-worker Phoenix server so PXI tests can opt into LLM credentials, isolated DB paths, and seed scripts without affecting the rest of `app/tests`.

## Skill Layer

The PXI E2E workflow should also be packaged as an agent skill, but the skill should complement the concrete harness rather than replace it.

The harness is required for deterministic runtime behavior: starting Phoenix, isolating SQLite, seeding data, driving Playwright, observing PXI turns, judging outcomes, persisting experiment records, and collecting artifacts. A skill cannot provide those guarantees by itself because tests still need importable code that runs in CI without an agent interpreting instructions.

The skill should provide the authoring layer: reusable guidance, templates, examples, and scaffolding scripts for humans or coding agents adding new PXI E2E scenarios.

Recommended skill name:

```txt
phoenix-pxi-playwright
```

Recommended location:

```txt
.agents/skills/phoenix-pxi-playwright/
```

Recommended structure:

```txt
.agents/skills/phoenix-pxi-playwright/
  SKILL.md
  resources/
    authoring-guide.md
    assertion-patterns.md
    seed-fixtures.md
    experiment-persistence.md
    debugging-failures.md
  templates/
    pxi-scenario.spec.ts
    pxi-seed.ts
    pxi-outcome-rubric.md
  scripts/
    scaffold-pxi-test.ts
```

The skill metadata should trigger when someone asks to add, update, debug, or review PXI Playwright tests.

```yaml
---
name: phoenix-pxi-playwright
description: Write, extend, and debug PXI Playwright E2E tests for Phoenix. Use when adding PXI agent frontend tests, authoring LLM-as-judge outcomes, creating seed fixtures, persisting PXI test runs as Phoenix experiments, or debugging PXI E2E failures.
---
```

`SKILL.md` should stay short and point to focused resources. It should instruct the agent to use the concrete harness under `app/tests/pxi/`, not to generate bespoke Playwright infrastructure in each test.

The skill should include:

- How to choose `real`, `recorded`, or `stubbed` LLM mode.
- How to choose or create a seed fixture.
- How to write deterministic assertions before judge assertions.
- How to write a rubric for `assertOutcome()`.
- How to persist a run as a Phoenix experiment.
- How to inspect artifacts and experiment records after failure.
- What PXI internals matter: `POST /chat`, `buildAgentChatRequestBody`, `agentStore`, `resolve_tools`, and frontend tool dispatch.

The skill should not include:

- A separate implementation of `PxiDriver`.
- A duplicate experiment client.
- Duplicated PXI tool schemas.
- Instructions that ask agents to bypass the shared harness.

The intended split is:

```txt
app/tests/pxi/*
  Runtime code used by Playwright, CI, and humans.

.agents/skills/phoenix-pxi-playwright/*
  Authoring workflow used by coding agents and teammates.
```

Example skill-driven workflow:

1. User asks: “Add a PXI E2E test for explaining trace errors.”
2. The skill loads and tells the agent to inspect available seed fixtures.
3. The agent scaffolds a test from `templates/pxi-scenario.spec.ts`.
4. The test imports the shared `test` fixture and uses `pxi.askAndWait()`, `pxi.expectToolCalled()`, and `pxi.assertOutcome()`.
5. The test persists its result through `pxi.persistExperiment()`.
6. The agent runs the relevant Playwright command and reports experiment IDs or artifacts.

## Phoenix Startup

The harness should start Phoenix with an isolated SQLite database.

Use a temporary file-backed SQLite database by default rather than literal `sqlite:///:memory:`. A file-backed DB is still isolated and disposable, but it avoids cross-process visibility issues if the test runner, seed script, and Phoenix server do not share a process.

```ts
type PhoenixStartupOptions = {
  database: "temp-sqlite" | { sqlitePath: string };
  seedScript?: string;
  seedDatabasePath?: string;
  env?: Record<string, string>;
};
```

Set environment variables explicitly.

```txt
PHOENIX_SQL_DATABASE_URL=sqlite:////tmp/pxi-e2e/worker-0/phoenix.db
PHOENIX_AGENTS_ASSISTANT_PROJECT_NAME=pxi-e2e-agent-{workerIndex}
PHOENIX_DISABLE_RATE_LIMIT=True
```

LLM credentials should be opt-in per run.

```txt
PXI_E2E_ASSISTANT_PROVIDER=OPENAI
PXI_E2E_ASSISTANT_MODEL=gpt-4.1-mini
PXI_E2E_JUDGE_PROVIDER=OPENAI
PXI_E2E_JUDGE_MODEL=gpt-4.1
OPENAI_API_KEY=...
```

The harness should skip real-LLM tests when required credentials are absent unless the test explicitly uses a stubbed or recorded mode.

## LLM Modes

PXI E2E tests need multiple reliability profiles.

```ts
type PxiLlmMode = "real" | "recorded" | "stubbed";
```

- `real`: use the selected built-in or custom model through `POST /chat`; best for nightly runs and release-blocking smoke tests.
- `recorded`: replay a captured data stream or model/tool trajectory; best for deterministic CI checks around UI and protocol behavior.
- `stubbed`: route `POST /chat` or the model provider to a deterministic response; best for frontend stream/tool-dispatch tests.

The first pass should support `real` and leave clear seams for `recorded` and `stubbed`.

## PXI Driver API

`PxiDriver` should wrap user-visible actions and PXI-specific assertions.

```ts
class PxiDriver {
  seed(seed: PxiSeedSpec): Promise<PxiSeedResult>;
  gotoProject(projectIdOrName: string): Promise<void>;
  gotoTrace(traceId: string): Promise<void>;
  gotoSpan(spanId: string): Promise<void>;

  open(): Promise<void>;
  close(): Promise<void>;
  setModel(config: PxiModelConfig): Promise<void>;
  acknowledgeConsent(): Promise<void>;

  sendMessage(message: string): Promise<void>;
  waitForTurn(): Promise<PxiTurn>;
  askAndWait(message: string): Promise<PxiTurn>;

  messages(): Promise<PxiMessage[]>;
  latestAssistantMessage(): Promise<string>;

  enumerateTools(): Promise<PxiToolDefinition[]>;
  expectToolCalled(name: string | RegExp): Promise<void>;
  expectToolSequence(names: Array<string | RegExp>): Promise<void>;
  expectNoAgentError(): Promise<void>;

  assertOutcome(expectation: PxiOutcomeExpectation): Promise<PxiOutcomeAssertion>;
  persistExperiment(record?: Partial<PxiExperimentRecord>): Promise<PxiPersistedExperiment>;
}
```

`waitForTurn()` should wait for state, not time. It should observe that the submitted user message is rendered, the assistant has finished streaming, the `Thinking...` loading affordance is gone, there is no inline chat error, and any visible elicitation state is resolved or reported.

```ts
type PxiTurn = {
  userMessage: string;
  assistantText: string;
  toolCalls: PxiToolCall[];
  toolResults: PxiToolResult[];
  errors: PxiError[];
  request?: PxiChatRequestSnapshot;
  responseMetadata?: unknown;
  durationMs: number;
};
```

The initial implementation can parse `AgentUIMessage.parts` from local storage or from an exposed test hook. A more robust implementation should add test-only instrumentation that records each PXI request, streamed assistant parts, tool calls, and tool outputs without relying on DOM text alone.

`enumerateTools()` cannot be implemented reliably from the visible DOM today. It should come from instrumentation around the chat request/response path or a test-only server debug surface that captures the `ToolDefinition`s resolved by `src/phoenix/server/agents/tools/registry.py` for the current contexts.

## Test Instrumentation

The current UI does not expose all data that good PXI tests need. Add lightweight test-only instrumentation guarded by `import.meta.env.MODE === "test"` or an equivalent Playwright env flag.

Expose a browser-global collector such as:

```ts
window.__PXI_E2E__ = {
  requests: [],
  turns: [],
  toolCalls: [],
  toolResults: [],
  contexts: [],
};
```

Recommended hooks:

- In `buildAgentChatRequestBody`, record the outgoing `contexts`, `capabilities`, `sessionId`, `ingestTraces`, and model URL.
- In `handleRegisteredAgentToolCall`, record raw tool calls, parse errors, capability errors, handler errors, and successful tool outputs.
- In `useAgentChat` `onFinish`, record final messages and assistant metadata.

This preserves production behavior while making tests reliable and inspectable.

## Outcome Assertion

`assertOutcome()` should be LLM-as-judge in the first pass. It should still run alongside deterministic assertions for tool usage and absence of agent errors.

```ts
await pxi.expectToolCalled("set_spans_filter");
await pxi.expectNoAgentError();

await pxi.assertOutcome({
  name: "latency-root-cause",
  rubric: `
    The assistant identifies the slowest span as the root cause of latency.
    It cites evidence from the trace or visible Phoenix context.
    It does not invent services, spans, or errors that are not present.
  `,
  scoreThreshold: 0.8,
});
```

The judge input should include the dataset example input, expected output if provided, page URL, PXI transcript, advertised/observed tools, tool results, and UI context snapshot.

```ts
type PxiOutcomeExpectation = {
  name: string;
  rubric: string;
  scoreThreshold?: number;
  mustMention?: string[];
  mustNotMention?: string[];
  mustUseTools?: string[];
  metadata?: Record<string, unknown>;
};

type PxiOutcomeAssertion = {
  passed: boolean;
  label: "pass" | "fail";
  score: number;
  explanation: string;
  evidence: string[];
  metadata: Record<string, unknown>;
};
```

The judge model must be stored separately from the PXI model under test.

```ts
type PxiModelConfig = {
  assistantProvider: string;
  assistantModel: string;
  judgeProvider: string;
  judgeModel: string;
};
```

## Persisting As Phoenix Experiments

Each PXI test case should map to one Phoenix dataset example. Each Playwright execution should map to one experiment run and one LLM evaluation annotation.

Dataset name:

```txt
PXI E2E Agent Tests
```

Example ID:

```txt
{suiteName}:{testName}:{fixtureName}:{scenarioVersion}
```

Example shape:

```ts
type PxiDatasetExample = {
  id: string;
  input: {
    prompt: string;
    route: string;
    seed: string;
    scenario: string;
  };
  output: {
    rubric: string;
  };
  metadata: {
    suite: string;
    test: string;
    fixture: string;
    version: string;
  };
};
```

Persist flow:

1. Upsert the dataset with `POST /v1/datasets/upload?sync=true`, using `action: "update"` and stable `example_ids`.
2. Fetch examples from `GET /v1/datasets/{id}/examples` to resolve the `DatasetExample` GlobalID needed by experiment runs.
3. Create the experiment with `POST /v1/datasets/{dataset_id}/experiments`.
4. Create a run with `POST /v1/experiments/{experiment_id}/runs`.
5. Upsert the judge result with `POST /v1/experiment_evaluations`.

Experiment naming:

```txt
pxi-e2e-{branch}-{sha}
pxi-e2e-nightly-{date}
pxi-e2e-local-{user}-{timestamp}
```

Experiment metadata:

```ts
type PxiExperimentMetadata = {
  kind: "pxi-playwright-e2e";
  branch?: string;
  gitSha?: string;
  playwrightProject: string;
  assistantProvider: string;
  assistantModel: string;
  judgeProvider: string;
  judgeModel: string;
  seedDatabase?: string;
  seedScript?: string;
};
```

Experiment run output:

```ts
type PxiExperimentRunOutput = {
  prompt: string;
  assistantText: string;
  transcript: PxiMessage[];
  toolCalls: PxiToolCall[];
  toolResults: PxiToolResult[];
  contexts: unknown[];
  capabilities: Record<string, boolean>;
  url: string;
  durationMs: number;
  artifacts: Record<string, string>;
};
```

Evaluation result:

```ts
{
  name: "pxi_outcome",
  annotator_kind: "LLM",
  result: {
    label: assertion.passed ? "pass" : "fail",
    score: assertion.score,
    explanation: assertion.explanation,
  },
  metadata: {
    rubric: expectation.rubric,
    evidence: assertion.evidence,
    judgeModel,
  },
}
```

The test should be allowed to fail after persistence. If `assertOutcome()` fails, the experiment run and failed evaluation are more valuable when they are still recorded.

## Seed Fixtures

Seed fixtures should be scenario-oriented instead of table-oriented.

```txt
empty-project
project-with-traces
trace-with-slow-span
trace-with-error
project-with-span-filterable-traces
dataset-with-experiments
```

Each seed should return stable handles.

```ts
type PxiSeedResult = {
  fixture: string;
  projectId?: string;
  projectName?: string;
  traceId?: string;
  spanId?: string;
  datasetId?: string;
  metadata: Record<string, unknown>;
};
```

Seed scripts can either copy a prepared SQLite DB into the worker temp directory or run a script against `PHOENIX_SQL_DATABASE_URL` before the server starts.

## Example Test

```ts
import { test } from "./pxi";

test("PXI explains trace latency", async ({ pxi }) => {
  const seed = await pxi.seed("trace-with-slow-span");

  await pxi.gotoTrace(seed.traceId);
  await pxi.open();
  await pxi.acknowledgeConsent();

  const turn = await pxi.askAndWait("Why is this trace slow?");

  await pxi.expectNoAgentError();
  await pxi.expectToolCalled(/bash|set_spans_filter/);

  const assertion = await pxi.assertOutcome({
    name: "latency-root-cause",
    rubric: `
      The assistant should identify the slowest span and explain that it dominates trace latency.
      The answer should cite evidence from the trace or UI context.
      The answer should not claim that no trace is selected.
    `,
    scoreThreshold: 0.8,
    metadata: { traceId: seed.traceId },
  });

  await pxi.persistExperiment({ assertion, turn });
});
```

The exact expected tool names should be scenario-specific. Today, `set_spans_filter` is the only contextual PXI tool in the checked code, while `ask_user` and `bash` are always advertised external tools.

## Debug Artifacts

On failure, the harness should attach:

- Playwright trace.
- Browser console logs.
- Network failures and failed `POST /chat` responses.
- Phoenix server logs.
- PXI request body snapshots.
- Streamed PXI message snapshots.
- Tool calls and tool outputs.
- Active route contexts and mounted contexts.
- Experiment IDs, run IDs, and evaluation IDs when persistence succeeded.

## Implementation Plan

1. Add `app/tests/pxi/fixtures.ts` with `PhoenixE2EApp` and `PxiDriver` fixtures.
2. Add per-worker Phoenix startup with temp file-backed SQLite and env injection.
3. Add seed fixture convention and one `trace-with-slow-span` seed.
4. Add test-only PXI instrumentation for request, turn, tool, and context snapshots.
5. Implement `open`, `acknowledgeConsent`, `sendMessage`, `waitForTurn`, `askAndWait`, `expectNoAgentError`, and transcript extraction.
6. Implement `assertOutcome()` with a configured judge model and structured JSON output.
7. Implement experiment persistence through the existing REST endpoints.
8. Add one real-LLM smoke test and one deterministic/stubbed harness test.

## Open Questions

- Should PXI E2E tests live in the normal `app/tests` Playwright project or in a separate project that only runs on demand/nightly because it requires LLM credentials?
- Should experiment persistence go to the same isolated Phoenix instance under test, or optionally to a long-lived Phoenix instance for trend tracking across CI runs?
- Should test-only PXI instrumentation be browser-global, or should it be exposed through a small app-level testing provider to avoid globals?
- Should `recorded` mode replay the full AI SDK data stream, or should it stub at the model provider layer before the stream protocol?
