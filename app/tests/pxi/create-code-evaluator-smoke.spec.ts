import { randomUUID } from "crypto";
import type { APIRequestContext, Page } from "@playwright/test";

import {
  persistPxiExperiment,
  PXI_EXPERIMENT_EXAMPLES,
} from "./experimentPersistence";
import { expect, testV2 as test } from "./fixtures";
import { getRequiredJudgeApiKeyEnv } from "./judge";
import { assertPxiOutcome, evaluatePxiOutcome } from "./outcome";

const JUDGE_SYSTEM =
  "You are judging a Phoenix PXI E2E answer about code-evaluator authoring tool gates. Return a label, score, and brief explanation.";

/**
 * Seed a minimal dataset so the tool-absent test can navigate to a dataset's
 * evaluators tab to mount the Create Code Evaluator dialog (the precondition
 * that flips the `include_for_run` gate for create_code_evaluator).
 */
async function seedDataset(
  request: APIRequestContext
): Promise<{ datasetId: string; datasetName: string }> {
  const datasetName = `pxi-create-code-evaluator-${randomUUID().slice(0, 8)}`;
  const response = await request.post("/v1/datasets/upload?sync=true", {
    headers: { "Content-Type": "application/json" },
    data: {
      action: "create",
      name: datasetName,
      inputs: [{ output: "4", reference: "4" }],
      outputs: [{ score: 1.0 }],
    },
  });
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { data: { dataset_id: string } };
  return { datasetId: body.data.dataset_id, datasetName };
}

async function openCreateCodeEvaluatorDialog(
  page: Page,
  datasetId: string
): Promise<void> {
  await page.goto(`/datasets/${datasetId}/evaluators`);
  await page.waitForURL("**/evaluators");
  await page.getByRole("button", { name: "Add evaluator" }).click();
  await page
    .getByRole("menuitem", { name: "Create new code evaluator" })
    .click();
  const dialog = page.getByTestId("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Create Code Evaluator" })
  ).toBeVisible();
}

async function reopenPxiPanel(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Open agent chat" }).click();
  const messageInput = page.getByLabel("Message input");
  const acknowledgeButton = page.getByRole("button", { name: "Acknowledge" });
  await expect(messageInput.or(acknowledgeButton)).toBeVisible();
  if (await acknowledgeButton.isVisible()) {
    await acknowledgeButton.click();
    await expect(messageInput).toBeVisible();
  }
}

/**
 * PXI create-code-evaluator tool-absent smoke test.
 *
 * Asserts the dual side of the `code_evaluator` context capability gate:
 * when a code-evaluator form is mounted, `EditCodeEvaluatorDraftCapability`
 * is advertised and `CreateCodeEvaluatorCapability.include_for_run` returns
 * False, so `create_code_evaluator` disappears from the model's tool list.
 * The proposal-then-accept flows for `create_code_evaluator` itself live in
 * `code-evaluator-create-proposal.spec.ts`.
 */
test.describe("PXI create code-evaluator smoke", () => {
  test("create_code_evaluator is absent when code-evaluator form is open", async ({
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

    const { datasetId } = await seedDataset(request);

    await pxi.open();
    await pxi.acknowledgeConsent();

    await openCreateCodeEvaluatorDialog(page, datasetId);

    // Wait for useAdvertiseAgentContext({ type: "code_evaluator" }) inside
    // EditCodeEvaluatorDialogContent to register with the agent store.
    await page.waitForTimeout(500);

    await reopenPxiPanel(page);

    const toolAbsentExample =
      PXI_EXPERIMENT_EXAMPLES.createCodeEvaluatorToolAbsentSmoke;
    const turn = await pxi.askAndWait(toolAbsentExample.prompt);

    const toolAbsentRubric = [
      "The assistant did not invoke create_code_evaluator.",
      "The assistant routed the request through edit_code_evaluator_draft (or explained that the open form means a draft tool is the right capability instead of creating a new evaluator from scratch).",
    ];

    const outcome = await evaluatePxiOutcome({
      assertions: async () => {
        await pxi.expectNoAgentError();

        // The create tool is gated off by include_for_run when a
        // code_evaluator context is advertised; the draft edit tool is its
        // dual and should be available instead.
        expect(turn.calledTools).not.toContain("create_code_evaluator");
        await expect(page.getByText("create_code_evaluator")).toHaveCount(0);

        expect(turn.calledTools).toContain("edit_code_evaluator_draft");
      },
      judgeInput: {
        system: JUDGE_SYSTEM,
        prompt: toolAbsentExample.prompt,
        assistantText: turn.assistantText,
        rubric: toolAbsentRubric,
      },
    });

    await persistPxiExperiment({
      request,
      record: {
        example: toolAbsentExample,
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
