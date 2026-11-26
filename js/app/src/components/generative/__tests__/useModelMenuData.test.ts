import { describe, expect, it } from "vitest";

import {
  getCustomProviders,
  getDecisionModelProviders,
} from "../useModelMenuData";

type Edges = Parameters<typeof getCustomProviders>[0]["edges"];

function provider({
  id,
  sdk,
  modelTypes,
  modelNames = [],
  decisionModelNames,
}: {
  id: string;
  sdk: Edges[number]["node"]["sdk"];
  modelTypes: Edges[number]["node"]["modelTypes"];
  modelNames?: string[];
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
    },
  };
}

const EDGES: Edges = [
  provider({
    id: "chat-only",
    sdk: "OPENAI",
    modelTypes: ["CHAT"],
    modelNames: ["gateway-gpt"],
    decisionModelNames: [],
  }),
  provider({
    id: "openai-decisions",
    sdk: "OPENAI",
    modelTypes: ["CHAT", "DECISION"],
    modelNames: ["gateway-gpt"],
    decisionModelNames: ["gpt-6-luna"],
  }),
  provider({
    id: "typesafe",
    sdk: "TYPESAFE",
    modelTypes: ["DECISION"],
    decisionModelNames: ["jev-custom"],
  }),
];

describe("getCustomProviders", () => {
  it("lists providers with decisions on, under their own SDK", () => {
    expect(getCustomProviders({ edges: EDGES, modelType: "DECISION" })).toEqual(
      [
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
    expect(getCustomProviders({ edges: EDGES, modelType: "CHAT" })).toEqual([
      {
        id: "chat-only",
        name: "chat-only",
        sdk: "OPENAI",
        modelNames: ["gateway-gpt"],
      },
      {
        id: "openai-decisions",
        name: "openai-decisions",
        sdk: "OPENAI",
        modelNames: ["gateway-gpt"],
      },
    ]);
  });

  it("lists no decision models for a provider queried without them", () => {
    const [edge] = EDGES.slice(1, 2);
    const withoutDecisionFields: Edges[number] = {
      node: {
        ...edge.node,
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
        id: "openai-decisions",
        name: "openai-decisions",
        sdk: "OPENAI",
        modelNames: [],
      },
    ]);
  });
});

type ModelProviderRows = Parameters<
  typeof getDecisionModelProviders
>[0]["modelProviders"];

function builtInProvider({
  key,
  modelTypes,
  decisionDependenciesInstalled,
}: {
  key: ModelProviderRows[number]["key"];
  modelTypes: ModelProviderRows[number]["modelTypes"];
  decisionDependenciesInstalled?: boolean;
}): ModelProviderRows[number] {
  return {
    key,
    name: key,
    dependenciesInstalled: true,
    decisionDependenciesInstalled,
    credentialsSet: true,
    modelTypes,
  };
}

describe("getDecisionModelProviders", () => {
  it("lists only providers that offer decision models", () => {
    const providers = getDecisionModelProviders({
      modelProviders: [
        builtInProvider({ key: "ANTHROPIC", modelTypes: ["CHAT"] }),
        builtInProvider({
          key: "TYPESAFE",
          modelTypes: ["DECISION"],
          decisionDependenciesInstalled: true,
        }),
        builtInProvider({
          key: "OPENAI",
          modelTypes: ["CHAT", "DECISION"],
          decisionDependenciesInstalled: true,
        }),
      ],
      localCredentials: {},
    });
    expect(providers.map((provider) => provider.key)).toEqual([
      "TYPESAFE",
      "OPENAI",
    ]);
  });

  it("enables a provider only when its decision client dependencies are installed", () => {
    const providers = getDecisionModelProviders({
      modelProviders: [
        builtInProvider({
          key: "OPENAI",
          modelTypes: ["CHAT", "DECISION"],
          decisionDependenciesInstalled: true,
        }),
        builtInProvider({
          key: "GOOGLE",
          modelTypes: ["CHAT", "DECISION"],
          decisionDependenciesInstalled: false,
        }),
        builtInProvider({ key: "TYPESAFE", modelTypes: ["DECISION"] }),
      ],
      localCredentials: {},
    });
    expect(
      providers.map(({ key, dependenciesInstalled }) => ({
        key,
        dependenciesInstalled,
      }))
    ).toEqual([
      { key: "OPENAI", dependenciesInstalled: true },
      { key: "GOOGLE", dependenciesInstalled: false },
      { key: "TYPESAFE", dependenciesInstalled: false },
    ]);
  });
});
