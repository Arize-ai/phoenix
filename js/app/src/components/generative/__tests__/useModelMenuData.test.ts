import { describe, expect, it } from "vitest";

import { getCustomProviders } from "../useModelMenuData";

type Edges = Parameters<typeof getCustomProviders>[0]["edges"];

function provider({
  id,
  sdk,
  modelTypes,
  modelNames = [],
  decisionSdk,
  decisionModelNames,
}: {
  id: string;
  sdk: Edges[number]["node"]["sdk"];
  modelTypes: Edges[number]["node"]["modelTypes"];
  modelNames?: string[];
  decisionSdk: Edges[number]["node"]["decisionSdk"];
  decisionModelNames: string[];
}): Edges[number] {
  return {
    node: {
      id,
      name: id,
      sdk,
      modelTypes,
      modelNames,
      decisionModelNames,
      decisionSdk,
    },
  };
}

const EDGES: Edges = [
  provider({
    id: "chat-only",
    sdk: "OPENAI",
    modelTypes: ["LLM"],
    modelNames: ["gateway-gpt"],
    decisionSdk: null,
    decisionModelNames: [],
  }),
  provider({
    id: "openai-on-system-one",
    sdk: "OPENAI",
    modelTypes: ["LLM", "DECISION"],
    modelNames: ["gateway-gpt"],
    decisionSdk: "TYPESAFE",
    decisionModelNames: ["jev-latest"],
  }),
  provider({
    id: "openai-decisions",
    sdk: "AZURE_OPENAI",
    modelTypes: ["LLM", "DECISION"],
    decisionSdk: "OPENAI",
    decisionModelNames: ["gpt-6-luna"],
  }),
  provider({
    id: "typesafe",
    sdk: "TYPESAFE",
    modelTypes: ["DECISION"],
    decisionSdk: "TYPESAFE",
    decisionModelNames: ["jev-custom"],
  }),
];

describe("getCustomProviders", () => {
  it("lists providers with a decision client, under that client's SDK", () => {
    // The SDK decides the provider a decision is saved with, so an OpenAI-SDK
    // provider that runs System One is listed as TypeSafe.
    expect(getCustomProviders({ edges: EDGES, modelType: "DECISION" })).toEqual(
      [
        {
          id: "openai-on-system-one",
          name: "openai-on-system-one",
          sdk: "TYPESAFE",
          modelNames: ["jev-latest"],
        },
        {
          id: "openai-decisions",
          name: "openai-decisions",
          sdk: "OPENAI",
          modelNames: ["gpt-6-luna"],
        },
        {
          id: "typesafe",
          name: "typesafe",
          sdk: "TYPESAFE",
          modelNames: ["jev-custom"],
        },
      ]
    );
  });

  it("lists chat providers under their own SDK with their chat model names", () => {
    expect(getCustomProviders({ edges: EDGES, modelType: "LLM" })).toEqual([
      {
        id: "chat-only",
        name: "chat-only",
        sdk: "OPENAI",
        modelNames: ["gateway-gpt"],
      },
      {
        id: "openai-on-system-one",
        name: "openai-on-system-one",
        sdk: "OPENAI",
        modelNames: ["gateway-gpt"],
      },
      {
        id: "openai-decisions",
        name: "openai-decisions",
        sdk: "AZURE_OPENAI",
        modelNames: [],
      },
    ]);
  });

  it("lists no decision models for a provider queried without them", () => {
    const [edge] = EDGES.slice(1, 2);
    const withoutDecisionFields: Edges[number] = {
      node: {
        ...edge.node,
        decisionSdk: undefined,
        decisionModelNames: undefined,
      },
    };
    expect(
      getCustomProviders({
        edges: [withoutDecisionFields],
        modelType: "DECISION",
      })
    ).toEqual([
      {
        id: "openai-on-system-one",
        name: "openai-on-system-one",
        sdk: "OPENAI",
        modelNames: [],
      },
    ]);
  });
});
