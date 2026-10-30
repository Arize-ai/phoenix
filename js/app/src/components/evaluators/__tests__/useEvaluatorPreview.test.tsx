import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type * as ReactRelay from "react-relay";

import {
  type EvaluatorPreview,
  type EvaluatorPreviewRequest,
  useEvaluatorPreview,
} from "@phoenix/components/evaluators/useEvaluatorPreview";
import { EvaluatorStoreProvider } from "@phoenix/contexts/EvaluatorContext";
import { DEFAULT_DECISION_EVALUATOR_STORE_VALUES } from "@phoenix/store/evaluatorStore";

const { commit } = vi.hoisted(() => ({ commit: vi.fn() }));
vi.mock("react-relay", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRelay>()),
  useMutation: () => [commit, false],
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

type CommitConfig = {
  variables: { input: { previews: object[] } };
  onCompleted: (
    response: object,
    errors: ReadonlyArray<{ message: string }> | null
  ) => void;
  onError: (error: Error) => void;
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
    function Harness({
      onRender,
    }: {
      onRender: (current: EvaluatorPreview) => void;
    }) {
      onRender(useEvaluatorPreview());
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
          <Harness onRender={(current) => (preview = current)} />
        </EvaluatorStoreProvider>
      )
    );
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  const lastCommit = () => commit.mock.calls.at(-1)?.[0] as CommitConfig;

  it("reports a definition that cannot be built without sending a request", async () => {
    let outcome: Awaited<ReturnType<EvaluatorPreview["run"]>> | undefined;
    await act(async () => {
      outcome = await preview.run(() => {
        throw new Error("Pick a decision model to test.");
      });
    });
    expect(commit).not.toHaveBeenCalled();
    expect(outcome).toEqual({
      ok: false,
      error: "Pick a decision model to test.",
    });
    expect(preview.error).toBe("Pick a decision model to test.");
  });

  it("previews the built evaluator against the store's mapping source", async () => {
    await act(async () => {
      void preview.run(() => REQUEST);
    });
    expect(lastCommit().variables.input.previews).toEqual([
      { context: SOURCE, ...REQUEST },
    ]);
  });

  it("keeps a decision annotation's typed result", async () => {
    await act(async () => {
      void preview.run(() => REQUEST);
    });
    const decision = { status: "ANSWERED", question: { name: "relevant" } };
    await act(async () =>
      lastCommit().onCompleted(
        {
          evaluatorPreviews: {
            results: [
              {
                evaluatorName: "quality",
                error: null,
                annotation: { id: "a", name: "quality", score: 1, decision },
              },
              { evaluatorName: "other", error: "Refused", annotation: null },
            ],
          },
        },
        null
      )
    );
    expect(preview.results).toEqual([
      {
        kind: "success",
        annotation: { id: "a", name: "quality", score: 1, decision },
      },
      { kind: "error", evaluatorName: "other", message: "Refused" },
    ]);
  });

  it("reports every GraphQL error the preview returns", async () => {
    await act(async () => {
      void preview.run(() => REQUEST);
    });
    await act(async () =>
      lastCommit().onCompleted({ evaluatorPreviews: { results: [] } }, [
        { message: "Unknown decision version" },
        { message: "Missing credentials" },
      ])
    );
    expect(preview.error).toBe("Unknown decision version\nMissing credentials");
    expect(preview.results).toEqual([]);
  });
});
