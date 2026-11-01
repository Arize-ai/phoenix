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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ModelMenuValue } from "@phoenix/components/generative";

import {
  AgentModelCredentialForm,
  useAgentModelCredentialStatus,
} from "../AgentModelCredentialForm";

const viewer = vi.hoisted(() => ({ isAdmin: true }));

vi.mock("@phoenix/contexts/ViewerContext", () => ({
  useIsAdminOrAuthDisabled: () => viewer.isAdmin,
}));

vi.mock("@phoenix/components/generative", () => ({
  ProviderServerCredentialsPanel: ({
    provider,
  }: {
    provider: { name: string };
  }) => <div data-testid="credentials-panel">{provider.name}</div>,
}));

const MODEL_PROVIDERS = [
  {
    key: "ANTHROPIC",
    name: "Anthropic",
    credentialRequirements: [
      { envVarName: "ANTHROPIC_API_KEY", isRequired: true },
    ],
    credentialsSet: false,
  },
  {
    key: "AWS",
    name: "AWS Bedrock",
    credentialRequirements: [
      { envVarName: "AWS_ACCESS_KEY_ID", isRequired: true },
      { envVarName: "AWS_SECRET_ACCESS_KEY", isRequired: true },
      { envVarName: "AWS_SESSION_TOKEN", isRequired: false },
    ],
    credentialsSet: false,
  },
  {
    key: "OPENAI",
    name: "OpenAI",
    credentialRequirements: [
      { envVarName: "OPENAI_API_KEY", isRequired: true },
    ],
    credentialsSet: true,
  },
  {
    key: "OLLAMA",
    name: "Ollama",
    credentialRequirements: [],
    credentialsSet: false,
  },
];

function createEnvironment() {
  return new Environment({
    network: Network.create(() =>
      Observable.from(
        Promise.resolve({ data: { modelProviders: MODEL_PROVIDERS } })
      )
    ),
    store: new Store(new RecordSource()),
  });
}

function CredentialStatus({ value }: { value: ModelMenuValue }) {
  const { missingCredentials, refreshCredentialStatus } =
    useAgentModelCredentialStatus(value);
  if (!missingCredentials) {
    return <div data-testid="ready" />;
  }
  return (
    <AgentModelCredentialForm
      missingCredentials={missingCredentials}
      modelName={value.modelName}
      onCredentialsUpdated={refreshCredentialStatus}
    />
  );
}

describe("AgentModelCredentialForm", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    viewer.isAdmin = true;
  });

  async function renderStatus(value: ModelMenuValue) {
    await act(async () => {
      root.render(
        <RelayEnvironmentProvider environment={createEnvironment()}>
          <Suspense fallback={null}>
            <CredentialStatus value={value} />
          </Suspense>
        </RelayEnvironmentProvider>
      );
    });
  }

  const getPanel = () =>
    container.querySelector('[data-testid="credentials-panel"]');

  it("shows the blocking form for a provider without a key", async () => {
    await renderStatus({ provider: "ANTHROPIC", modelName: "claude-opus-5" });

    expect(container.textContent).toContain(
      "Anthropic credentials are not configured"
    );
    expect(getPanel()).not.toBeNull();
  });

  it("shows a note with the form collapsed for an ambient credential chain", async () => {
    await renderStatus({ provider: "AWS", modelName: "us.anthropic.claude" });

    expect(container.textContent).toContain(
      "AWS Bedrock credentials aren't configured in Phoenix"
    );
    expect(container.textContent).toContain("the AWS credential chain");
    expect(getPanel()).toBeNull();

    const toggle = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Add credentials"
    );
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    await act(async () => {
      toggle?.click();
    });
    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    expect(getPanel()).not.toBeNull();
  });

  it("offers no form to non-admins in the note", async () => {
    viewer.isAdmin = false;
    await renderStatus({ provider: "AWS", modelName: "us.anthropic.claude" });

    expect(container.textContent).toContain(
      "AWS Bedrock credentials aren't configured in Phoenix"
    );
    expect(container.textContent).toContain(
      "contact an administrator to configure AWS Bedrock credentials"
    );
    expect(container.querySelector("button")).toBeNull();
  });

  it("shows nothing when credentials are set or not needed", async () => {
    await renderStatus({ provider: "OPENAI", modelName: "gpt-5.4" });
    expect(container.querySelector('[data-testid="ready"]')).not.toBeNull();

    await renderStatus({ provider: "OLLAMA", modelName: "llama3.2:3b" });
    expect(container.querySelector('[data-testid="ready"]')).not.toBeNull();
  });

  it("shows nothing for a custom provider", async () => {
    await renderStatus({
      provider: "ANTHROPIC",
      modelName: "claude-opus-5",
      customProvider: { id: "custom-1", name: "Gateway" },
    });
    expect(container.querySelector('[data-testid="ready"]')).not.toBeNull();
  });
});
