import { randomUUID } from "crypto";
import type {
  APIRequestContext,
  Locator,
  Page,
  Response,
} from "@playwright/test";

import {
  assertEfficientEvaluatorDraftCalibration,
  EVALUATOR_DRAFT_BASELINES,
} from "./evaluatorDraftTrajectory";
import {
  persistPxiExperiment,
  PXI_EXPERIMENT_EXAMPLES,
} from "./experimentPersistence";
import { expect, test } from "./fixtures";
import { getRequiredJudgeApiKeyEnv } from "./judge";
import { assertPxiOutcome, evaluatePxiOutcome } from "./outcome";

const CODE_DATASET_NAME = "PXI E2E Code Evaluator Batch Calibration";
const LLM_DATASET_NAME = "PXI E2E LLM Evaluator Batch Calibration";

function isGraphQLMutationResponse(response: Response, operationName: string) {
  return (
    response.url().includes("/graphql") &&
    response.status() === 200 &&
    (response.request().postData()?.includes(operationName) ?? false)
  );
}

async function seedDataset({
  request,
  name,
  inputs,
  outputs,
}: {
  request: APIRequestContext;
  name: string;
  inputs: Array<Record<string, unknown>>;
  outputs: Array<Record<string, unknown>>;
}): Promise<string> {
  const response = await request.post("/v1/datasets/upload?sync=true", {
    data: {
      action: "update",
      name,
      inputs,
      outputs,
      metadata: inputs.map(() => ({ kind: "pxi-evaluator-batch-fixture" })),
    },
  });
  if (!response.ok()) {
    throw new Error(
      `Dataset upload failed: ${response.status()} ${await response.text()}`
    );
  }
  const body = (await response.json()) as {
    data?: { dataset_id?: unknown };
  };
  const datasetId = body.data?.dataset_id;
  if (typeof datasetId !== "string") {
    throw new Error("Dataset upload response did not include dataset_id.");
  }
  return datasetId;
}

function selectTrigger(scope: Page | Locator, label: string): Locator {
  return scope.getByRole("button", {
    name: new RegExp(`\\b${label}(?:\\s*\\*)?\\s*$`),
  });
}

async function createPythonSandboxConfig(page: Page): Promise<string> {
  const configName = `pxi-batch-python-${randomUUID().slice(0, 8)}`;
  await page.goto("/settings/sandboxes");
  const providerRow = page
    .locator("table")
    .first()
    .locator("tbody tr")
    .filter({ has: page.getByRole("cell", { name: "Python", exact: true }) })
    .filter({ has: page.getByRole("switch", { name: "Enabled" }) })
    .first();
  await expect(providerRow).toBeVisible();
  const providerName = (
    await providerRow
      .locator("td")
      .first()
      .locator("span:not(:has(*))")
      .first()
      .textContent()
  )?.trim();
  expect(providerName).toBeTruthy();

  await page.getByRole("button", { name: "New Sandbox" }).click();
  const dialog = page.getByTestId("dialog");
  await selectTrigger(dialog, "Sandbox Provider").click();
  await page
    .getByRole("option", { name: new RegExp(providerName!) })
    .first()
    .click();
  await dialog.getByRole("textbox", { name: "Name" }).fill(configName);
  await Promise.all([
    page.waitForResponse((response) =>
      isGraphQLMutationResponse(
        response,
        "SandboxConfigDialogCreateSandboxConfigMutation"
      )
    ),
    dialog.getByRole("button", { name: "Create Config" }).click(),
  ]);
  await expect(dialog).not.toBeVisible();
  return configName;
}

function skipUnlessConfigured({ browserName }: { browserName: string }) {
  test.skip(
    browserName !== "chromium",
    "PXI real-LLM E2E runs once in chromium."
  );
  test.skip(
    process.env.PXI_E2E !== "true",
    "Set PXI_E2E=true to run PXI E2E tests."
  );
  const judgeApiKeyEnv = getRequiredJudgeApiKeyEnv();
  test.skip(!process.env.OPENAI_API_KEY, "OPENAI_API_KEY is required for PXI.");
  test.skip(
    !process.env[judgeApiKeyEnv],
    `${judgeApiKeyEnv} is required for the PXI E2E judge.`
  );
}

const JUDGE_SYSTEM =
  "You are judging whether PXI efficiently and correctly calibrated a Phoenix evaluator draft.";

test.describe.serial("PXI evaluator draft batch calibration", () => {
  test("calibrates a code evaluator with one multi-case preview", async ({
    browserName,
    page,
    pxi,
    request,
  }, testInfo) => {
    skipUnlessConfigured({ browserName });
    const datasetId = await seedDataset({
      request,
      name: CODE_DATASET_NAME,
      inputs: [{ task: "match" }, { task: "abstain" }, { task: "partial" }],
      outputs: [
        { expected_tools: ["search"] },
        { expected_tools: [] },
        { expected_tools: ["search", "calculator"] },
      ],
    });
    const sandboxName = await createPythonSandboxConfig(page);

    await pxi.open({
      editPermission: "bypass",
      path: `/playground?datasetId=${encodeURIComponent(datasetId)}`,
    });
    await pxi.acknowledgeConsent();
    await page.getByRole("button", { name: "Evaluators", exact: true }).click();
    await page
      .getByRole("menuitem", { name: "Create new code evaluator" })
      .click();
    const form = page.getByTestId("dialog");
    await expect(
      form.getByRole("heading", { name: "Create Code Evaluator" })
    ).toBeVisible();
    await selectTrigger(form, "Sandbox").click();
    await page.getByRole("option", { name: sandboxName }).click();

    const example = PXI_EXPERIMENT_EXAMPLES.codeEvaluatorBatchCalibration;
    const turn = await pxi.askAndWait(example.prompt);
    const outcome = await evaluatePxiOutcome({
      assertions: async () => {
        await pxi.expectNoAgentError();
        assertEfficientEvaluatorDraftCalibration({
          toolCalls: turn.toolCalls,
          testToolName: "test_code_evaluator_draft",
          baseline: EVALUATOR_DRAFT_BASELINES.code,
          expectedOutcomes: [
            { id: "single-tool-match", expectedText: "match" },
            { id: "correct-abstention", expectedText: "match" },
            {
              id: "partial-multi-tool-mismatch",
              expectedText: "mismatch",
            },
          ],
        });
      },
      judgeInput: {
        system: JUDGE_SYSTEM,
        prompt: example.prompt,
        assistantText: turn.assistantText,
        rubric: [
          "All three requested code-evaluator cases were tested.",
          "The reported match/mismatch outcomes are correct.",
          "PXI does not claim the evaluator was saved.",
        ],
      },
    });
    await persistPxiExperiment({
      request,
      record: {
        example,
        assistantText: turn.assistantText,
        transcript: turn.toolCalls,
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

  test("calibrates an LLM evaluator with one multi-case preview", async ({
    browserName,
    page,
    pxi,
    request,
  }, testInfo) => {
    skipUnlessConfigured({ browserName });
    const datasetId = await seedDataset({
      request,
      name: LLM_DATASET_NAME,
      inputs: [{ case: "exact" }, { case: "paraphrase" }, { case: "conflict" }],
      outputs: [
        { answer: "Paris is the capital of France." },
        { answer: "Paris is the capital of France." },
        { answer: "Paris is the capital of France." },
      ],
    });

    await pxi.open({
      editPermission: "bypass",
      path: `/playground?datasetId=${encodeURIComponent(datasetId)}`,
    });
    await pxi.acknowledgeConsent();
    await page.getByRole("button", { name: "Evaluators", exact: true }).click();
    await page
      .getByRole("menuitem", { name: "Create new LLM evaluator" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Create LLM Evaluator" })
    ).toBeVisible();

    const example = PXI_EXPERIMENT_EXAMPLES.llmEvaluatorBatchCalibration;
    const turn = await pxi.askAndWait(example.prompt);
    const outcome = await evaluatePxiOutcome({
      assertions: async () => {
        await pxi.expectNoAgentError();
        assertEfficientEvaluatorDraftCalibration({
          toolCalls: turn.toolCalls,
          testToolName: "test_llm_evaluator_draft",
          baseline: EVALUATOR_DRAFT_BASELINES.llm,
          expectedOutcomes: [
            { id: "exact-alignment", expectedText: "aligned" },
            { id: "semantic-paraphrase", expectedText: "aligned" },
            { id: "contradiction", expectedText: "not_aligned" },
          ],
        });
      },
      judgeInput: {
        system: JUDGE_SYSTEM,
        prompt: example.prompt,
        assistantText: turn.assistantText,
        rubric: [
          "All three requested LLM-judge cases were tested.",
          "The reported alignment outcomes preserve semantic equivalence and reject contradiction.",
          "PXI does not claim the evaluator was saved.",
        ],
      },
    });
    await persistPxiExperiment({
      request,
      record: {
        example,
        assistantText: turn.assistantText,
        transcript: turn.toolCalls,
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
