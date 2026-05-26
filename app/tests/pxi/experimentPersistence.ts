import type { APIRequestContext } from "@playwright/test";

const DATASET_NAME = "PXI E2E Agent Tests";
const EXPERIMENT_BASE_URL =
  process.env.PXI_E2E_EXPERIMENT_BASE_URL ?? "http://localhost:6006";
const EXPERIMENT_BEARER_TOKEN = process.env.PXI_E2E_EXPERIMENT_BEARER_TOKEN;

export const PXI_EXPERIMENT_EXAMPLES = {
  docsSmoke: {
    id: "pxi-docs-smoke:tracing-project-env-var-v1",
    prompt: "How do I change the default project name",
    expectedOutput: "Answer names PHOENIX_PROJECT_NAME and cites Phoenix docs.",
    experimentNamePrefix: "pxi-e2e-docs-smoke",
    experimentDescription:
      "PXI docs smoke test driven through the Phoenix frontend.",
  },
  timeRangeSmoke: {
    id: "pxi-time-range-smoke:last-hour-v1",
    prompt:
      'Set the Phoenix app time range to Last Hour using timeRangeKey "1h", then briefly confirm that it is set.',
    expectedOutput:
      "PXI sets the Phoenix app time range selector to Last Hour.",
    experimentNamePrefix: "pxi-e2e-time-range-smoke",
    experimentDescription:
      "PXI time range smoke test driven through the Phoenix frontend.",
  },
  playgroundPromptSmoke: {
    id: "pxi-playground-prompt-smoke:edit-system-message-v1",
    prompt:
      "I'm on the playground page. Read the current prompt, then edit it to add a system message that says 'Always respond in valid JSON format.' at the beginning. Wait for me to accept or reject the change.",
    expectedOutput:
      "PXI reads the playground prompt, proposes an edit with a diff preview, and waits for user approval.",
    experimentNamePrefix: "pxi-e2e-playground-prompt-smoke",
    experimentDescription:
      "PXI playground prompt tools smoke test: read_prompt_instance, edit_prompt_instance with approval flow.",
  },
  playgroundCloneSmoke: {
    id: "pxi-playground-prompt-smoke:clone-instance-v1",
    prompt:
      "Clone the current playground prompt instance so I can compare two versions side by side.",
    expectedOutput:
      "PXI clones the playground instance for side-by-side comparison.",
    experimentNamePrefix: "pxi-e2e-playground-clone-smoke",
    experimentDescription:
      "PXI playground prompt tools smoke test: clone_prompt_instance tool.",
  },
  playgroundRejectSmoke: {
    id: "pxi-playground-prompt-smoke:reject-edit-v1",
    prompt:
      "Edit the playground prompt to add a system message saying 'You are a pirate.' I want to review the diff first.",
    expectedOutput:
      "PXI proposes an edit that the user rejects, and the change is not applied.",
    experimentNamePrefix: "pxi-e2e-playground-reject-smoke",
    experimentDescription:
      "PXI playground prompt tools smoke test: edit_prompt_instance with reject flow.",
  },
  playgroundNavigationCancelSmoke: {
    id: "pxi-playground-prompt-smoke:navigation-cancels-edit-v1",
    prompt:
      "Edit the playground prompt to add a system message saying 'NAVIGATION CANCEL MARKER'. Wait for me to accept or reject the change.",
    expectedOutput:
      "PXI proposes an edit, then the pending edit is cancelled when the user leaves the playground before review.",
    experimentNamePrefix: "pxi-e2e-playground-navigation-cancel-smoke",
    experimentDescription:
      "PXI playground prompt tools smoke test: pending edit_prompt_instance is cancelled on route navigation.",
  },
  ingestTracesSmoke: {
    id: "pxi-ingest-traces-smoke:chat-and-summary",
    prompt: "Say hello in one short sentence.",
    expectedOutput: "Assistant produces any non-empty greeting response.",
    experimentNamePrefix: "pxi-e2e-ingest-traces-smoke",
    experimentDescription:
      "PXI ingest-traces smoke test: confirms chat + summary traces persist locally.",
  },
  codeEvaluatorDraftEditSmoke: {
    id: "pxi-code-evaluator-draft-smoke:edit-source-v1",
    prompt:
      "I'm on the Create Code Evaluator dialog. Read the current draft, then edit it to replace the body of the evaluate function so it returns 1.0 instead of whatever placeholder is there. Wait for me to accept or reject the change.",
    expectedOutput:
      "PXI reads the code-evaluator draft, proposes an edit with a diff preview, and waits for user approval before the source editor is updated.",
    experimentNamePrefix: "pxi-e2e-code-evaluator-draft-edit-smoke",
    experimentDescription:
      "PXI code-evaluator draft tools smoke test: read_code_evaluator_draft + edit_code_evaluator_draft with accept flow.",
  },
  codeEvaluatorDraftRejectSmoke: {
    id: "pxi-code-evaluator-draft-smoke:reject-leaves-form-v1",
    prompt:
      "Edit the code-evaluator draft to replace the evaluate function body with a comment that says '# PXI REJECT MARKER'. Wait for me to review the diff before applying.",
    expectedOutput:
      "PXI proposes an edit that the user rejects; the source editor is unchanged after rejection.",
    experimentNamePrefix: "pxi-e2e-code-evaluator-draft-reject-smoke",
    experimentDescription:
      "PXI code-evaluator draft tools smoke test: edit_code_evaluator_draft with reject flow leaves source editor unchanged.",
  },
  codeEvaluatorDraftStaleProposeSmoke: {
    id: "pxi-code-evaluator-draft-smoke:stale-propose-v1",
    prompt:
      "Read the current code-evaluator draft, then edit it to add a comment '# stale propose marker' at the top of the evaluate function body. Wait for me to accept or reject.",
    expectedOutput:
      "PXI's proposed edit is rejected at propose-time because the draft revision changed between read and propose; the propose-time error string is surfaced to the user.",
    experimentNamePrefix: "pxi-e2e-code-evaluator-draft-stale-propose-smoke",
    experimentDescription:
      "PXI code-evaluator draft tools smoke test: propose-time stale-revision guard surfaces the canonical error string.",
  },
  codeEvaluatorDraftStaleAcceptSmoke: {
    id: "pxi-code-evaluator-draft-smoke:stale-accept-v1",
    prompt:
      "Read the current code-evaluator draft, then edit it to add a comment '# stale accept marker' at the top of the evaluate function body. Wait for me to accept or reject the change.",
    expectedOutput:
      "PXI proposes the edit; when the user bumps the draft revision before clicking Accept, the accept-time guard surfaces the canonical error string and the source editor is not updated to the proposed text.",
    experimentNamePrefix: "pxi-e2e-code-evaluator-draft-stale-accept-smoke",
    experimentDescription:
      "PXI code-evaluator draft tools smoke test: accept-time stale-revision guard surfaces the canonical error string.",
  },
  codeEvaluatorDraftToolsAbsentSmoke: {
    id: "pxi-code-evaluator-draft-smoke:tools-absent-v1",
    prompt:
      "Read the current code-evaluator draft and tell me what its evaluate function does.",
    expectedOutput:
      "With no code-evaluator form open, PXI does not invoke read_code_evaluator_draft or edit_code_evaluator_draft and explains it cannot read a draft because none is open.",
    experimentNamePrefix: "pxi-e2e-code-evaluator-draft-tools-absent-smoke",
    experimentDescription:
      "PXI code-evaluator draft tools smoke test: draft tools are absent when no code-evaluator form is mounted.",
  },
  createCodeEvaluatorHappySmoke: {
    id: "pxi-create-code-evaluator-smoke:happy-path-v1",
    prompt:
      "Create a new Python code evaluator named ${name} that scores how well an agent's output matches a reference answer. Define `evaluate(output, reference)` that returns 1.0 when `output` and `reference` are equal (case-insensitive, trimmed) and 0.0 otherwise. Do not configure a sandbox.",
    expectedOutput:
      "PXI calls create_code_evaluator with sandbox_config_id: null; the new evaluator is persisted and retrievable by id via the GraphQL node query.",
    experimentNamePrefix: "pxi-e2e-create-code-evaluator-happy",
    experimentDescription:
      "PXI direct-authoring tool: create_code_evaluator happy-path with graphql.mutations capability disabled.",
  },
  createCodeEvaluatorBadRequestSmoke: {
    id: "pxi-create-code-evaluator-smoke:bad-request-v1",
    prompt:
      "Create a Python code evaluator named ${name} with this exact source code (do not change the function name or parameters): `def score(output, reference):\\n    return 1.0 if output == reference else 0.0`. Do not configure a sandbox.",
    expectedOutput:
      "PXI's create_code_evaluator call returns a BadRequest with the server's signature-validation message surfaced verbatim; no evaluator is created.",
    experimentNamePrefix: "pxi-e2e-create-code-evaluator-bad-request",
    experimentDescription:
      "PXI direct-authoring tool: server BadRequest on unparseable evaluate() signature surfaces verbatim.",
  },
  createCodeEvaluatorToolAbsentSmoke: {
    id: "pxi-create-code-evaluator-smoke:tool-absent-v1",
    prompt:
      "Create a new Python code evaluator named pxi-tool-absent-marker that returns 1.0 for every input.",
    expectedOutput:
      "create_code_evaluator is absent from the tool list while a code-evaluator form is open; PXI uses edit_code_evaluator_draft instead.",
    experimentNamePrefix: "pxi-e2e-create-code-evaluator-tool-absent",
    experimentDescription:
      "PXI direct-authoring tool: create_code_evaluator absence when the code-evaluator form is mounted (dual side of context include_for_run).",
  },
  createCodeEvaluatorWithOutputConfigSmoke: {
    id: "pxi-create-code-evaluator-smoke:with-output-config-v1",
    prompt:
      "Create a new Python code evaluator named ${name} that scores how similar an agent's output is to a reference answer on a scale from 0 to 1. Define `evaluate(output, reference)` that returns 1.0 when `output` and `reference` are equal (case-insensitive, trimmed) and 0.0 otherwise. Configure the evaluator's annotation surface so higher scores are better (optimization_direction MAXIMIZE) and the good/bad cutoff is 0.7. Pick a Python sandbox config.",
    expectedOutput:
      "PXI calls create_code_evaluator with an output_config carrying optimization_direction=MAXIMIZE and threshold=0.7; the persisted CodeEvaluator's output_configs round-trip a single freeform entry whose name equals the evaluator's name.",
    experimentNamePrefix: "pxi-e2e-create-code-evaluator-with-output-config",
    experimentDescription:
      "PXI direct-authoring tool: create_code_evaluator authors a single freeform output config at creation time and the persisted output_configs round-trip via GraphQL.",
  },
  createCodeEvaluatorProposalDatasetSmoke: {
    id: "pxi-create-code-evaluator-proposal:dataset-surface-v1",
    prompt:
      "Create a Python code evaluator named ${name} for this dataset. Define `evaluate(output, reference)` that returns 1.0 when output equals reference (case-insensitive, trimmed) and 0.0 otherwise. Pick a Python sandbox config.",
    expectedOutput:
      "On a dataset surface, PXI proposes a PendingCodeEvaluatorCreate; clicking Accept persists a global CodeEvaluator AND attaches it to the active dataset via createDatasetCodeEvaluator. The dataset's evaluators tab shows the new row.",
    experimentNamePrefix: "pxi-e2e-create-code-evaluator-proposal-dataset",
    experimentDescription:
      "PXI create_code_evaluator chassis flow: on a dataset surface the proposal accept fires the chained createCodeEvaluator -> createDatasetCodeEvaluator path.",
  },
  createCodeEvaluatorProposalStandaloneSmoke: {
    id: "pxi-create-code-evaluator-proposal:standalone-surface-v1",
    prompt:
      "Create a Python code evaluator named ${name}. Define `evaluate(output)` that returns 1.0 if output is non-empty and 0.0 otherwise. Pick a Python sandbox config.",
    expectedOutput:
      "On a non-dataset surface, PXI proposes a PendingCodeEvaluatorCreate; clicking Accept persists only the global CodeEvaluator. No DatasetEvaluator binding is created.",
    experimentNamePrefix: "pxi-e2e-create-code-evaluator-proposal-standalone",
    experimentDescription:
      "PXI create_code_evaluator chassis flow: on a non-dataset surface the proposal accept fires the standalone createCodeEvaluator only.",
  },
  createCodeEvaluatorViewerGateSmoke: {
    id: "pxi-create-code-evaluator-gate:viewer-v1",
    prompt:
      "Create a Python code evaluator named ${name} that returns 1.0 for non-empty output. Pick any Python sandbox config.",
    expectedOutput:
      "Signed in as a viewer, PXI does not advertise create_code_evaluator. The assistant explains it does not have the affordance; no proposal renders and no mutation fires.",
    experimentNamePrefix: "pxi-e2e-create-code-evaluator-viewer-gate",
    experimentDescription:
      "PXI capability gate: viewer role silently strips create_code_evaluator from the advertised toolset (D7 viewer denial path).",
  },
  createCodeEvaluatorNoSandboxGateSmoke: {
    id: "pxi-create-code-evaluator-gate:no-sandbox-v1",
    prompt:
      "Create a Python code evaluator named ${name} on this dataset. Define `evaluate(output)` that returns 1.0 for non-empty output.",
    expectedOutput:
      "With no usable sandbox config enabled, PXI does not advertise create_code_evaluator. The dataset context instruction template tells the assistant to direct the user to /settings/sandboxes.",
    experimentNamePrefix: "pxi-e2e-create-code-evaluator-no-sandbox-gate",
    experimentDescription:
      "PXI capability gate: with no enabled sandbox config the create tool is hidden and the dataset context advises /settings/sandboxes.",
  },
} as const;

type PxiExperimentExample =
  (typeof PXI_EXPERIMENT_EXAMPLES)[keyof typeof PXI_EXPERIMENT_EXAMPLES];

type JudgeResult = {
  label: "pass" | "fail";
  score: number;
  explanation: string;
};

type ExperimentRecord = {
  example: PxiExperimentExample;
  assistantText: string;
  transcript?: unknown;
  calledTools: string[];
  url: string;
  durationMs: number;
  judgeResult: JudgeResult;
  assistantModel: string;
  assistantProvider: string;
  judgeModel: string;
  judgeProvider: string;
  playwrightProject: string;
};

async function expectOK(
  response: Awaited<ReturnType<APIRequestContext["post"]>>
) {
  if (!response.ok()) {
    throw new Error(
      `Phoenix API request failed: ${response.status()} ${await response.text()}`
    );
  }
  return response.json() as Promise<{ data: Record<string, unknown> }>;
}

function getExperimentUrl(path: string) {
  return new URL(path, EXPERIMENT_BASE_URL).toString();
}

function getExperimentHeaders() {
  return {
    "Content-Type": "application/json",
    ...(EXPERIMENT_BEARER_TOKEN
      ? { Authorization: `Bearer ${EXPERIMENT_BEARER_TOKEN}` }
      : {}),
  };
}

function getDatasetExamples() {
  return Object.values(PXI_EXPERIMENT_EXAMPLES);
}

export async function persistPxiExperiment({
  request,
  record,
}: {
  request: APIRequestContext;
  record: ExperimentRecord;
}) {
  const datasetExamples = getDatasetExamples();
  const datasetResponse = await expectOK(
    await request.post(getExperimentUrl("/v1/datasets/upload?sync=true"), {
      headers: getExperimentHeaders(),
      data: {
        action: "update",
        name: DATASET_NAME,
        description:
          "PXI Playwright E2E scenarios persisted from browser-driven tests.",
        inputs: datasetExamples.map((example) => ({ prompt: example.prompt })),
        outputs: datasetExamples.map((example) => ({
          expected: example.expectedOutput,
        })),
        metadata: datasetExamples.map((example) => ({
          kind: "pxi-playwright-e2e",
          scenario: example.id,
        })),
        example_ids: datasetExamples.map((example) => example.id),
      },
    })
  );
  const datasetId = datasetResponse.data.dataset_id;
  if (typeof datasetId !== "string") {
    throw new Error("Dataset upload response did not include dataset_id.");
  }

  const examplesResponse = await request.get(
    getExperimentUrl(`/v1/datasets/${datasetId}/examples`),
    {
      headers: getExperimentHeaders(),
    }
  );
  const examplesBody = await expectOK(examplesResponse);
  const examples = examplesBody.data.examples;
  if (!Array.isArray(examples) || examples.length === 0) {
    throw new Error("Dataset examples response did not include examples.");
  }
  const datasetExample = examples.find((example) => {
    return (
      typeof example === "object" &&
      example !== null &&
      (example as { id?: unknown }).id === record.example.id
    );
  }) as { node_id?: unknown } | undefined;
  if (typeof datasetExample?.node_id !== "string") {
    throw new Error("Dataset example did not include node_id.");
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const experimentResponse = await expectOK(
    await request.post(
      getExperimentUrl(`/v1/datasets/${datasetId}/experiments`),
      {
        headers: getExperimentHeaders(),
        data: {
          name: `${record.example.experimentNamePrefix}-${timestamp}`,
          description: record.example.experimentDescription,
          repetitions: 1,
          metadata: {
            assistantModel: record.assistantModel,
            assistantProvider: record.assistantProvider,
            judgeModel: record.judgeModel,
            judgeProvider: record.judgeProvider,
            playwrightProject: record.playwrightProject,
            kind: "pxi-playwright-e2e",
          },
        },
      }
    )
  );
  const experimentId = experimentResponse.data.id;
  if (typeof experimentId !== "string") {
    throw new Error("Create experiment response did not include id.");
  }

  const now = new Date();
  const runResponse = await expectOK(
    await request.post(
      getExperimentUrl(`/v1/experiments/${experimentId}/runs`),
      {
        headers: getExperimentHeaders(),
        data: {
          dataset_example_id: datasetExample.node_id,
          output: {
            prompt: record.example.prompt,
            assistantText: record.assistantText,
            transcript: record.transcript,
            calledTools: record.calledTools,
            url: record.url,
            durationMs: record.durationMs,
            judgeResult: record.judgeResult,
          },
          repetition_number: 1,
          start_time: new Date(now.getTime() - record.durationMs).toISOString(),
          end_time: now.toISOString(),
        },
      }
    )
  );
  const experimentRunId = runResponse.data.id;
  if (typeof experimentRunId !== "string") {
    throw new Error("Create experiment run response did not include id.");
  }

  await expectOK(
    await request.post(getExperimentUrl("/v1/experiment_evaluations"), {
      headers: getExperimentHeaders(),
      data: {
        experiment_run_id: experimentRunId,
        name: "pxi_outcome",
        annotator_kind: "LLM",
        start_time: now.toISOString(),
        end_time: now.toISOString(),
        result: {
          label: record.judgeResult.label,
          score: record.judgeResult.score,
          explanation: record.judgeResult.explanation,
        },
        metadata: {
          judgeModel: record.judgeModel,
          judgeProvider: record.judgeProvider,
        },
      },
    })
  );

  return { datasetId, experimentId, experimentRunId };
}
