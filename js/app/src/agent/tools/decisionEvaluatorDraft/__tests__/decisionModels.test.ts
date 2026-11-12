import {
  applyDecisionDraftOperations,
  createEditDecisionEvaluatorDraftClientAction,
  type DecisionEvaluatorDraftHost,
  type DecisionModelOption,
  toDecisionModelOptions,
} from "@phoenix/agent/tools/decisionEvaluatorDraft";
import {
  grantScriptApproval,
  revokeScriptApproval,
} from "@phoenix/agent/uiOperations/scriptApprovalGrant";
import type { useModelMenuDataQuery } from "@phoenix/components/generative/__generated__/useModelMenuDataQuery.graphql";
import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import {
  createDecisionQuestion,
  createDecisionStateDraft,
} from "@phoenix/pages/playground/decisionUtils";

const CATALOG = {
  generativeModelCustomProviders: {
    edges: [
      {
        node: {
          id: "custom-1",
          name: "My decisions",
          sdk: "OPENAI",
          modelTypes: ["DECISION"],
          modelNames: [],
          decisionModelNames: ["house-decider"],
          decisionSdk: "OPENAI",
        },
      },
      {
        node: {
          id: "custom-2",
          name: "Chat only",
          sdk: "OPENAI",
          modelTypes: ["LLM"],
          modelNames: ["gpt-chat"],
          decisionModelNames: [],
          decisionSdk: null,
        },
      },
    ],
  },
  modelProviders: [
    {
      key: "TYPESAFE",
      name: "TypeSafe",
      dependenciesInstalled: true,
      credentialsSet: true,
      modelTypes: ["DECISION"],
    },
    {
      key: "ANTHROPIC",
      name: "Anthropic",
      dependenciesInstalled: true,
      credentialsSet: true,
      modelTypes: ["LLM"],
    },
  ],
  playgroundModels: [],
  decisionModels: [
    { name: "jev-latest", providerKey: "TYPESAFE", modelType: "DECISION" },
    { name: "jev-1.14.0", providerKey: "TYPESAFE", modelType: "DECISION" },
    { name: "not-offered", providerKey: "ANTHROPIC", modelType: "DECISION" },
  ],
} as unknown as useModelMenuDataQuery["response"];

const BASE = {
  name: "resolved",
  prompt: {
    state: createDecisionStateDraft({ text: "Request:\n{{input}}" }),
    questions: [
      createDecisionQuestion({
        type: "predicate",
        name: "resolved",
        instructions: "Does the reply resolve the request?",
      }),
    ],
  },
  scoringPolicy: null,
  inputMapping: { pathMapping: {}, literalMapping: {} },
  templateFormat: TemplateFormats.Mustache,
};

describe("toDecisionModelOptions", () => {
  it("lists what the model menu's Decision tab lists", () => {
    expect(toDecisionModelOptions(CATALOG)).toEqual([
      {
        target: {
          type: "builtin",
          provider: "TYPESAFE",
          modelName: "jev-latest",
        },
        provider: "TYPESAFE",
        customProviderName: null,
      },
      {
        target: {
          type: "builtin",
          provider: "TYPESAFE",
          modelName: "jev-1.14.0",
        },
        provider: "TYPESAFE",
        customProviderName: null,
      },
      {
        target: {
          type: "custom",
          customProviderId: "custom-1",
          modelName: "house-decider",
        },
        provider: "OPENAI",
        customProviderName: "My decisions",
      },
    ]);
  });
});

describe("set_model", () => {
  const availableModels = toDecisionModelOptions(CATALOG);

  it("picks a model the form offers", () => {
    const result = applyDecisionDraftOperations({
      ...BASE,
      availableModels,
      operations: [
        {
          type: "set_model",
          target: {
            type: "builtin",
            provider: "TYPESAFE",
            modelName: "jev-1.14.0",
          },
        },
      ],
    });
    expect(result).toMatchObject({
      ok: true,
      model: { target: { modelName: "jev-1.14.0" }, provider: "TYPESAFE" },
    });
  });

  it("refuses a model the form does not offer", () => {
    const result = applyDecisionDraftOperations({
      ...BASE,
      availableModels,
      operations: [
        {
          type: "set_model",
          target: {
            type: "builtin",
            provider: "ANTHROPIC",
            modelName: "not-offered",
          },
        },
      ],
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain("not a decision model");
  });

  it("leaves the model alone when no set_model is given", () => {
    const result = applyDecisionDraftOperations({
      ...BASE,
      operations: [{ type: "set_name", name: "other" }],
    });
    expect(result).toMatchObject({ ok: true, model: null });
  });
});

describe("decision draft edit client action with set_model", () => {
  const CALL_ID = "decision-model-call";
  beforeEach(() => grantScriptApproval(CALL_ID));
  afterEach(() => revokeScriptApproval(CALL_ID));

  it("loads the catalog and passes it to the host", async () => {
    const options: DecisionModelOption[] = toDecisionModelOptions(CATALOG);
    const applyOperations = vi.fn(() => ({
      ok: false as const,
      error: "stop here",
    }));
    const host: DecisionEvaluatorDraftHost = {
      getSnapshot: vi.fn(),
      loadAvailableModels: vi.fn(async () => options),
      applyOperations,
      submit: vi.fn(),
    };
    const edit = createEditDecisionEvaluatorDraftClientAction({
      getDraftHost: () => host,
    });
    const operations = [
      {
        type: "set_model",
        target: {
          type: "builtin",
          provider: "TYPESAFE",
          modelName: "jev-1.14.0",
        },
      },
    ];
    await edit({ operations }, { callId: `${CALL_ID}:1`, sessionId: "s" });
    expect(host.loadAvailableModels).toHaveBeenCalledOnce();
    expect(applyOperations).toHaveBeenCalledWith(operations, {
      availableModels: options,
    });
  });

  it("refuses the edit when the catalog cannot load", async () => {
    const host: DecisionEvaluatorDraftHost = {
      getSnapshot: vi.fn(),
      loadAvailableModels: vi.fn(async () => {
        throw new Error("network down");
      }),
      applyOperations: vi.fn(),
      submit: vi.fn(),
    };
    const edit = createEditDecisionEvaluatorDraftClientAction({
      getDraftHost: () => host,
    });
    const result = await edit(
      {
        operations: [
          {
            type: "set_model",
            target: {
              type: "builtin",
              provider: "TYPESAFE",
              modelName: "jev-latest",
            },
          },
        ],
      },
      { callId: `${CALL_ID}:1`, sessionId: "s" }
    );
    expect(result).toMatchObject({ ok: false });
    expect(host.applyOperations).not.toHaveBeenCalled();
  });
});
