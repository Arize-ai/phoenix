import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import type * as ReactRelay from "react-relay";
import type * as RelayRuntime from "relay-runtime";

import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { PlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { ThemeContext } from "@phoenix/contexts/ThemeContext";
import { createPlaygroundStore } from "@phoenix/store/playground";

import type { PlaygroundDecisionOutputMutation } from "../__generated__/PlaygroundDecisionOutputMutation.graphql";
import type { DecisionRunResult } from "../decisionUtils";
import { createDecisionDraft } from "../decisionUtils";
import { PlaygroundDecisionOutput } from "../PlaygroundDecisionOutput";

const mocks = vi.hoisted(() => {
  const credentials = {};
  return {
    commitMutation: vi.fn(),
    dispose: vi.fn(),
    credentials,
    // One stable store object, as the context provides in production; a
    // fresh object per render would re-run the runner effect every render.
    credentialsStore: { getState: () => credentials },
    environment: {},
  };
});
vi.mock("relay-runtime", async (importOriginal) => ({
  ...(await importOriginal<typeof RelayRuntime>()),
  commitMutation: mocks.commitMutation,
}));
vi.mock("react-relay", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRelay>()),
  useRelayEnvironment: () => mocks.environment,
}));
vi.mock("@phoenix/contexts/CredentialsContext", () => ({
  useCredentialsStore: () => mocks.credentialsStore,
}));
vi.mock("../RunMetadataFooter", () => ({
  RunMetadataFooter: ({ spanId }: { spanId: string }) => (
    <div data-testid="run-footer">{spanId}</div>
  ),
}));

installTestStorage();

describe("decision execution", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.commitMutation.mockReturnValue({ dispose: mocks.dispose });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function mountRunningInstance() {
    const store = createPlaygroundStore({ modelConfigByProvider: {} });
    const chatInstance = store.getState().instances[0];
    // A decision instance as the model menu creates one from a chat instance.
    const instance = {
      ...chatInstance,
      llmModel: chatInstance.model,
      decisionRequest: createDecisionDraft(),
      model: {
        ...chatInstance.model,
        modelType: "DECISION" as const,
        provider: "TYPESAFE" as const,
        modelName: "jev-latest",
      },
    };
    store.setState({
      instances: [
        {
          ...instance,
          activeRunId: 0,
          repetitions: {
            1: {
              output: null,
              spanId: null,
              error: null,
              status: "pending",
              toolCalls: {},
            },
          },
        },
      ],
    });
    act(() =>
      root.render(
        <ThemeContext.Provider
          value={{
            theme: "dark",
            themeMode: "dark",
            systemTheme: "dark",
            setThemeMode: vi.fn(),
          }}
        >
          <PlaygroundContext.Provider value={store}>
            <PlaygroundDecisionOutput playgroundInstanceId={instance.id} />
          </PlaygroundContext.Provider>
        </ThemeContext.Provider>
      )
    );
    return { store, instanceId: instance.id };
  }

  function result(answers: DecisionRunResult["answers"]): DecisionRunResult {
    return {
      model: "jev-latest",
      answers,
      usage: { inputTokens: 10, outputTokens: 0 },
    };
  }

  function getMutation(index = 0) {
    return mocks.commitMutation.mock.calls[
      index
    ][1] as RelayRuntime.MutationConfig<PlaygroundDecisionOutputMutation>;
  }

  it("executes run ID zero and completes with structured output", async () => {
    const { store } = mountRunningInstance();
    expect(mocks.commitMutation).toHaveBeenCalledTimes(1);
    expect(getMutation().variables.input.questions[0]).toMatchObject({
      choice: { name: "department" },
    });
    await act(async () =>
      getMutation().onCompleted?.(
        {
          runDecision: {
            result: result([
              {
                __typename: "ChoiceAnswer",
                name: "department",
                choice: "billing",
                confidence: 0.9,
                choiceProbabilities: [{ value: "billing", probability: 0.9 }],
              },
            ]),
            error: null,
            span: null,
          },
        },
        null
      )
    );
    expect(store.getState().instances[0].activeRunId).toBeNull();
    expect(
      container.querySelector('[data-testid="answer-department"]')?.textContent
    ).toBe("billing");
    expect(container.textContent).toContain("0 out");
  });

  it("surfaces provider errors inline and retains the trace", async () => {
    const { store } = mountRunningInstance();
    await act(async () =>
      getMutation().onCompleted?.(
        {
          runDecision: {
            result: null,
            error: "Provider rejected the request",
            span: { id: "span-node", trace: { traceId: "trace-id" } },
          },
        },
        null
      )
    );
    expect(store.getState().instances[0].activeRunId).toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Provider rejected"
    );
    // The failed call still has a span, so the footer is mounted for it.
    expect(
      container.querySelector('[data-testid="run-footer"]')?.textContent
    ).toBe("span-node");
    expect(store.getState().instances[0].repetitions[1]?.spanId).toBe(
      "span-node"
    );
  });

  it("ignores late responses after cancellation", async () => {
    const { store } = mountRunningInstance();
    const originalMutation = getMutation();
    act(() => store.getState().cancelPlaygroundInstances());
    expect(mocks.dispose).toHaveBeenCalled();
    await act(async () =>
      originalMutation.onCompleted?.(
        {
          runDecision: {
            result: result([
              {
                __typename: "PredicateAnswer",
                name: "stale",
                probability: 0.5,
              },
            ]),
            error: null,
            span: null,
          },
        },
        null
      )
    );
    expect(store.getState().instances[0].repetitions[1]?.output).toBeNull();
    expect(container.textContent).not.toContain("stale");
  });

  it("runs repetitions sequentially and keeps independent results", async () => {
    const { store, instanceId } = mountRunningInstance();
    await act(async () =>
      getMutation().onCompleted?.(
        {
          runDecision: { result: result([]), error: null, span: null },
        },
        null
      )
    );
    mocks.commitMutation.mockClear();
    act(() => {
      store.getState().setRepetitions(2);
      store.getState().runPlaygroundInstances();
    });
    expect(mocks.commitMutation).toHaveBeenCalledTimes(1);
    await act(async () =>
      getMutation().onCompleted?.(
        {
          runDecision: {
            result: result([
              { __typename: "PredicateAnswer", name: "run1", probability: 0.5 },
            ]),
            error: null,
            span: null,
          },
        },
        null
      )
    );
    expect(mocks.commitMutation).toHaveBeenCalledTimes(2);
    expect(store.getState().instances[0].activeRunId).not.toBeNull();
    await act(async () =>
      getMutation(1).onCompleted?.(
        {
          runDecision: {
            result: result([
              { __typename: "PredicateAnswer", name: "run2", probability: 0.5 },
            ]),
            error: null,
            span: null,
          },
        },
        null
      )
    );
    expect(store.getState().instances[0].activeRunId).toBeNull();
    expect(store.getState().instances[0].repetitions[1]?.output).toContain(
      '"run1"'
    );
    expect(store.getState().instances[0].repetitions[2]?.output).toContain(
      '"run2"'
    );
    act(() => store.getState().setSelectedRepetitionNumber(instanceId, 2));
    expect(store.getState().instances[0].selectedRepetitionNumber).toBe(2);
  });

  it("does not display Relay request variables or credentials on errors", async () => {
    mountRunningInstance();
    await act(async () =>
      getMutation().onError?.(
        new Error(
          'Error fetching GraphQL query \'Decision\' with variables \'{"input":{"credentials":[{"value":"private-api-key"}],"state":{"message":"private-state"}}}\': [{"message":"Configure TYPESAFE_API_KEY"}]'
        )
      )
    );
    expect(container.textContent).toContain("Configure TYPESAFE_API_KEY");
    expect(container.textContent).not.toContain("private-api-key");
    expect(container.textContent).not.toContain("private-state");
    expect(container.textContent).not.toContain("variables");
  });
});
