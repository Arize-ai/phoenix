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
  "You are judging a Phoenix PXI E2E answer about code-evaluator draft editing. Return a label, score, and brief explanation.";

/**
 * Seed a minimal dataset via the public REST API. Specs that exercise the
 * Create Code Evaluator dialog need a dataset to land on the evaluators tab,
 * but the draft tools under test do not touch dataset state — a single trivial
 * example is enough to satisfy the navigation prerequisite.
 */
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
 * Bump the draft revision by typing into the source-code CodeMirror surface.
 * `insertText` is preferred over `keyboard.type` because it appends at the
 * caret without firing CodeMirror keybindings.
 */
async function bumpDraftRevisionViaSourceEditor(
  page: Page,
  marker: string
): Promise<void> {
  const dialog = page.getByTestId("dialog");
  const sourceEditor = dialog.locator(".cm-content").first();
  await sourceEditor.click();
  await page.keyboard.insertText(`# ${marker}\n`);
}

/**
 * Code-evaluator draft tools smoke test.
 *
 * Exercises read_code_evaluator_draft + edit_code_evaluator_draft inside the
 * Create Code Evaluator dialog, plus the optimistic-concurrency revision
 * guards at both the propose-time and accept-time call sites, and the
 * inverse case where no code-evaluator form is mounted.
 */
test.describe("PXI code-evaluator draft smoke", () => {
  test("reads draft and proposes edit with accept flow", async ({
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

    const editExample = PXI_EXPERIMENT_EXAMPLES.codeEvaluatorDraftEditSmoke;
    const startedAt = Date.now();
    await page.getByLabel("Message input").fill(editExample.prompt);
    await page.getByRole("button", { name: "Send message" }).click();

    await expect(page.getByText(/awaiting approval/i).first()).toBeVisible({
      timeout: 30000,
    });

    const calledTools: string[] = [];
    const dialog = page.getByTestId("dialog");

    const editRubric = [
      "The assistant used read_code_evaluator_draft to inspect the current draft before proposing changes.",
      "The assistant used edit_code_evaluator_draft to propose updating the evaluate function source.",
      "The assistant indicated it is waiting for user approval before applying the change.",
      "The assistant did not claim the edit was already applied before user approval.",
    ];

    const outcome = await evaluatePxiOutcome({
      assertions: async () => {
        await pxi.expectNoAgentError();

        await expect(
          page.getByText("read_code_evaluator_draft").first()
        ).toBeVisible();
        calledTools.push("read_code_evaluator_draft");

        await expect(
          page.getByText("edit_code_evaluator_draft").first()
        ).toBeVisible();
        calledTools.push("edit_code_evaluator_draft");

        await expect(
          page.getByText(/proposed diff for code-evaluator draft/i).first()
        ).toBeVisible();

        const acceptButton = page.getByRole("button", { name: "Accept" });
        const rejectButton = page.getByRole("button", { name: "Reject" });
        await expect(acceptButton.first()).toBeVisible();
        await expect(rejectButton.first()).toBeVisible();

        await acceptButton.first().click();

        await expect(page.getByText(/accepted/i).first()).toBeVisible();

        // After accept, the source editor must contain the proposed return
        // value. The LLM picks the exact phrasing, so anchor on the literal
        // "1.0" that the prompt asks for.
        await expect(dialog.locator(".cm-content").first()).toContainText(
          "1.0"
        );
      },
      judgeInput: {
        system: JUDGE_SYSTEM,
        prompt: editExample.prompt,
        assistantText:
          "Used read_code_evaluator_draft to inspect the draft, then edit_code_evaluator_draft to propose returning 1.0. Awaiting user approval.",
        rubric: editRubric,
      },
    });

    const durationMs = Date.now() - startedAt;
    const metadata = pxi.getMetadata();
    await persistPxiExperiment({
      request,
      record: {
        example: editExample,
        assistantText:
          "Used read_code_evaluator_draft and edit_code_evaluator_draft tools successfully. User accepted the edit.",
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
      },
      judgeInput: {
        system: JUDGE_SYSTEM,
        prompt: previewExample.prompt,
        assistantText:
          "Used open_experiment_evaluator_form on the dataset-backed playground, read and edited the draft, waited for approval, then ran test_code_evaluator_draft and displayed the evaluator preview result without leaving the playground URL.",
        rubric: previewRubric,
      },
    });

    const durationMs = Date.now() - startedAt;
    const metadata = pxi.getMetadata();
    await persistPxiExperiment({
      request,
      record: {
        example: previewExample,
        assistantText:
          "Used open_experiment_evaluator_form, read_code_evaluator_draft, edit_code_evaluator_draft, and test_code_evaluator_draft from a dataset-backed playground. User accepted the edit and the preview rendered.",
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

  test("reject flow leaves source editor unchanged", async ({
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

    await page.waitForTimeout(500);

    await reopenPxiPanel(page);

    const dialog = page.getByTestId("dialog");
    const sourceEditor = dialog.locator(".cm-content").first();
    const initialSource = (await sourceEditor.textContent()) ?? "";

    const rejectExample = PXI_EXPERIMENT_EXAMPLES.codeEvaluatorDraftRejectSmoke;
    const startedAt = Date.now();
    await page.getByLabel("Message input").fill(rejectExample.prompt);
    await page.getByRole("button", { name: "Send message" }).click();

    await expect(page.getByText(/awaiting approval/i).first()).toBeVisible({
      timeout: 30000,
    });

    const calledTools: string[] = ["edit_code_evaluator_draft"];

    const rejectRubric = [
      "The assistant proposed an edit adding the PXI REJECT MARKER comment.",
      "The assistant presented the edit for user review before applying.",
    ];

    const outcome = await evaluatePxiOutcome({
      assertions: async () => {
        await pxi.expectNoAgentError();

        await expect(
          page.getByText("edit_code_evaluator_draft").first()
        ).toBeVisible();
        await expect(
          page.getByText(/proposed diff for code-evaluator draft/i).first()
        ).toBeVisible();

        const rejectButton = page.getByRole("button", { name: "Reject" });
        await expect(rejectButton.first()).toBeVisible();
        await rejectButton.first().click();

        await expect(page.getByText(/rejected/i).first()).toBeVisible();

        // Source editor must be unchanged after reject: the marker the LLM
        // was asked to add must not appear in the source editor textContent.
        await expect(sourceEditor).not.toContainText("PXI REJECT MARKER");
        await expect(sourceEditor).toHaveText(initialSource);
      },
      judgeInput: {
        system: JUDGE_SYSTEM,
        prompt: rejectExample.prompt,
        assistantText:
          "Used edit_code_evaluator_draft to propose adding a PXI REJECT MARKER comment. Awaiting user approval.",
        rubric: rejectRubric,
      },
    });

    const durationMs = Date.now() - startedAt;
    const metadata = pxi.getMetadata();
    await persistPxiExperiment({
      request,
      record: {
        example: rejectExample,
        assistantText:
          "Used edit_code_evaluator_draft tool. User rejected the proposed edit and the source editor is unchanged.",
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

  test("stale revision is rejected at propose-time", async ({
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

    await page.waitForTimeout(500);

    await reopenPxiPanel(page);

    // Step 1: ask PXI to read the draft so it captures the current revision.
    await page
      .getByLabel("Message input")
      .fill("Read the current code-evaluator draft and tell me what it does.");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(
      page.getByText("read_code_evaluator_draft").first()
    ).toBeVisible({ timeout: 30000 });

    // Step 2: bump the draft revision out-of-band by editing the source code.
    await bumpDraftRevisionViaSourceEditor(page, "stale propose marker");

    // Step 3: ask PXI to propose an edit; the propose-time guard must fire.
    const staleProposeExample =
      PXI_EXPERIMENT_EXAMPLES.codeEvaluatorDraftStaleProposeSmoke;
    const startedAt = Date.now();
    await page.getByLabel("Message input").fill(staleProposeExample.prompt);
    await page.getByRole("button", { name: "Send message" }).click();

    const calledTools: string[] = ["read_code_evaluator_draft"];

    const staleProposeRubric = [
      "The assistant attempted to propose an edit to the code-evaluator draft after the user typed into the source editor.",
      "The assistant reported (or the tool surface showed) that the draft had changed since PXI last viewed it.",
    ];

    const outcome = await evaluatePxiOutcome({
      assertions: async () => {
        await pxi.expectNoAgentError();

        await expect(
          page.getByText("edit_code_evaluator_draft").first()
        ).toBeVisible({ timeout: 30000 });
        calledTools.push("edit_code_evaluator_draft");

        await expect(
          page.getByText(/has changed since it was last viewed by PXI/i).first()
        ).toBeVisible({ timeout: 30000 });
      },
      judgeInput: {
        system: JUDGE_SYSTEM,
        prompt: staleProposeExample.prompt,
        assistantText:
          "Used read_code_evaluator_draft then attempted edit_code_evaluator_draft. The propose-time stale-revision guard fired with the canonical error string.",
        rubric: staleProposeRubric,
      },
    });

    const durationMs = Date.now() - startedAt;
    const metadata = pxi.getMetadata();
    await persistPxiExperiment({
      request,
      record: {
        example: staleProposeExample,
        assistantText:
          "Used read_code_evaluator_draft, then edit_code_evaluator_draft. The propose-time stale-revision guard surfaced the canonical error string.",
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

  test("stale revision is rejected at accept-time", async ({
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

    await page.waitForTimeout(500);

    await reopenPxiPanel(page);

    const staleAcceptExample =
      PXI_EXPERIMENT_EXAMPLES.codeEvaluatorDraftStaleAcceptSmoke;
    const startedAt = Date.now();
    await page.getByLabel("Message input").fill(staleAcceptExample.prompt);
    await page.getByRole("button", { name: "Send message" }).click();

    // Wait for the diff to render (proposed but not yet accepted).
    await expect(page.getByText(/awaiting approval/i).first()).toBeVisible({
      timeout: 30000,
    });
    await expect(
      page.getByText(/proposed diff for code-evaluator draft/i).first()
    ).toBeVisible();

    const calledTools: string[] = [
      "read_code_evaluator_draft",
      "edit_code_evaluator_draft",
    ];

    // Bump revision after PXI has proposed but before the user clicks Accept.
    await bumpDraftRevisionViaSourceEditor(page, "stale accept marker");

    const staleAcceptRubric = [
      "The assistant proposed an edit and presented the diff for review.",
      "The accept-time stale-revision guard surfaced the canonical error message after the source editor was modified between propose and accept.",
    ];

    const outcome = await evaluatePxiOutcome({
      assertions: async () => {
        await pxi.expectNoAgentError();

        const acceptButton = page.getByRole("button", { name: "Accept" });
        await expect(acceptButton.first()).toBeVisible();
        await acceptButton.first().click();

        await expect(
          page
            .getByText(
              /changed after this edit was proposed, so it can no longer be applied/i
            )
            .first()
        ).toBeVisible({ timeout: 30000 });
      },
      judgeInput: {
        system: JUDGE_SYSTEM,
        prompt: staleAcceptExample.prompt,
        assistantText:
          "Used read_code_evaluator_draft and edit_code_evaluator_draft. The accept-time stale-revision guard surfaced the canonical error string after the source editor was modified mid-flight.",
        rubric: staleAcceptRubric,
      },
    });

    const durationMs = Date.now() - startedAt;
    const metadata = pxi.getMetadata();
    await persistPxiExperiment({
      request,
      record: {
        example: staleAcceptExample,
        assistantText:
          "Used read_code_evaluator_draft and edit_code_evaluator_draft. The accept-time stale-revision guard surfaced the canonical error string.",
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

  test("draft tools are absent when no form is open", async ({
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

    // No code-evaluator dialog mounted — pxi.open() lands on /projects.
    await pxi.open();
    await pxi.acknowledgeConsent();

    const toolsAbsentExample =
      PXI_EXPERIMENT_EXAMPLES.codeEvaluatorDraftToolsAbsentSmoke;
    const turn = await pxi.askAndWait(toolsAbsentExample.prompt);

    const toolsAbsentRubric = [
      "The assistant did not invoke read_code_evaluator_draft or edit_code_evaluator_draft.",
      "The assistant explained that it cannot read or edit a draft because no code-evaluator form is open, or routed to a different available capability.",
    ];

    const outcome = await evaluatePxiOutcome({
      assertions: async () => {
        await pxi.expectNoAgentError();

        // calledTools captures what was called, not what was advertised —
        // model-surface tool-list absence is not directly observable without
        // a request-inspection hook.
        expect(turn.calledTools).not.toContain("read_code_evaluator_draft");
        expect(turn.calledTools).not.toContain("edit_code_evaluator_draft");

        await expect(page.getByText("read_code_evaluator_draft")).toHaveCount(
          0
        );
        await expect(page.getByText("edit_code_evaluator_draft")).toHaveCount(
          0
        );
      },
      judgeInput: {
        system: JUDGE_SYSTEM,
        prompt: toolsAbsentExample.prompt,
        assistantText: turn.assistantText,
        rubric: toolsAbsentRubric,
      },
    });

    await persistPxiExperiment({
      request,
      record: {
        example: toolsAbsentExample,
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
