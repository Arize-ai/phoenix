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
  "You are judging a Phoenix PXI E2E answer about direct code-evaluator authoring. Return a label, score, and brief explanation.";

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

type FreeformOutputConfig = {
  type: "freeform";
  name: string;
  optimizationDirection: "MINIMIZE" | "MAXIMIZE" | "NONE" | null;
  threshold: number | null;
  lowerBound: number | null;
  upperBound: number | null;
};

type CodeEvaluatorOutputConfig =
  | FreeformOutputConfig
  | { type: string; name: string };

/**
 * Raw GraphQL shape — `outputConfigs` is a union by `__typename` because the
 * server `BuiltInEvaluatorOutputConfig` strawberry union has three variants;
 * inline-fragment-resolved freeform fields are optional from the response's
 * perspective. We normalize to the domain `CodeEvaluatorOutputConfig` shape
 * at the parse boundary in `fetchCodeEvaluatorById`.
 */
type RawOutputConfigResponse = {
  __typename?: string;
  name?: string;
  optimizationDirection?: "MINIMIZE" | "MAXIMIZE" | "NONE" | null;
  threshold?: number | null;
  lowerBound?: number | null;
  upperBound?: number | null;
};

type GraphQLNodeResponse = {
  data?: {
    node?: {
      __typename?: string;
      id?: string;
      name?: string;
      outputConfigs?: RawOutputConfigResponse[] | null;
    } | null;
  } | null;
  errors?: Array<{ message?: string }>;
};

type GraphQLEvaluatorListResponse = {
  data?: {
    evaluators?: {
      edges?: Array<{
        node?: { __typename?: string; id?: string; name?: string };
      }>;
    } | null;
  } | null;
  errors?: Array<{ message?: string }>;
};

async function fetchCodeEvaluatorById(
  request: APIRequestContext,
  evaluatorId: string
): Promise<{
  id?: string;
  name?: string;
  typename?: string;
  outputConfigs?: CodeEvaluatorOutputConfig[] | null;
} | null> {
  const response = await request.post("/graphql", {
    headers: { "Content-Type": "application/json" },
    data: {
      query: `query VerifyCodeEvaluator($id: ID!) {
        node(id: $id) {
          __typename
          ... on CodeEvaluator {
            id
            name
            outputConfigs {
              __typename
              ... on FreeformAnnotationConfig {
                name
                optimizationDirection
                threshold
                lowerBound
                upperBound
              }
            }
          }
        }
      }`,
      variables: { id: evaluatorId },
    },
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as GraphQLNodeResponse;
  if (!payload.data?.node) {
    return null;
  }
  const outputConfigs: CodeEvaluatorOutputConfig[] | null =
    payload.data.node.outputConfigs?.map((config) => {
      if (config.__typename === "FreeformAnnotationConfig") {
        const freeform: FreeformOutputConfig = {
          type: "freeform",
          name: config.name ?? "",
          optimizationDirection: config.optimizationDirection ?? null,
          threshold: config.threshold ?? null,
          lowerBound: config.lowerBound ?? null,
          upperBound: config.upperBound ?? null,
        };
        return freeform;
      }
      return {
        type: config.__typename ?? "unknown",
        name: config.name ?? "",
      };
    }) ?? null;
  return {
    id: payload.data.node.id,
    name: payload.data.node.name,
    typename: payload.data.node.__typename,
    outputConfigs,
  };
}

async function listEvaluatorsByName(
  request: APIRequestContext,
  name: string
): Promise<Array<{ id: string; name: string }>> {
  const response = await request.post("/graphql", {
    headers: { "Content-Type": "application/json" },
    data: {
      query: `query VerifyNoEvaluator($filter: EvaluatorFilter) {
        evaluators(filter: $filter, first: 50) {
          edges { node { __typename ... on CodeEvaluator { id name } } }
        }
      }`,
      variables: { filter: { col: "name", value: name } },
    },
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as GraphQLEvaluatorListResponse;
  const edges = payload.data?.evaluators?.edges ?? [];
  return edges
    .map((edge) => edge.node)
    .filter(
      (node): node is { __typename?: string; id: string; name: string } =>
        typeof node?.id === "string" && typeof node?.name === "string"
    )
    .map((node) => ({ id: node.id, name: node.name }));
}

/**
 * Pull the newest evaluator id from the create_code_evaluator tool chip output.
 * The dispatcher serializes `{ createdEvaluator: { id, name } }` into the
 * tool-result body and the generic ToolPart renders it inside a code block.
 */
async function readCreatedEvaluatorIdFromToolPart(
  page: Page,
  evaluatorName: string
): Promise<string> {
  const createChip = page
    .locator(".tool-part", {
      has: page.locator(".tool-part__title-text", {
        hasText: "create_code_evaluator",
      }),
    })
    .first();
  await expect(createChip).toBeVisible({ timeout: 60000 });
  const bodyText = (await createChip.textContent()) ?? "";
  // The dispatcher emits `{ "createdEvaluator": { "id": "...", "name": "..." } }`
  // via JSON.stringify in toolRegistry.ts; the generic ToolPart prints it
  // inside <ToolPartCodeBlock>. Pull out the id paired with the expected name.
  const namePattern = new RegExp(`"name"\\s*:\\s*"${evaluatorName}"`);
  expect(bodyText).toMatch(namePattern);
  const idMatch = bodyText.match(/"id"\s*:\s*"([^"]+)"/);
  if (!idMatch) {
    throw new Error(
      `create_code_evaluator tool chip output did not include an evaluator id. Body: ${bodyText.slice(
        0,
        500
      )}`
    );
  }
  return idMatch[1];
}

/**
 * PXI direct-authoring smoke test.
 *
 * Originally exercised the pre-rework one-shot `create_code_evaluator` flow
 * where the tool dispatched `createCodeEvaluator` directly via authFetch.
 * After the chassis collapse, `create_code_evaluator` produces a
 * `PendingCodeEvaluatorCreate` proposal that the user must accept before any
 * mutation runs. The post-chassis equivalents of tests 1-3 live in
 * `code-evaluator-create-proposal.spec.ts`; tests 1-3 here are gated with
 * `test.fixme()` pending the harness fix tracked at
 * https://github.com/Arize-ai/phoenix/issues/TBD because their assertion
 * surfaces (e.g. checking the one-shot Result chip, `sandbox_config_id: null`
 * happy path) reference a contract that no longer exists. Test 4
 * (create_code_evaluator absent when a code-evaluator form is mounted) still
 * asserts a live contract — the EditCodeEvaluatorDraftCapability dual side —
 * and remains executable.
 */
test.describe("PXI create code-evaluator smoke", () => {
  test.fixme("happy-path creates evaluator without graphql.mutations capability", async ({
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

    const evaluatorName = `pxi-code-eval-${testInfo.workerIndex}-${Date.now()}`;
    const happyExample = PXI_EXPERIMENT_EXAMPLES.createCodeEvaluatorHappySmoke;
    const renderedPrompt = happyExample.prompt.replace(
      "${name}",
      evaluatorName
    );

    const startedAt = Date.now();
    await page.getByLabel("Message input").fill(renderedPrompt);
    await page.getByRole("button", { name: "Send message" }).click();

    const calledTools: string[] = [];
    let createdEvaluatorId = "";
    let persisted: { id?: string; name?: string; typename?: string } | null =
      null;

    const happyRubric = [
      "The assistant used create_code_evaluator to author a new code evaluator.",
      "The assistant passed sandbox_config_id: null (or omitted a sandbox) since no sandbox was configured.",
      "The assistant reported the evaluator was created successfully (and ideally surfaced its id or name).",
    ];

    const outcome = await evaluatePxiOutcome({
      assertions: async () => {
        await pxi.expectNoAgentError();

        await expect(
          page.getByText("create_code_evaluator").first()
        ).toBeVisible({ timeout: 60000 });
        calledTools.push("create_code_evaluator");

        createdEvaluatorId = await readCreatedEvaluatorIdFromToolPart(
          page,
          evaluatorName
        );

        persisted = await fetchCodeEvaluatorById(request, createdEvaluatorId);
        expect(persisted).not.toBeNull();
        expect(persisted?.typename).toBe("CodeEvaluator");
        expect(persisted?.id).toBe(createdEvaluatorId);
        expect(persisted?.name).toBe(evaluatorName);
      },
      judgeInput: {
        system: JUDGE_SYSTEM,
        prompt: renderedPrompt,
        assistantText: `Called create_code_evaluator with name=${evaluatorName} and sandbox_config_id=null. Evaluator persisted with id=${createdEvaluatorId}.`,
        rubric: happyRubric,
      },
    });

    const durationMs = Date.now() - startedAt;
    const metadata = pxi.getMetadata();
    await persistPxiExperiment({
      request,
      record: {
        example: happyExample,
        assistantText: `Created code evaluator ${evaluatorName} (id=${createdEvaluatorId}) via create_code_evaluator without graphql.mutations.`,
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

  test.fixme("BadRequest surfaces unparseable evaluate() signature verbatim", async ({
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

    const badName = `pxi-code-eval-bad-${testInfo.workerIndex}-${Date.now()}`;
    const badRequestExample =
      PXI_EXPERIMENT_EXAMPLES.createCodeEvaluatorBadRequestSmoke;
    const renderedPrompt = badRequestExample.prompt.replace("${name}", badName);

    const startedAt = Date.now();
    await page.getByLabel("Message input").fill(renderedPrompt);
    await page.getByRole("button", { name: "Send message" }).click();

    const calledTools: string[] = [];

    const badRequestRubric = [
      "The assistant attempted to call create_code_evaluator with the user's source code.",
      "The assistant relayed the server's BadRequest message about the unparseable evaluate() signature without rephrasing it or claiming success.",
    ];

    const outcome = await evaluatePxiOutcome({
      assertions: async () => {
        await pxi.expectNoAgentError();

        await expect(
          page.getByText("create_code_evaluator").first()
        ).toBeVisible({ timeout: 60000 });
        calledTools.push("create_code_evaluator");

        // Server raises BadRequest via _raise_on_uninferable_evaluate_signature
        // with text like: "Could not infer the Python evaluator inputs because
        // no top-level `evaluate(...)` function was found." Anchor on stable
        // distinctive fragments instead of pinning the full string.
        await expect(page.getByText(/could not infer/i).first()).toBeVisible({
          timeout: 60000,
        });
        await expect(page.getByText(/evaluate/i).first()).toBeVisible();

        // Confirm no evaluator was persisted under the bad-request name.
        const matches = await listEvaluatorsByName(request, badName);
        expect(matches.find((node) => node.name === badName)).toBeUndefined();
      },
      judgeInput: {
        system: JUDGE_SYSTEM,
        prompt: renderedPrompt,
        assistantText: `Called create_code_evaluator with a source whose top-level function was not named evaluate(). Server BadRequest surfaced and no evaluator was persisted under ${badName}.`,
        rubric: badRequestRubric,
      },
    });

    const durationMs = Date.now() - startedAt;
    const metadata = pxi.getMetadata();
    await persistPxiExperiment({
      request,
      record: {
        example: badRequestExample,
        assistantText: `create_code_evaluator BadRequest surfaced verbatim for ${badName}; no evaluator persisted.`,
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

  test.fixme("authors a single freeform output_config that round-trips via GraphQL", async ({
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

    const evaluatorName = `pxi-code-eval-oc-${testInfo.workerIndex}-${Date.now()}`;
    const withOutputConfigExample =
      PXI_EXPERIMENT_EXAMPLES.createCodeEvaluatorWithOutputConfigSmoke;
    const renderedPrompt = withOutputConfigExample.prompt.replace(
      "${name}",
      evaluatorName
    );

    const startedAt = Date.now();
    await page.getByLabel("Message input").fill(renderedPrompt);
    await page.getByRole("button", { name: "Send message" }).click();

    const calledTools: string[] = [];
    let createdEvaluatorId = "";
    let persisted: Awaited<ReturnType<typeof fetchCodeEvaluatorById>> = null;

    const outputConfigRubric = [
      "The assistant used create_code_evaluator to author a new code evaluator.",
      "The assistant passed an output_config block carrying optimization_direction MAXIMIZE and threshold 0.7.",
      "The assistant did not invent a separate name for the output_config (the evaluator's own name is reused).",
    ];

    const outcome = await evaluatePxiOutcome({
      assertions: async () => {
        await pxi.expectNoAgentError();

        await expect(
          page.getByText("create_code_evaluator").first()
        ).toBeVisible({ timeout: 60000 });
        calledTools.push("create_code_evaluator");

        createdEvaluatorId = await readCreatedEvaluatorIdFromToolPart(
          page,
          evaluatorName
        );

        persisted = await fetchCodeEvaluatorById(request, createdEvaluatorId);
        expect(persisted).not.toBeNull();
        expect(persisted?.typename).toBe("CodeEvaluator");
        expect(persisted?.id).toBe(createdEvaluatorId);
        expect(persisted?.name).toBe(evaluatorName);

        // Single freeform entry whose name equals the evaluator's name and
        // carries the optimization_direction + threshold the user asked for.
        const outputConfigs = persisted?.outputConfigs ?? [];
        expect(outputConfigs).toHaveLength(1);
        const freeform = outputConfigs[0];
        expect(freeform.type).toBe("freeform");
        expect(freeform.name).toBe(evaluatorName);
        expect((freeform as FreeformOutputConfig).optimizationDirection).toBe(
          "MAXIMIZE"
        );
        expect((freeform as FreeformOutputConfig).threshold).toBeCloseTo(
          0.7,
          5
        );
      },
      judgeInput: {
        system: JUDGE_SYSTEM,
        prompt: renderedPrompt,
        assistantText: `Called create_code_evaluator with name=${evaluatorName}, output_config={optimization_direction: MAXIMIZE, threshold: 0.7}. Evaluator persisted with id=${createdEvaluatorId}; output_configs round-trip one freeform entry.`,
        rubric: outputConfigRubric,
      },
    });

    const durationMs = Date.now() - startedAt;
    const metadata = pxi.getMetadata();
    await persistPxiExperiment({
      request,
      record: {
        example: withOutputConfigExample,
        assistantText: `Created code evaluator ${evaluatorName} (id=${createdEvaluatorId}) with a single freeform output_config (MAXIMIZE @ 0.7).`,
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
