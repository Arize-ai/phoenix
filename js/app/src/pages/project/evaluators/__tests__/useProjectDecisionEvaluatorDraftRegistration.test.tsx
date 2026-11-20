import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type * as ReactRelay from "react-relay";

import type { DecisionEvaluatorDraft } from "@phoenix/components/evaluators/decision/useDecisionEvaluatorDraft";
import { AgentContext } from "@phoenix/contexts/AgentContext";
import { EvaluatorStoreProvider } from "@phoenix/contexts/EvaluatorContext";
import { useProjectDecisionEvaluatorDraftRegistration } from "@phoenix/pages/project/evaluators/useProjectDecisionEvaluatorDraftRegistration";
import { createAgentStore } from "@phoenix/store/agentStore";
import { DEFAULT_DECISION_EVALUATOR_STORE_VALUES } from "@phoenix/store/evaluatorStore";

vi.mock("react-relay", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRelay>()),
  useRelayEnvironment: () => ({}),
}));
vi.mock("@phoenix/contexts/PlaygroundContext", () => ({
  usePlaygroundStore: () => ({
    getState: () => ({ instances: [], templateFormat: "MUSTACHE" }),
  }),
}));

const DECISION_OPERATIONS = [
  "evaluators.decision.read",
  "evaluators.decision.edit",
  "evaluators.decision.submit",
];

type LoadState = Pick<
  DecisionEvaluatorDraft,
  "isLoading" | "isVersionReady" | "loadError"
>;

/**
 * An edit form loads its saved Decision version after it mounts; a read in
 * between would report the default draft as the saved evaluator.
 */
describe("useProjectDecisionEvaluatorDraftRegistration while the saved version loads", () => {
  let container: HTMLDivElement;
  let root: Root;
  const agentStore = createAgentStore();
  const registered = () =>
    DECISION_OPERATIONS.filter(
      (name) => name in agentStore.getState().registeredClientActions
    );
  function Registration({ loadState }: { loadState: LoadState }) {
    useProjectDecisionEvaluatorDraftRegistration({
      mode: "edit",
      evaluatorNodeId: "ProjectEvaluator:1",
      draft: { ...loadState } as DecisionEvaluatorDraft,
      submit: async () => ({ ok: false, error: "not under test" }),
    });
    return null;
  }
  const render = (loadState: LoadState) =>
    act(async () =>
      root.render(
        <AgentContext.Provider value={agentStore}>
          <EvaluatorStoreProvider
            initialState={DEFAULT_DECISION_EVALUATOR_STORE_VALUES}
          >
            <Registration loadState={loadState} />
          </EvaluatorStoreProvider>
        </AgentContext.Provider>
      )
    );
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("registers no operations until the saved version has loaded", async () => {
    await render({
      isLoading: true,
      isVersionReady: false,
      loadError: undefined,
    });
    expect(registered()).toEqual([]);

    await render({
      isLoading: false,
      isVersionReady: true,
      loadError: undefined,
    });
    expect(registered()).toEqual(DECISION_OPERATIONS);
  });

  it("registers them when the load fails, so PXI can read the error", async () => {
    await render({
      isLoading: false,
      isVersionReady: false,
      loadError: "The Decision version could not be loaded.",
    });
    expect(registered()).toEqual(DECISION_OPERATIONS);
  });
});
