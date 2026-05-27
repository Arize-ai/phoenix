import { randomUUID } from "crypto";
import type { APIRequestContext } from "@playwright/test";

import {
  persistPxiExperiment,
  PXI_EXPERIMENT_EXAMPLES,
} from "./experimentPersistence";
import { expect, testV2 as test } from "./fixtures";
import { getRequiredJudgeApiKeyEnv } from "./judge";
import { assertPxiOutcome, evaluatePxiOutcome } from "./outcome";
import { disableAllSandboxConfigs } from "./utils";

const JUDGE_SYSTEM =
  "You are judging a Phoenix PXI E2E answer about sandbox-availability gating on a dataset surface. When no usable sandbox is enabled, create_code_evaluator must not be advertised, and the assistant — guided by the dataset context instruction template — should direct the user to /settings/sandboxes rather than attempting to create. Return a label, score, and brief explanation.";

async function seedDataset(
  request: APIRequestContext
): Promise<{ datasetId: string; datasetName: string }> {
  const datasetName = `pxi-no-sandbox-gate-${randomUUID().slice(0, 8)}`;
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

/**
 * PXI no-sandbox-gate smoke test (on a dataset surface).
 *
 * With no usable sandbox config, `_has_usable_sandbox(session)` returns
 * False, the agents router populates `sandbox_availability.has_usable=False`,
 * and `CreateCodeEvaluatorCapability.include_for_run` returns False even when
 * the dataset context is mounted. The DatasetContextCapability's Jinja
 * template emits the `<sandbox_unavailable>` block which tells the agent to
 * direct the user to `/settings/sandboxes`. This spec asserts both halves.
 *
 * Precondition note: PXI specs share a test Phoenix server, so this spec
 * explicitly disables any sandbox configs that earlier specs may have seeded.
 */
test.describe("PXI create code-evaluator no-sandbox gate smoke", () => {
  test("no usable sandbox + dataset context: tool absent and assistant redirects to /settings/sandboxes", async ({
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

    await disableAllSandboxConfigs(request);
    const { datasetId } = await seedDataset(request);

    await pxi.open();
    await pxi.acknowledgeConsent();

    // Land on the dataset detail page so DatasetContextCapability fires.
    await page.goto(`/datasets/${datasetId}`);
    await page.waitForURL(new RegExp(`/datasets/${datasetId}`));
    await page.waitForTimeout(500);

    await page.getByRole("button", { name: "Open agent chat" }).click();
    const messageInput = page.getByLabel("Message input");
    const acknowledgeButton = page.getByRole("button", {
      name: "Acknowledge",
    });
    await expect(messageInput.or(acknowledgeButton)).toBeVisible();
    if (await acknowledgeButton.isVisible()) {
      await acknowledgeButton.click();
      await expect(messageInput).toBeVisible();
    }

    const evaluatorName = `pxi-no-sandbox-${testInfo.workerIndex}-${Date.now()}`;
    const example =
      PXI_EXPERIMENT_EXAMPLES.createCodeEvaluatorNoSandboxGateSmoke;
    const renderedPrompt = example.prompt.replace("${name}", evaluatorName);

    const turn = await pxi.askAndWait(renderedPrompt);

    const rubric = [
      "The assistant did NOT call create_code_evaluator (the tool is hidden because no sandbox is usable).",
      "The assistant directed the user to /settings/sandboxes (the dataset context instruction template's sandbox-unavailable branch).",
      "The assistant did not invent a workaround or claim to have created the evaluator despite the gate.",
    ];

    const outcome = await evaluatePxiOutcome({
      assertions: async () => {
        await pxi.expectNoAgentError();

        // Tool absent from the trace.
        expect(turn.calledTools).not.toContain("create_code_evaluator");
        await expect(page.getByText("create_code_evaluator")).toHaveCount(0);

        // Assistant text should mention /settings/sandboxes — the explicit
        // path the dataset context template recommends.
        expect(turn.assistantText.toLowerCase()).toContain(
          "/settings/sandboxes"
        );
      },
      judgeInput: {
        system: JUDGE_SYSTEM,
        prompt: renderedPrompt,
        assistantText: turn.assistantText,
        rubric,
      },
    });

    await persistPxiExperiment({
      request,
      record: {
        example,
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
