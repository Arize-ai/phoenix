import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import {
  Environment,
  Network,
  Observable,
  RecordSource,
  Store,
} from "relay-runtime";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CredentialsProvider } from "@phoenix/contexts/CredentialsContext";

import { type CustomProviderInfo, useModelMenuData } from "../useModelMenuData";

function provider(
  id: string,
  sdk: string,
  modelTypes: string[],
  decisionSdk: string | null,
  decisionModelNames: string[]
) {
  return {
    node: {
      __typename: "GenerativeModelCustomProvider",
      id,
      name: id,
      sdk,
      modelTypes,
      modelNames: [],
      decisionModelNames,
      decisionSdk,
    },
  };
}

const RESPONSE = {
  data: {
    generativeModelCustomProviders: {
      edges: [
        provider("chat-only", "OPENAI", ["LLM"], null, []),
        provider(
          "openai-on-system-one",
          "OPENAI",
          ["LLM", "DECISION"],
          "TYPESAFE",
          ["jev-latest"]
        ),
        provider(
          "openai-decisions",
          "AZURE_OPENAI",
          ["LLM", "DECISION"],
          "OPENAI",
          ["gpt-6-luna"]
        ),
      ],
    },
    modelProviders: [],
    playgroundModels: [],
    decisionModels: [],
  },
};

describe("useModelMenuData decision providers", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("lists custom providers with a decision client, under that client's SDK", async () => {
    let seen: CustomProviderInfo[] = [];
    function Probe() {
      seen = useModelMenuData({
        modelType: "DECISION",
        includeDecisionModels: true,
      }).customProviders;
      return null;
    }
    const environment = new Environment({
      network: Network.create(() => Observable.from(Promise.resolve(RESPONSE))),
      store: new Store(new RecordSource()),
    });
    await act(async () => {
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <CredentialsProvider>
            <Suspense fallback={null}>
              <Probe />
            </Suspense>
          </CredentialsProvider>
        </RelayEnvironmentProvider>
      );
    });
    // The SDK decides the provider a decision is saved with, so an OpenAI-SDK
    // provider that runs System One is listed as TypeSafe.
    expect(seen).toEqual([
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
    ]);
  });
});
