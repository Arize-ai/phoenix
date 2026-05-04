import type { APIRequestContext } from "@playwright/test";

const DATASET_NAME = "PXI E2E Agent Tests";
const EXAMPLE_ID = "pxi-docs-smoke:tracing-project-env-var-v1";
const EXPERIMENT_BASE_URL =
  process.env.PXI_E2E_EXPERIMENT_BASE_URL ?? "http://localhost:6006";
const EXPERIMENT_BEARER_TOKEN = process.env.PXI_E2E_EXPERIMENT_BEARER_TOKEN;

type JudgeResult = {
  label: "pass" | "fail";
  score: number;
  explanation: string;
};

type ExperimentRecord = {
  prompt: string;
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

export async function persistPxiExperiment({
  request,
  record,
}: {
  request: APIRequestContext;
  record: ExperimentRecord;
}) {
  const datasetResponse = await expectOK(
    await request.post(getExperimentUrl("/v1/datasets/upload?sync=true"), {
      headers: getExperimentHeaders(),
      data: {
        action: "update",
        name: DATASET_NAME,
        description:
          "PXI Playwright E2E scenarios persisted from browser-driven tests.",
        inputs: [{ prompt: record.prompt }],
        outputs: [
          {
            expected:
              "Answer names PHOENIX_PROJECT_NAME and cites Phoenix docs.",
          },
        ],
        metadata: [{ kind: "pxi-playwright-e2e" }],
        example_ids: [EXAMPLE_ID],
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
      (example as { id?: unknown }).id === EXAMPLE_ID
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
          name: `pxi-e2e-docs-smoke-${timestamp}`,
          description:
            "PXI docs smoke test driven through the Phoenix frontend.",
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
            prompt: record.prompt,
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
