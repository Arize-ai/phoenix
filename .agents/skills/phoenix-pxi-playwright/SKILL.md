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
- Reuse the generic AI SDK judge from `app/tests/pxi/judge.ts`.
- Reuse experiment persistence from `app/tests/pxi/experimentPersistence.ts`.
- Do not create a bespoke PXI driver, duplicate experiment client, or duplicate PXI tool schemas in a spec.

## Current Harness

The current harness provides these abstractions:

- `test` and `expect` from `./fixtures`: PXI-aware Playwright fixture exports.
- `pxi.open({ userInstructions })`: opens PXI with optional user instructions.
- `pxi.acknowledgeConsent()`: accepts PXI consent for the test session.
- `pxi.askAndWait(prompt)`: sends a user prompt and waits for the assistant turn.
- `pxi.expectNoAgentError()`: asserts the visible PXI session did not surface an agent error.
- `pxi.expectDocsToolCalled(turn)`: asserts the PXI turn used runtime docs tooling via Phoenix-observed tool spans.
- `pxi.getMetadata()`: collects PXI metadata for persistence.
- `judge({ model, system, prompt, assistantText, rubric })`: evaluates an assistant answer with AI SDK `generateText` and structured `Output.object`.
- `persistPxiExperiment({ request, record })`: stores the PXI interaction, judge result, and metadata as a Phoenix experiment.

## Authoring Workflow

1. Put the scenario prompt, PXI user instructions, and judge rubric in the spec file so the test is readable top-to-bottom.
2. Drive PXI through the real UI with `pxi.open`, `pxi.acknowledgeConsent`, and `pxi.askAndWait`.
3. Add deterministic assertions before judge assertions, such as expected text, no agent error, or expected tool use.
4. Use `judge` for semantic outcome checks only after deterministic assertions pass.
5. Persist the run with `persistPxiExperiment` so failures and quality drift can be inspected in Phoenix.
6. Run the targeted spec with isolated ports before reporting success.

## Spec Pattern

```ts
import { persistPxiExperiment } from "./experimentPersistence";
import { expect, test } from "./fixtures";
import { getRequiredJudgeApiKeyEnv, judge } from "./judge";

const AGENT_USER_INSTRUCTIONS = "Use the relevant Phoenix tools for this task.";
const USER_PROMPT = "Ask PXI to do one user-visible task.";
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

    await pxi.open({ userInstructions: AGENT_USER_INSTRUCTIONS });
    await pxi.acknowledgeConsent();

    const turn = await pxi.askAndWait(USER_PROMPT);
    await pxi.expectNoAgentError();
    expect(turn.assistantText).toContain("deterministic expected text");

    const judgeResult = await judge({
      system: "You are judging a Phoenix PXI E2E answer.",
      prompt: USER_PROMPT,
      assistantText: turn.assistantText,
      rubric: JUDGE_RUBRIC,
    });

    await persistPxiExperiment({
      request,
      record: {
        prompt: USER_PROMPT,
        assistantText: turn.assistantText,
        calledTools: turn.calledTools,
        url: page.url(),
        durationMs: turn.durationMs,
        judgeResult,
        playwrightProject: testInfo.project.name,
        ...pxi.getMetadata(),
      },
    });

    expect(judgeResult.label, judgeResult.explanation).toBe("pass");
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
- Persist the complete test record: prompt, assistant text, called tools, duration, judge result, Playwright project, URL, and PXI metadata.

## Extending The Harness

If `fixtures.ts`, `judge.ts`, or `experimentPersistence.ts` do not satisfy a testing use case, use [`internal_docs/pxi_playwright_e2e_harness.md`](../../../internal_docs/pxi_playwright_e2e_harness.md) as the design guide for extending the harness, utilities, and this skill together. That internal doc describes the intended architecture for richer PXI drivers, seed fixtures, LLM modes, outcome assertions, experiment persistence, and debugging artifacts.

Prefer small harness extensions that make future specs simpler. Do not add one-off logic to an individual spec if it should be reusable across PXI E2E scenarios.

## Keep This Skill Fresh

When a session creates new PXI Playwright capabilities, discovers a reliable assertion pattern, changes judge behavior, adds seed fixtures, or learns a debugging technique, update this skill in the same branch. Future developers and agents should not have to rediscover branch-specific harness behavior.
