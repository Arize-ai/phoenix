import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import {
  createHttp,
  http as rawHttp,
  passthrough,
} from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { context, propagation, trace } from "@opentelemetry/api";
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  TracerProvider,
} from "@opentelemetry/sdk-trace";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  asEvaluator,
  runExperiment,
} from "../../src/experiments/runExperiment";
import { createTestClient } from "../testUtils";

const TASK_PROJECT_NAME = "lifecycle-experiment-project";
const EVALUATOR_PROJECT_NAME = "evaluators";
const EXAMPLE_IDS = ["ex-1", "ex-2"];

let collector: HttpServer;
let baseUrl: string;
let http: ReturnType<typeof createHttp>;
let server: Server;
let exportRequests: string[] = [];

beforeAll(async () => {
  collector = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      exportRequests.push(Buffer.concat(chunks).toString("latin1"));
      response.writeHead(200).end();
    });
  });
  await new Promise<void>((resolve) =>
    collector.listen(0, "127.0.0.1", resolve)
  );
  baseUrl = `http://127.0.0.1:${(collector.address() as AddressInfo).port}`;
  http = createHttp({ baseUrl });
  server = await createMockServer({ baseUrl });
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
  trace.disable();
  context.disable();
  propagation.disable();
});

afterAll(async () => {
  server.close();
  await new Promise((resolve) => collector.close(resolve));
});

function countExportedSpans({
  projectName,
  spanName,
}: {
  projectName: string;
  spanName: string;
}) {
  return exportRequests
    .filter((body) => body.includes(projectName))
    .reduce((total, body) => total + body.split(spanName).length - 1, 0);
}

describe("runExperiment tracer provider lifecycle", () => {
  beforeEach(() => {
    exportRequests = [];
    let runCount = 0;
    const timestamp = new Date().toISOString();
    server.use(
      rawHttp.post(`${baseUrl}/v1/traces`, () => passthrough()),
      http.get("/v1/datasets/{id}", ({ response }) =>
        response(200).json({
          data: {
            id: "dataset-1",
            name: "lifecycle-dataset",
            description: null,
            metadata: {},
            created_at: timestamp,
            updated_at: timestamp,
            example_count: EXAMPLE_IDS.length,
          },
        })
      ),
      http.get("/v1/datasets/{id}/examples", ({ response }) =>
        response(200).json({
          data: {
            dataset_id: "dataset-1",
            version_id: "v1",
            filtered_splits: [],
            examples: EXAMPLE_IDS.map((id) => ({
              id,
              node_id: id,
              input: { question: id },
              output: { answer: id },
              metadata: {},
              updated_at: timestamp,
            })),
          },
        })
      ),
      http.post("/v1/datasets/{dataset_id}/experiments", ({ response }) =>
        response(200).json({
          data: {
            id: "exp-1",
            dataset_id: "dataset-1",
            dataset_version_id: "v1",
            project_name: TASK_PROJECT_NAME,
            repetitions: 1,
            metadata: {},
            created_at: timestamp,
            updated_at: timestamp,
            example_count: EXAMPLE_IDS.length,
            successful_run_count: 0,
            failed_run_count: 0,
            missing_run_count: EXAMPLE_IDS.length,
          },
        })
      ),
      http.get("/v1/experiments/{experiment_id}", ({ response }) =>
        response(200).json({
          data: {
            id: "exp-1",
            dataset_id: "dataset-1",
            dataset_version_id: "v1",
            project_name: TASK_PROJECT_NAME,
            repetitions: 1,
            metadata: {},
            created_at: timestamp,
            updated_at: timestamp,
            example_count: EXAMPLE_IDS.length,
            successful_run_count: EXAMPLE_IDS.length,
            failed_run_count: 0,
            missing_run_count: 0,
          },
        })
      ),
      http.post("/v1/experiments/{experiment_id}/runs", ({ response }) =>
        response(200).json({ data: { id: `run-${++runCount}` } })
      ),
      http.post("/v1/experiment_evaluations", ({ response }) =>
        response(200).json({ data: { id: "eval-1" } })
      )
    );
  });

  it("exports task and evaluation spans to separate projects and restores the global provider", async () => {
    const sentinelExporter = new InMemorySpanExporter();
    const sentinelProvider = new TracerProvider({
      spanProcessors: [new SimpleSpanProcessor({ exporter: sentinelExporter })],
    });
    trace.setGlobalTracerProvider(sentinelProvider);
    let globalTaskSpanCount = 0;

    await runExperiment({
      client: createTestClient({ baseUrl }),
      dataset: { datasetId: "dataset-1" },
      task: async ({ input }) => {
        trace.getTracer("user-code").startSpan("inside-task").end();
        globalTaskSpanCount += 1;
        return input;
      },
      evaluators: [
        asEvaluator({
          name: "exact-match",
          kind: "CODE",
          evaluate: async () => ({ score: 1, label: "correct" }),
        }),
      ],
      setGlobalTracerProvider: true,
    });

    expect(globalTaskSpanCount).toBe(EXAMPLE_IDS.length);
    expect(
      countExportedSpans({
        projectName: TASK_PROJECT_NAME,
        spanName: "Task: task",
      })
    ).toBe(EXAMPLE_IDS.length);
    expect(
      countExportedSpans({
        projectName: TASK_PROJECT_NAME,
        spanName: "inside-task",
      })
    ).toBe(EXAMPLE_IDS.length);
    expect(
      countExportedSpans({
        projectName: EVALUATOR_PROJECT_NAME,
        spanName: "Evaluation: exact-match",
      })
    ).toBe(EXAMPLE_IDS.length);
    expect(
      countExportedSpans({
        projectName: TASK_PROJECT_NAME,
        spanName: "Evaluation: ",
      })
    ).toBe(0);
    expect(sentinelExporter.getFinishedSpans()).toHaveLength(0);

    trace.getTracer("user-code").startSpan("after-experiment").end();
    expect(
      sentinelExporter.getFinishedSpans().map((span) => span.name)
    ).toEqual(["after-experiment"]);

    await sentinelProvider.shutdown();
  });
});
