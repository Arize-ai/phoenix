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
  "You are judging a Phoenix PXI E2E answer about the dataset-surface handoff flow for authoring a code evaluator. PXI must explain what evaluator it intends to author, link the user to the dataset's Create Code Evaluator slideover without claiming persistence, then use the draft read/edit tools after the form is open. Persistence happens only when the user clicks Save in the slideover. Return a label, score, and brief explanation.";

async function seedDataset(
  request: APIRequestContext
): Promise<{ datasetId: string; datasetName: string }> {
  const datasetName = `pxi-create-proposal-${randomUUID().slice(0, 8)}`;
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

type GraphQLDatasetEvaluatorsResponse = {
  data?: {
    node?: {
      datasetEvaluators?: {
        edges?: Array<{
          node?: {
            __typename?: string;
            id?: string;
            name?: string;
            evaluator?: { id?: string; name?: string } | null;
          };
        }>;
      } | null;
    } | null;
  } | null;
  errors?: Array<{ message?: string }>;
};

async function fetchDatasetEvaluators(
  request: APIRequestContext,
  datasetId: string
): Promise<
  Array<{
    id: string;
    name: string;
    evaluatorId: string | null;
    evaluatorName: string | null;
  }>
> {
  const response = await request.post("/graphql", {
    headers: { "Content-Type": "application/json" },
    data: {
      query: `query DatasetEvaluators($id: ID!) {
        node(id: $id) {
          ... on Dataset {
            datasetEvaluators(first: 50) {
              edges { node { __typename id name evaluator { id name } } }
            }
          }
        }
      }`,
      variables: { id: datasetId },
    },
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as GraphQLDatasetEvaluatorsResponse;
  const edges = payload.data?.node?.datasetEvaluators?.edges ?? [];
  return edges
    .map((edge) => edge.node)
    .filter(
      (
        node
      ): node is {
        __typename?: string;
        id: string;
        name: string;
        evaluator?: { id?: string; name?: string } | null;
      } => typeof node?.id === "string" && typeof node?.name === "string"
    )
    .map((node) => ({
      id: node.id,
      name: node.name,
      evaluatorId: node.evaluator?.id ?? null,
      evaluatorName: node.evaluator?.name ?? null,
    }));
}

async function openDatasetEvaluatorsAndPxi(
  page: Page,
  pxi: { open: () => Promise<void>; acknowledgeConsent: () => Promise<void> },
  datasetId: string
) {
  await pxi.open();
  await pxi.acknowledgeConsent();
  await page.goto(`/datasets/${datasetId}/evaluators`);
  await page.waitForURL("**/evaluators");
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Open agent chat" }).click();
  const messageInput = page.getByLabel("Message input");
  const acknowledgeButton = page.getByRole("button", { name: "Acknowledge" });
  await expect(messageInput.or(acknowledgeButton)).toBeVisible();
  if (await acknowledgeButton.isVisible()) {
    await acknowledgeButton.click();
    await expect(messageInput).toBeVisible();
  }
  return messageInput;
}

async function waitForPendingDraftEditChip(page: Page) {
  const chip = page
    .locator(".tool-part", {
      has: page.locator(".tool-part__title-text", {
        hasText: "edit_code_evaluator_draft",
      }),
    })
    .last();
  await expect(chip).toBeVisible({ timeout: 60000 });
  await expect(chip.getByText(/Awaiting approval/i)).toBeVisible({
    timeout: 60000,
  });
  return chip;
}

test.describe("PXI create code-evaluator proposal smoke", () => {
  test("confirms the proposal, saves the slideover, and binds the evaluator to the dataset", async ({
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

    await createWasmPythonSandboxConfig({
      request,
      name: `pxi-create-proposal-python-${randomUUID().slice(0, 8)}`,
    });
    const { datasetId } = await seedDataset(request);
    const messageInput = await openDatasetEvaluatorsAndPxi(
      page,
      pxi,
      datasetId
    );

    const evaluatorName = `pxi-dataset-eval-${testInfo.workerIndex}-${Date.now()}`;
    const example =
      PXI_EXPERIMENT_EXAMPLES.createCodeEvaluatorProposalDatasetSmoke;
    const renderedPrompt = example.prompt.replace("${name}", evaluatorName);

    const startedAt = Date.now();
    const handoffTurn = await pxi.askAndWait(renderedPrompt);
    const calledTools: string[] = [...handoffTurn.calledTools];

    const createLink = page
      .locator(".chat__messages")
      .getByRole("link", { name: /create code evaluator/i })
      .last();
    await expect(createLink).toBeVisible({ timeout: 60000 });
    await createLink.click();

    const dialog = page.getByTestId("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Create Code Evaluator" })
    ).toBeVisible({ timeout: 60000 });

    const draftPrompt = [
      "The Create Code Evaluator form is open.",
      `Read the draft, then propose a Python evaluator named ${evaluatorName}.`,
      "Define `evaluate(output, reference)` that returns 1.0 when output equals reference case-insensitively after trimming, and 0.0 otherwise.",
      "Use an available Python sandbox config, set a continuous score output config named score, and wait for me to accept the edit before making changes.",
    ].join(" ");
    await messageInput.fill(draftPrompt);
    await page.getByRole("button", { name: "Send message" }).click();

    await expect(
      page.getByText("read_code_evaluator_draft").first()
    ).toBeVisible({ timeout: 60000 });
    calledTools.push("read_code_evaluator_draft");
    const editChip = await waitForPendingDraftEditChip(page);
    calledTools.push("edit_code_evaluator_draft");
    const draftTurn = await pxi.getLatestAssistantTurn();
    calledTools.push(...draftTurn.calledTools);

    const assistantText = [handoffTurn.assistantText, draftTurn.assistantText]
      .filter(Boolean)
      .join("\n\n");

    const rubric = [
      "The assistant first explained what evaluator it intended to author and linked to the dataset Create Code Evaluator surface without claiming the evaluator was already saved.",
      "After the form opened, the assistant read the draft and proposed the requested code evaluator through edit_code_evaluator_draft, waiting for user approval before applying changes.",
      "The accepted draft preserved the requested evaluator name, source behavior, sandbox selection, and score output config so the slideover Save could persist and bind it to the dataset.",
    ];

    const outcome = await evaluatePxiOutcome({
      assertions: async () => {
        await pxi.expectNoAgentError();
        await editChip.getByRole("button", { name: "Accept" }).click();
        await expect(editChip.getByText(/Accepted/i)).toBeVisible({
          timeout: 60000,
        });

        await expect(dialog.getByLabel("Name")).toHaveValue(evaluatorName, {
          timeout: 60000,
        });
        await expect(dialog.locator(".cm-content").first()).toContainText(
          "def evaluate(output, reference)"
        );

        const slideoverSave = dialog.getByRole("button", { name: "Save" });
        await expect(slideoverSave).toBeVisible({ timeout: 60000 });
        await slideoverSave.click();
        await expect(dialog).not.toBeVisible({ timeout: 60000 });

        const datasetEvaluators = await fetchDatasetEvaluators(
          request,
          datasetId
        );
        const matching = datasetEvaluators.find(
          (e) => e.evaluatorName === evaluatorName
        );
        expect(
          matching,
          "Slideover Save must create the evaluator and bind it to the active dataset."
        ).toBeDefined();
      },
      judgeInput: {
        system: JUDGE_SYSTEM,
        prompt: renderedPrompt,
        assistantText,
        rubric,
      },
    });

    const durationMs = Date.now() - startedAt;
    await persistPxiExperiment({
      request,
      record: {
        example,
        assistantText,
        calledTools: [...new Set(calledTools)],
        url: page.url(),
        durationMs,
        judgeResult: outcome.judgeResult,
        playwrightProject: testInfo.project.name,
        ...pxi.getMetadata(),
      },
    });

    assertPxiOutcome(outcome);
  });
});
