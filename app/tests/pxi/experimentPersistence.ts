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
  routeLinkSmoke: {
    id: "pxi-route-link-smoke:data-retention-policy-v1",
    prompt:
      "Link me to where I can configure data retention policy in Phoenix.",
    expectedOutput:
      "PXI calls get_route_info and answers with a root-relative /settings/data markdown link.",
    experimentNamePrefix: "pxi-e2e-route-link-smoke",
    experimentDescription:
      "PXI route-info smoke test: get_route_info tool selection and internal link generation.",
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
): Promise<{ data: Record<string, unknown> }> {
  if (!response.ok()) {
    throw new Error(
      `Phoenix API request failed: ${response.status()} ${await response.text()}`
    );
  }
  return response.json();
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
  const datasetExample: { node_id?: unknown } | undefined = examples.find(
    (example) => {
      if (typeof example !== "object" || example === null) {
        return false;
      }
      const candidate: { id?: unknown } = example;
      return candidate.id === record.example.id;
    }
  );
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
