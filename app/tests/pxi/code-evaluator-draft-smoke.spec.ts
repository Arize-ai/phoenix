import { randomUUID } from "crypto";
import type { APIRequestContext, Page } from "@playwright/test";

import {
  persistPxiExperiment,
  PXI_EXPERIMENT_EXAMPLES,
} from "./experimentPersistence";
import { expect, testV2 as test } from "./fixtures";
import { getRequiredJudgeApiKeyEnv } from "./judge";
import { assertPxiOutcome, evaluatePxiOutcome } from "./outcome";
import { createWasmPythonSandboxConfig } from "./utils";

const JUDGE_SYSTEM =
  "You are judging a Phoenix PXI E2E answer about opening, editing, and testing a code-evaluator draft from the playground. Return a label, score, and brief explanation.";

async function seedDataset(
  request: APIRequestContext
): Promise<{ datasetId: string; datasetName: string }> {
  const datasetName = `pxi-code-evaluator-draft-${randomUUID().slice(0, 8)}`;
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

test.describe("PXI code-evaluator draft smoke", () => {
  test("opens playground evaluator form, edits, and tests draft without leaving playground", async ({
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

    await createWasmPythonSandboxConfig({
      request,
      name: `pxi-preview-python-${randomUUID().slice(0, 8)}`,
    });
    const { datasetId } = await seedDataset(request);

    await pxi.open();
    await pxi.acknowledgeConsent();

    await page.goto(`/playground?datasetId=${datasetId}`);
    await page.waitForURL("**/playground?datasetId=*");
    await expect(page.getByTestId("playground-run-button")).toBeVisible();

    await page.waitForTimeout(500);
    const playgroundUrl = page.url();

    await reopenPxiPanel(page);

    const previewExample =
      PXI_EXPERIMENT_EXAMPLES.codeEvaluatorDraftPreviewFormSmoke;
    const startedAt = Date.now();
    await page.getByLabel("Message input").fill(previewExample.prompt);
    await page.getByRole("button", { name: "Send message" }).click();

    const calledTools: string[] = [];

    const previewRubric = [
      "The assistant used open_experiment_evaluator_form while staying on the dataset-backed playground URL.",
      "The assistant read the draft, proposed an edit with edit_code_evaluator_draft, and waited for user approval before applying it.",
      "After acceptance, the assistant used test_code_evaluator_draft and surfaced the evaluator preview result.",
      "The assistant did not require or claim backend TOOL spans for these client-executed tools.",
    ];
    const judgeInput = {
      system: JUDGE_SYSTEM,
      prompt: previewExample.prompt,
      assistantText: "",
      rubric: previewRubric,
    };

    const outcome = await evaluatePxiOutcome({
      assertions: async () => {
        await pxi.expectNoAgentError();

        await expect(
          page.getByText("open_experiment_evaluator_form").first()
        ).toBeVisible({ timeout: 60000 });
        calledTools.push("open_experiment_evaluator_form");
        expect(page.url()).toBe(playgroundUrl);

        const dialog = page.getByTestId("dialog");
        await expect(
          dialog.getByRole("heading", { name: "Create Code Evaluator" })
        ).toBeVisible({ timeout: 60000 });

        await expect(
          page.getByText("read_code_evaluator_draft").first()
        ).toBeVisible({ timeout: 60000 });
        calledTools.push("read_code_evaluator_draft");

        await expect(
          page.getByText("edit_code_evaluator_draft").first()
        ).toBeVisible({ timeout: 60000 });
        calledTools.push("edit_code_evaluator_draft");

        await expect(page.getByText(/awaiting approval/i).first()).toBeVisible({
          timeout: 60000,
        });

        const acceptButton = page.getByRole("button", { name: "Accept" });
        await expect(acceptButton.first()).toBeVisible();
        await acceptButton.first().click();
        await expect(page.getByText(/accepted/i).first()).toBeVisible({
          timeout: 60000,
        });

        await expect(dialog.getByLabel("Name")).toHaveValue(
          "pxi_preview_accuracy"
        );
        await expect(dialog.locator(".cm-content").first()).toContainText(
          "0.0"
        );

        await expect(
          page.getByText("test_code_evaluator_draft").first()
        ).toBeVisible({ timeout: 60000 });
        calledTools.push("test_code_evaluator_draft");

        await expect(dialog.getByText("Evaluator Result").first()).toBeVisible({
          timeout: 60000,
        });
        expect(page.url()).toBe(playgroundUrl);
        const turn = await pxi.getLatestAssistantTurn();
        judgeInput.assistantText = turn.assistantText;
        calledTools.push(...turn.calledTools);
      },
      judgeInput,
    });

    const durationMs = Date.now() - startedAt;
    const metadata = pxi.getMetadata();
    await persistPxiExperiment({
      request,
      record: {
        example: previewExample,
        assistantText: judgeInput.assistantText,
        calledTools: [...new Set(calledTools)],
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
