import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type * as ReactRelay from "react-relay";
import type * as RelayRuntime from "relay-runtime";

import { EvaluatorStoreProvider } from "@phoenix/contexts/EvaluatorContext";
import { useEvaluatorPreviewRuns } from "@phoenix/pages/project/evaluators/ProjectEvaluatorTestBench";
import type { RecordedRunRow } from "@phoenix/pages/project/evaluators/projectEvaluatorTestBenchTypes";
import { DEFAULT_CODE_EVALUATOR_STORE_VALUES } from "@phoenix/store/evaluatorStore";

const { subscribe } = vi.hoisted(() => ({ subscribe: vi.fn() }));
vi.mock("react-relay", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRelay>()),
  useRelayEnvironment: () => ({}),
}));
vi.mock("relay-runtime", async (importOriginal) => ({
  ...(await importOriginal<typeof RelayRuntime>()),
  requestSubscription: (_environment: unknown, config: object) => {
    subscribe(config);
    return { dispose: vi.fn() };
  },
}));
vi.mock("@phoenix/contexts/CredentialsContext", () => ({
  useCredentialsContext: (selector: (state: object) => unknown) => selector({}),
}));

type SubscriptionConfig = {
  variables: { input: { subjects: { key: string }[] } };
  onNext: (response: object) => void;
  onCompleted: () => void;
  onError: (error: unknown) => void;
};

type PreviewRuns = ReturnType<typeof useEvaluatorPreviewRuns>;

const row = (key: string): RecordedRunRow => ({
  key,
  name: key,
  recordId: key,
  context: { output: key },
  isSample: false,
});

const scored = (key: string, score: number) => ({
  evaluatorPreview: {
    key,
    error: null,
    results: [
      {
        evaluatorName: "score",
        error: null,
        annotation: {
          name: "score",
          label: null,
          score,
          explanation: null,
          decision: null,
        },
      },
    ],
  },
});

/**
 * A row tested again while an earlier stream still runs belongs to the newer
 * run: the earlier stream's result, error, or completion must not overwrite it.
 */
describe("useEvaluatorPreviewRuns with overlapping runs on one row", () => {
  let container: HTMLDivElement;
  let root: Root;
  let previewRuns: PreviewRuns;
  beforeEach(async () => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    function CaptureRuns({
      onCapture,
    }: {
      onCapture: (current: PreviewRuns) => void;
    }) {
      onCapture(useEvaluatorPreviewRuns({ codeEvaluatorId: "code-1" }));
      return null;
    }
    await act(async () =>
      root.render(
        <EvaluatorStoreProvider
          initialState={DEFAULT_CODE_EVALUATOR_STORE_VALUES}
        >
          <CaptureRuns onCapture={(current) => (previewRuns = current)} />
        </EvaluatorStoreProvider>
      )
    );
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  const subscription = (index: number) =>
    subscribe.mock.calls[index]?.[0] as SubscriptionConfig;

  /** Test all over x and y (stream A), then x again (stream B). */
  const startOverlappingRuns = async () => {
    await act(async () => previewRuns.runOnRows([row("x"), row("y")]));
    await act(async () => previewRuns.runOnRows([row("x")]));
    expect(subscribe).toHaveBeenCalledTimes(2);
    return { older: subscription(0), newer: subscription(1) };
  };

  it("keeps the newer run's result when the older stream reports the row last", async () => {
    const { older, newer } = await startOverlappingRuns();
    await act(async () => newer.onNext(scored("x", 1)));
    await act(async () => older.onNext(scored("x", 0)));
    await act(async () => older.onNext(scored("y", 0.5)));
    expect(previewRuns.runs.x).toMatchObject({ status: "done" });
    expect(
      previewRuns.runs.x?.status === "done" &&
        previewRuns.runs.x.results[0]?.annotation?.score
    ).toBe(1);
    expect(previewRuns.runs.y).toMatchObject({ status: "done" });
  });

  it("keeps the newer run going when the older stream reports the row first", async () => {
    const { older, newer } = await startOverlappingRuns();
    await act(async () => older.onNext(scored("x", 0)));
    expect(previewRuns.runs.x).toMatchObject({ status: "running" });
    await act(async () => newer.onNext(scored("x", 1)));
    expect(
      previewRuns.runs.x?.status === "done" &&
        previewRuns.runs.x.results[0]?.annotation?.score
    ).toBe(1);
  });

  it("does not stop the newer run when the older stream fails", async () => {
    const { older } = await startOverlappingRuns();
    await act(async () => older.onError(new Error("connection lost")));
    expect(previewRuns.runs.x).toMatchObject({ status: "running" });
    // The older stream still owned y, so y reverts and the error shows.
    expect(previewRuns.runs.y).toBeUndefined();
    expect(previewRuns.runError).toBe("connection lost");
  });

  it("ignores an older stream's error once every row it ran belongs to a newer run", async () => {
    await act(async () => previewRuns.runOnRows([row("x")]));
    await act(async () => previewRuns.runOnRows([row("x")]));
    await act(async () => subscription(0).onError(new Error("stale")));
    expect(previewRuns.runs.x).toMatchObject({ status: "running" });
    expect(previewRuns.runError).toBeNull();
  });

  it("does not mark the newer run's row missing when the older stream completes", async () => {
    const { older } = await startOverlappingRuns();
    await act(async () => older.onCompleted());
    expect(previewRuns.runs.x).toMatchObject({ status: "running" });
    expect(previewRuns.runs.y).toMatchObject({
      status: "error",
      message: "The preview returned no result for this record",
    });
  });
});
