import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type * as ReactRelay from "react-relay";
import type * as RelayRuntime from "relay-runtime";

import {
  type EvaluatorPreview,
  type EvaluatorPreviewRequest,
  useEvaluatorPreview,
} from "@phoenix/components/evaluators/useEvaluatorPreview";
import { EvaluatorStoreProvider } from "@phoenix/contexts/EvaluatorContext";
import { DEFAULT_DECISION_EVALUATOR_STORE_VALUES } from "@phoenix/store/evaluatorStore";

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

const SOURCE = {
  input: { question: "q" },
  output: { answer: "a" },
  metadata: {},
};
const REQUEST: EvaluatorPreviewRequest = {
  evaluator: { decisionEvaluatorId: "evaluator-1" },
  inputMapping: { pathMapping: { answer: "output" }, literalMapping: {} },
};

type SubscriptionConfig = {
  variables: { input: { subjects: object[] } };
  onNext: (response: object) => void;
  onCompleted: () => void;
  onError: (error: unknown) => void;
};

describe("useEvaluatorPreview", () => {
  let container: HTMLDivElement;
  let root: Root;
  let preview: EvaluatorPreview;
  beforeEach(async () => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    function CapturePreview({
      onCapture,
    }: {
      onCapture: (current: EvaluatorPreview) => void;
    }) {
      onCapture(useEvaluatorPreview());
      return null;
    }
    await act(async () =>
      root.render(
        <EvaluatorStoreProvider
          initialState={{
            ...DEFAULT_DECISION_EVALUATOR_STORE_VALUES,
            evaluatorMappingSource: { recordKind: "dataset", source: SOURCE },
          }}
        >
          <CapturePreview onCapture={(current) => (preview = current)} />
        </EvaluatorStoreProvider>
      )
    );
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  const lastSubscription = () =>
    subscribe.mock.calls.at(-1)?.[0] as SubscriptionConfig;

  it("reports a definition that cannot be built without sending a request", async () => {
    let outcome: Awaited<ReturnType<EvaluatorPreview["run"]>> | undefined;
    await act(async () => {
      outcome = await preview.run(() => {
        throw new Error("Pick a decision model to test.");
      });
    });
    expect(subscribe).not.toHaveBeenCalled();
    expect(outcome).toEqual({
      ok: false,
      error: "Pick a decision model to test.",
    });
    expect(preview.error).toBe("Pick a decision model to test.");
  });

  it("previews the built evaluator against the store's mapping source as one subject", async () => {
    await act(async () => {
      void preview.run(() => REQUEST);
    });
    expect(lastSubscription().variables.input).toMatchObject({
      ...REQUEST,
      subjects: [{ id: "subject", context: SOURCE }],
    });
    expect(preview.isRunning).toBe(true);
  });

  it("keeps a decision annotation's typed result and reports a missing annotation", async () => {
    let outcome: Awaited<ReturnType<EvaluatorPreview["run"]>> | undefined;
    await act(async () => {
      void preview.run(() => REQUEST).then((result) => (outcome = result));
    });
    const decision = { status: "ANSWERED", question: { name: "relevant" } };
    const results = [
      {
        evaluatorName: "quality",
        error: null,
        annotation: { id: "a", name: "quality", score: 1, decision },
      },
      { evaluatorName: "other", error: "Refused", annotation: null },
      { evaluatorName: "empty", error: null, annotation: null },
    ];
    await act(async () => {
      lastSubscription().onNext({
        evaluatorPreview: { id: "subject", error: null, results },
      });
      lastSubscription().onCompleted();
    });
    expect(preview.results).toEqual([
      {
        kind: "success",
        annotation: { id: "a", name: "quality", score: 1, decision },
      },
      { kind: "error", evaluatorName: "other", message: "Refused" },
      {
        kind: "error",
        evaluatorName: "empty",
        message: "The evaluator returned no annotation.",
      },
    ]);
    expect(outcome).toEqual({ ok: true, output: { results } });
    expect(preview.isRunning).toBe(false);
  });

  it("reports the subject's own error", async () => {
    await act(async () => {
      void preview.run(() => REQUEST);
    });
    await act(async () => {
      lastSubscription().onNext({
        evaluatorPreview: {
          id: "subject",
          error: "The Monty runtime is busy. Retry shortly.",
          results: [],
        },
      });
      lastSubscription().onCompleted();
    });
    expect(preview.error).toBe("The Monty runtime is busy. Retry shortly.");
    expect(preview.results).toEqual([]);
  });

  it("reports every GraphQL error the preview stream returns", async () => {
    await act(async () => {
      void preview.run(() => REQUEST);
    });
    await act(async () =>
      lastSubscription().onError([
        { message: "Unknown decision version" },
        { message: "Missing credentials" },
      ])
    );
    expect(preview.error).toBe("Unknown decision version\nMissing credentials");
    expect(preview.results).toEqual([]);
    expect(preview.isRunning).toBe(false);
  });
});
