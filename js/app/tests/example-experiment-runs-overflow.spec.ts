import { randomUUID } from "crypto";
import { expect, test } from "@playwright/test";

/**
 * Test for issue #14427: a long unbroken experiment run error widened the
 * Output column of the example details drawer's Experiment Runs table, pushing
 * the evaluations and the view trace action out of the visible drawer.
 */
test.describe("Example Experiment Runs Table Overflow", () => {
  // an error message with no spaces, like a long file path or identifier
  const LONG_ERROR_NO_SPACES = `FileNotFoundError:${"/very/long/path/segment".repeat(40)}`;
  const EVALUATION_NAME = "correctness";

  test("a long run error does not push evaluations or the trace action out of view", async ({
    page,
    request,
  }) => {
    const datasetName = `run-error-overflow-${randomUUID().slice(0, 8)}`;

    // 1. Create a dataset with a single example
    const createDatasetResponse = await request.post(
      "/v1/datasets/upload?sync=true",
      {
        data: {
          action: "create",
          name: datasetName,
          inputs: [{ question: "What is 2+2?" }],
          outputs: [{ answer: "4" }],
        },
      }
    );
    expect(createDatasetResponse.ok()).toBeTruthy();
    const datasetId: string = (await createDatasetResponse.json()).data
      .dataset_id;

    const examplesResponse = await request.get(
      `/v1/datasets/${datasetId}/examples`
    );
    expect(examplesResponse.ok()).toBeTruthy();
    const exampleId: string = (await examplesResponse.json()).data.examples[0]
      .id;

    // 2. Create an experiment on the dataset
    const createExperimentResponse = await request.post(
      `/v1/datasets/${datasetId}/experiments`,
      { data: { name: `experiment-${randomUUID().slice(0, 8)}` } }
    );
    expect(createExperimentResponse.ok()).toBeTruthy();
    const experiment = (await createExperimentResponse.json()).data;

    // 3. Record a trace in the experiment's project so the run has a trace to view
    const traceId = randomUUID().replace(/-/g, "");
    const now = new Date();
    const startTime = new Date(now.getTime() - 50).toISOString();
    const endTime = now.toISOString();
    const createSpanResponse = await request.post(
      `/v1/projects/${encodeURIComponent(experiment.project_name)}/spans`,
      {
        data: {
          data: [
            {
              name: "task",
              context: {
                trace_id: traceId,
                span_id: randomUUID().replace(/-/g, "").slice(0, 16),
              },
              span_kind: "CHAIN",
              parent_id: null,
              start_time: startTime,
              end_time: endTime,
              status_code: "ERROR",
              attributes: {},
            },
          ],
        },
      }
    );
    expect(createSpanResponse.ok()).toBeTruthy();
    // span ingestion is asynchronous, so wait for the trace to be queryable
    // before the drawer loads the run's trace
    await expect
      .poll(async () => {
        const spansResponse = await request.get(
          `/v1/projects/${encodeURIComponent(experiment.project_name)}/spans`
        );
        return (await spansResponse.json()).data.length;
      })
      .toBeGreaterThan(0);

    // 4. Record a run that failed with a long unbroken error, and evaluate it
    const createRunResponse = await request.post(
      `/v1/experiments/${experiment.id}/runs`,
      {
        data: {
          dataset_example_id: exampleId,
          output: null,
          repetition_number: 1,
          start_time: startTime,
          end_time: endTime,
          trace_id: traceId,
          error: LONG_ERROR_NO_SPACES,
        },
      }
    );
    expect(createRunResponse.ok()).toBeTruthy();
    const runId: string = (await createRunResponse.json()).data.id;

    const createEvaluationResponse = await request.post(
      "/v1/experiment_evaluations",
      {
        data: {
          experiment_run_id: runId,
          name: EVALUATION_NAME,
          annotator_kind: "CODE",
          start_time: startTime,
          end_time: endTime,
          result: { label: "incorrect", score: 0 },
        },
      }
    );
    expect(createEvaluationResponse.ok()).toBeTruthy();

    // 5. Open the example details drawer
    await page.goto(`/datasets/${datasetId}/examples/${exampleId}`);
    const runsTable = page.locator("table").filter({
      has: page.getByRole("columnheader", { name: "evaluations" }),
    });
    const viewTraceButton = runsTable.getByRole("button", {
      name: "view trace",
    });
    await expect(viewTraceButton).toBeVisible();
    await expect(
      runsTable.getByText(LONG_ERROR_NO_SPACES.slice(0, 40))
    ).toBeVisible();

    // 6. The evaluation and the trace action stay within the visible drawer
    await expect(
      runsTable.getByText(EVALUATION_NAME, { exact: true })
    ).toBeInViewport({ ratio: 1 });
    await expect(viewTraceButton).toBeInViewport({ ratio: 1 });

    // the table fits its scroll container instead of scrolling sideways
    const { scrollWidth, clientWidth } = await runsTable
      .locator("..")
      .evaluate((container) => ({
        scrollWidth: container.scrollWidth,
        clientWidth: container.clientWidth,
      }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

    // 7. The error is clamped to a few lines, with the full message on hover
    const errorText = runsTable.getByTitle(LONG_ERROR_NO_SPACES);
    await expect(errorText).toBeVisible();
    const isClamped = await errorText.evaluate(
      (element) => element.scrollHeight > element.clientHeight
    );
    expect(isClamped).toBe(true);
  });
});
