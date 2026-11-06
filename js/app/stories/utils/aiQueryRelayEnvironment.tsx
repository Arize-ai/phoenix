import type { ReactNode } from "react";
import { RelayEnvironmentProvider } from "react-relay";
import { Environment, Network, RecordSource, Store } from "relay-runtime";

/**
 * A canned Relay environment for AI-search stories: the model-provider
 * picker (`ModelMenu`) loads its providers and models over Relay, so the
 * stories answer every query with a small fixed catalog instead of a
 * network. No requests leave the story.
 */
const environment = new Environment({
  network: Network.create(async () => ({
    data: {
      generativeModelCustomProviders: { edges: [] },
      modelProviders: [
        {
          key: "OPENAI",
          name: "OpenAI",
          dependenciesInstalled: true,
          credentialsSet: false,
        },
        {
          key: "ANTHROPIC",
          name: "Anthropic",
          dependenciesInstalled: true,
          credentialsSet: false,
        },
      ],
      playgroundModels: [
        { name: "gpt-5.6-luna", providerKey: "OPENAI" },
        { name: "gpt-5.5", providerKey: "OPENAI" },
        { name: "claude-sonnet-5", providerKey: "ANTHROPIC" },
      ],
    },
  })),
  store: new Store(new RecordSource()),
});

export function AIQueryRelayEnvironment({ children }: { children: ReactNode }) {
  return (
    <RelayEnvironmentProvider environment={environment}>
      {children}
    </RelayEnvironmentProvider>
  );
}
