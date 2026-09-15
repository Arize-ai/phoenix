import type { APIRequestContext, Page } from "@playwright/test";

import {
  persistPxiExperiment,
  PXI_EXPERIMENT_EXAMPLES,
} from "./experimentPersistence";
import { expect, test } from "./fixtures";
import { getRequiredJudgeApiKeyEnv } from "./judge";
import { assertPxiOutcome, evaluatePxiOutcome } from "./outcome";
import { expectOK } from "./utils";

const EXPERIMENT_EXAMPLE = PXI_EXPERIMENT_EXAMPLES.playgroundEvaluatorSmoke;
const USER_PROMPT = EXPERIMENT_EXAMPLE.prompt;

const JUDGE_RUBRIC = [
  "The assistant made a playground instance a code evaluator task (through playground.task.select or playground.instance.add) instead of opening an evaluator form dialog.",
  "The assistant ran the evaluator over the dataset with playground.run and read the results with playground.experiment.readResults.",
  "The answer reports how many examples passed and how many failed, consistent with two non-empty and one empty output.",
  "The answer does not claim to have saved the evaluator or recorded expected outputs, since the user asked for neither.",
];

const JUDGE_SYSTEM =
  "You are judging a Phoenix PXI E2E answer about running a code evaluator task in the playground. Return a label, score, and brief explanation.";

/** Three examples: two with a non-empty output, one with an empty output. */
const DATASET_EXAMPLES = [
  { input: { question: "What is 2 + 2?" }, output: { answer: "4" } },
  { input: { question: "Name a primary color." }, output: { answer: "Red" } },
  {
    input: { question: "What is the capital of France?" },
    output: { answer: "" },
  },
];

/**
 * A dataset for the evaluator to judge and a WASM sandbox for it to run in.
 * Both are created through the API so the test does not depend on seeded
 * data; the dataset name is unique per run so reruns do not collide.
 */
async function seedEvaluatorRun(request: APIRequestContext) {
  const suffix = new Date().toISOString().replace(/[:.]/g, "-");
  const datasetResponse = await expectOK(
    await request.post("/v1/datasets/upload?sync=true", {
      data: {
        action: "create",
        name: `pxi-evaluator-smoke-${suffix}`,
        description: "PXI evaluator task smoke test dataset.",
        inputs: DATASET_EXAMPLES.map((example) => example.input),
        outputs: DATASET_EXAMPLES.map((example) => example.output),
      },
    })
  );
  const datasetId = (datasetResponse.data as { dataset_id?: unknown })
    .dataset_id;
  if (typeof datasetId !== "string") {
    throw new Error("Dataset upload response did not include dataset_id.");
  }
  // The New Sandbox dropdown filters on AVAILABLE providers; the test server
  // pre-warms the WASM binary so this config is runnable without credentials.
  await expectOK(
    await request.post("/graphql", {
      data: {
        query: `
          mutation PxiEvaluatorSmokeSandbox($input: CreateSandboxConfigInput!) {
            createSandboxConfig(input: $input) {
              sandboxConfig {
                id
              }
            }
          }
        `,
        variables: {
          input: {
            name: `pxi-smoke-wasm-${suffix}`,
            config: { wasm: { language: "PYTHON" } },
          },
        },
      },
    })
  );
  return { datasetId };
}

/**
 * Accepts every write-script approval PXI proposes until the turn ends.
 * The fixture's assistant runs in manual edit mode, so each
 * `execute_browser_action` script with writes waits on an Accept.
 */
async function acceptScriptsUntilTurnEnds(page: Page) {
  const stopButton = page.getByRole("button", { name: "Stop generation" });
  await stopButton.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {
    // The turn may already have completed.
  });
  const deadline = Date.now() + 240_000;
  while (Date.now() < deadline) {
    if (!(await stopButton.isVisible())) {
      return;
    }
    const accept = page.getByRole("button", { name: "Accept" }).first();
    if (await accept.isVisible()) {
      await accept.click();
    }
    await page.waitForTimeout(500);
  }
  throw new Error("Timed out waiting for the PXI turn to finish.");
}

/**
 * Playground evaluator task smoke test: PXI turns a playground instance into
 * a code evaluator task, runs it over a dataset as an experiment, and reads
 * the results, all through the instance-addressed playground operations.
 */
test.describe("PXI playground evaluator task smoke", () => {
  test("selects a code evaluator task, runs it over the dataset, and reads results", async ({
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
    const judgeApiKeyEnv = getRequiredJudgeApiKeyEnv();
    test.skip(
      !process.env.OPENAI_API_KEY,
      "OPENAI_API_KEY is required for the PXI assistant."
    );
    test.skip(
      !process.env[judgeApiKeyEnv],
      `${judgeApiKeyEnv} is required for the PXI E2E judge.`
    );
    test.skip(
      (process.env.PXI_E2E_ASSISTANT_PROVIDER ?? "OPENAI") !== "OPENAI",
      "This PXI E2E smoke test currently supports OPENAI assistant runs."
    );

    await pxi.open();
    await pxi.acknowledgeConsent();
    const { datasetId } = await seedEvaluatorRun(request);

    // Open the playground on the dataset; pxi.open() left the page on /projects.
    await page.goto(`/playground?datasetId=${encodeURIComponent(datasetId)}`);
    await page.waitForURL("**/playground**");
    await expect(
      page.getByRole("button", { name: /run/i }).first()
    ).toBeVisible();
    // The playground and dataset contexts register with the agent store.
    await page.waitForTimeout(500);

    // Navigation closed the panel; reopen it (consent may show again).
    await page.getByRole("button", { name: "Open agent chat" }).click();
    const messageInput = page.getByLabel("Message input");
    const acknowledgeButton = page.getByRole("button", { name: "Acknowledge" });
    await expect(messageInput.or(acknowledgeButton)).toBeVisible();
    if (await acknowledgeButton.isVisible()) {
      await acknowledgeButton.click();
      await expect(messageInput).toBeVisible();
    }

    const startedAt = Date.now();
    await messageInput.fill(USER_PROMPT);
    await page.getByRole("button", { name: "Send message" }).click();
    await acceptScriptsUntilTurnEnds(page);
    const turn = await pxi.getLatestAssistantTurn();
    const durationMs = Date.now() - startedAt;

    const outcome = await evaluatePxiOutcome({
      assertions: async () => {
        await pxi.expectNoAgentError();
        // The page's first task is now an evaluator: its panel is titled
        // "Evaluators" and the evaluator column header shows the task's
        // expected-output count.
        await expect(
          page.getByRole("heading", { name: "Evaluators" })
        ).toBeVisible();
        await expect(page.getByText(/with expected/).first()).toBeVisible();
        // Every example was judged.
        await expect(page.getByText("Evaluated").first()).toBeVisible();
        expect(turn.assistantText).toMatch(/2|two/i);
      },
      judgeInput: {
        system: JUDGE_SYSTEM,
        prompt: USER_PROMPT,
        assistantText: turn.assistantText,
        rubric: JUDGE_RUBRIC,
      },
    });

    const metadata = pxi.getMetadata();
    await persistPxiExperiment({
      request,
      record: {
        example: EXPERIMENT_EXAMPLE,
        assistantText: turn.assistantText,
        calledTools: turn.calledTools,
        url: page.url(),
        durationMs,
        judgeResult: outcome.judgeResult,
        playwrightProject: testInfo.project.name,
        ...metadata,
      },
    });

    assertPxiOutcome(outcome);
  });
});
