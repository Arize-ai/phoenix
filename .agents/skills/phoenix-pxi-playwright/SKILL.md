---
name: phoenix-pxi-playwright
description: Write, extend, and debug PXI Playwright E2E tests for Phoenix. Use when adding PXI agent frontend specs, authoring LLM-as-judge rubrics, asserting PXI tool use, persisting PXI test runs as Phoenix experiments, or debugging PXI E2E failures.
metadata:
  internal: true
---

# Phoenix PXI Playwright Tests

Use this skill when authoring or maintaining Playwright specs for PXI, Phoenix's built-in AI assistant. The concrete harness lives in `app/tests/pxi/`; this skill is the authoring guide for using and extending that harness.

## Start Here

- Read the existing example spec first: `app/tests/pxi/docs-smoke.spec.ts`.
- Reuse the shared fixture and driver from `app/tests/pxi/fixtures.ts`.
- Reuse shared constants from `app/tests/pxi/constants.ts` and shared types from `app/tests/pxi/types.ts`.
- Put pure parsing/API helpers in `app/tests/pxi/utils.ts` rather than in specs or fixture classes.
- Reuse the generic AI SDK judge from `app/tests/pxi/judge.ts`.
- Reuse experiment persistence from `app/tests/pxi/experimentPersistence.ts`.
- Add one entry to `PXI_EXPERIMENT_EXAMPLES` in `app/tests/pxi/experimentPersistence.ts` for every new PXI spec scenario. All specs share the same dataset, and the update upload treats that registry as the complete desired set of examples.
- Do not create a bespoke PXI driver, duplicate experiment client, or duplicate PXI tool schemas in a spec.

## Current Harness

The current harness provides these abstractions:

- `test` and `expect` from `./fixtures`: PXI-aware Playwright fixture exports.
- `constants.ts`: default assistant and judge model/project constants.
- `types.ts`: shared PXI harness types such as `PxiTurn`.
- `utils.ts`: pure utilities for API response validation and span/tool parsing.
- `pxi.open()`: opens PXI for the test session.
- `pxi.acknowledgeConsent()`: accepts PXI consent for the test session.
- `pxi.askAndWait(prompt)`: sends a user prompt and waits for the assistant turn. It does not require a backend TOOL span; add explicit tool assertions in the spec.
- `pxi.expectNoAgentError()`: asserts the visible PXI session did not surface an agent error.
- `pxi.expectBackendToolSpanCalled(turn)`: asserts the PXI turn produced at least one persisted backend TOOL span and merges those backend tool names into `turn.calledTools`. Use this for server/MCP-backed tools such as docs tools, not for purely client-executed external tools.
- `pxi.expectDocsToolCalled(turn)`: asserts the PXI turn used runtime docs tooling via Phoenix-observed tool spans.
- `pxi.getMetadata()`: collects PXI metadata for persistence.
- `judge({ model, system, prompt, assistantText, rubric })`: evaluates an assistant answer with AI SDK `generateText` and structured `Output.object`.
- `evaluatePxiOutcome({ assertions, judgeInput })`: runs deterministic assertions and LLM judging while preserving failed post-turn outcomes for experiment persistence.
- `assertPxiOutcome(outcome)`: fails the Playwright test after persistence, preferring the original deterministic assertion failure when one exists.
- `persistPxiExperiment({ request, record })`: stores the PXI interaction, judge result, and metadata as a Phoenix experiment.

## Authoring Workflow

1. Add the scenario prompt and expected output to `PXI_EXPERIMENT_EXAMPLES` so the shared PXI E2E dataset gets one example per test scenario.
2. Put the scenario prompt, PXI user instructions, and judge rubric in the spec file so the test is readable top-to-bottom. Import the scenario from `PXI_EXPERIMENT_EXAMPLES` rather than duplicating prompt strings.
3. Drive PXI through the real UI with `pxi.open`, `pxi.acknowledgeConsent`, and `pxi.askAndWait`.
4. Add deterministic assertions before judge assertions, such as expected text, no agent error, or expected tool use.
5. Put all post-turn deterministic assertions inside `evaluatePxiOutcome`, including `pxi.expectBackendToolSpanCalled(turn)`, so failures after PXI returns an answer still get persisted.
6. After `pxi.askAndWait` returns a turn, persist both passing and failing outcomes. Do not let deterministic assertion failures skip experiment persistence.
7. Use `evaluatePxiOutcome` instead of writing per-spec `try/catch` blocks. It runs `judge` even when deterministic Playwright assertions fail, then combines the judge explanation with a sanitized, truncated Playwright assertion message in the persisted failed evaluation.
8. Run the targeted spec with isolated ports before reporting success.

## Spec Pattern

```ts
import {
  persistPxiExperiment,
  PXI_EXPERIMENT_EXAMPLES,
} from "./experimentPersistence";
import { expect, test } from "./fixtures";
import { getRequiredJudgeApiKeyEnv } from "./judge";
import { assertPxiOutcome, evaluatePxiOutcome } from "./outcome";

const EXPERIMENT_EXAMPLE = PXI_EXPERIMENT_EXAMPLES.someScenario;
const USER_PROMPT = EXPERIMENT_EXAMPLE.prompt;
const JUDGE_RUBRIC = [
  "The answer satisfies the user request.",
  "The answer is grounded in the expected Phoenix context.",
  "The answer does not invent unsupported facts.",
];
const JUDGE_API_KEY_ENV = getRequiredJudgeApiKeyEnv();

test.describe("PXI scenario", () => {
  test("handles the scenario", async ({
    browserName,
    page,
    pxi,
    request,
  }, testInfo) => {
    test.skip(
      browserName !== "chromium",
      "PXI real-LLM smoke runs once in chromium."
    );
    test.skip(
      process.env.PXI_E2E !== "true",
      "Set PXI_E2E=true to run PXI E2E tests."
    );
    test.skip(
      !process.env.OPENAI_API_KEY,
      "OPENAI_API_KEY is required for the PXI assistant."
    );
    test.skip(
      !process.env[JUDGE_API_KEY_ENV],
      `${JUDGE_API_KEY_ENV} is required for the PXI E2E judge.`
    );

    await pxi.open();
    await pxi.acknowledgeConsent();

    const turn = await pxi.askAndWait(USER_PROMPT);
    const outcome = await evaluatePxiOutcome({
      assertions: async () => {
        await pxi.expectNoAgentError();
        // For server/MCP-backed tools only. Client-executed external tools can
        // be asserted through visible tool UI or final app state instead.
        await pxi.expectBackendToolSpanCalled(turn);
        expect(turn.assistantText).toContain("deterministic expected text");
      },
      judgeInput: {
        system: "You are judging a Phoenix PXI E2E answer.",
        prompt: USER_PROMPT,
        assistantText: turn.assistantText,
        rubric: JUDGE_RUBRIC,
      },
    });

    await persistPxiExperiment({
      request,
      record: {
        example: EXPERIMENT_EXAMPLE,
        assistantText: turn.assistantText,
        calledTools: turn.calledTools,
        url: page.url(),
        durationMs: turn.durationMs,
        judgeResult: outcome.judgeResult,
        playwrightProject: testInfo.project.name,
        ...pxi.getMetadata(),
      },
    });

    assertPxiOutcome(outcome);
  });
});
```

## Judge Models

- Pass judge models as `provider/model` strings.
- Default: `openai/gpt-4.1` via `PXI_E2E_JUDGE_MODEL` fallback.
- Supported providers are currently `openai` and `anthropic`.
- `openai/...` requires `OPENAI_API_KEY`.
- `anthropic/...` requires `ANTHROPIC_API_KEY`.
- The judge must use AI SDK 6 structured output idioms: `generateText` with `Output.object({ schema })`. Do not use deprecated `generateObject`.

## Running Specs

Use isolated ports to avoid collisions with a local Phoenix dev server:

```bash
pnpm run test:e2e:pxi
```

Real PXI specs require external model credentials. Keep tests skipped by default unless `PXI_E2E=true` is set.

## Experiment Persistence

- Persistence defaults to `http://localhost:6006` so real E2E runs can be inspected in the developer's local Phoenix instance.
- Override with `PXI_E2E_EXPERIMENT_BASE_URL`.
- Use `PXI_E2E_EXPERIMENT_BEARER_TOKEN` only when persisting to an authenticated Phoenix target.
- All PXI specs share the `PXI E2E Agent Tests` dataset. `persistPxiExperiment` uploads every entry in `PXI_EXPERIMENT_EXAMPLES` using `action: "update"`, so adding or removing an entry updates the dataset examples declaratively.
- Every new PXI spec must add one `PXI_EXPERIMENT_EXAMPLES` entry with a stable `id`, prompt, expected output, experiment name prefix, and experiment description, then pass that entry as `record.example`.
- Persist the complete test record: prompt, assistant text, called tools, duration, judge result, Playwright project, URL, and PXI metadata.
- Persist failed post-turn outcomes too. If PXI returned an answer, the experiment run should exist even when deterministic assertions or judge checks fail.
- Let `evaluatePxiOutcome` strip ANSI escape sequences and truncate Playwright assertion messages before they are added to `judgeResult.explanation`; raw Playwright error messages are terminal-formatted and too noisy for Phoenix experiment tables.

## Tool Assertions

- Use `pxi.expectBackendToolSpanCalled(turn)` when the scenario requires a server-observed backend TOOL span. Keep the call inside `evaluatePxiOutcome`.
- Use `pxi.expectDocsToolCalled(turn)` after `pxi.expectBackendToolSpanCalled(turn)` for docs scenarios because it checks the backend tool names merged into `turn.calledTools`.
- Do not require backend TOOL spans for client-executed external tools such as UI control tools. Assert their visible tool chips, tool result text, or the resulting app state instead.

## Extending The Harness

If `fixtures.ts`, `judge.ts`, or `experimentPersistence.ts` do not satisfy a testing use case, use [`internal_docs/pxi_playwright_e2e_harness.md`](../../../internal_docs/pxi_playwright_e2e_harness.md) as the design guide for extending the harness, utilities, and this skill together. That internal doc describes the intended architecture for richer PXI drivers, seed fixtures, LLM modes, outcome assertions, experiment persistence, and debugging artifacts.

Prefer small harness extensions that make future specs simpler. Do not add one-off logic to an individual spec if it should be reusable across PXI E2E scenarios.

## Keep This Skill Fresh

When a session creates new PXI Playwright capabilities, discovers a reliable assertion pattern, changes judge behavior, adds seed fixtures, or learns a debugging technique, update this skill in the same branch. Future developers and agents should not have to rediscover branch-specific harness behavior.
