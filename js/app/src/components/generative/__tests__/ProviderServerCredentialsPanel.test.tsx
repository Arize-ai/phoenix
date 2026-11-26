import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { createMockEnvironment } from "relay-test-utils";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { ThemeProvider } from "@phoenix/contexts";

import type { ProviderServerCredentialsPanelProvider } from "../ProviderServerCredentialsPanel";
import { ProviderServerCredentialsPanel } from "../ProviderServerCredentialsPanel";

installTestMatchMedia();
installTestStorage();

const notifySuccess = vi.hoisted(() => vi.fn());

vi.mock("@phoenix/contexts", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNotifySuccess: () => notifySuccess,
}));

const SECRETS_QUERY = "ProviderServerCredentialsPanelSecretsQuery";
const UPSERT_OR_DELETE_SECRETS_MUTATION =
  "ProviderServerCredentialsPanelUpsertOrDeleteSecretsMutation";

const ENVIRONMENT_PLACEHOLDER =
  "•••••••• (set via server environment variable)";
const ENVIRONMENT_DESCRIPTION =
  "Set via a server environment variable. A value saved here overrides it.";
const OVERRIDE_DESCRIPTION =
  "Overrides the server environment variable. Clear to go back to it.";
const ENVIRONMENT_ALERT =
  "AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY are set via server environment variables and can only be removed on the server.";

const AWS_PROVIDER: ProviderServerCredentialsPanelProvider = {
  key: "AWS",
  name: "AWS Bedrock",
  credentialRequirements: [
    {
      envVarName: "AWS_ACCESS_KEY_ID",
      isRequired: true,
      isSetInServerEnvironment: true,
    },
    {
      envVarName: "AWS_SECRET_ACCESS_KEY",
      isRequired: true,
      isSetInServerEnvironment: true,
    },
    {
      envVarName: "AWS_SESSION_TOKEN",
      isRequired: false,
      isSetInServerEnvironment: false,
    },
  ],
  credentialsSet: true,
};

function secretsPayload(storedSecrets: Record<string, string>) {
  return {
    data: {
      secrets: {
        edges: Object.entries(storedSecrets).map(([key, value]) => ({
          node: {
            id: `Secret:${key}`,
            key,
            value: { __typename: "DecryptedSecret", value },
          },
        })),
      },
    },
  };
}

const MUTATION_PAYLOAD = {
  data: {
    upsertOrDeleteSecrets: {
      __typename: "UpsertOrDeleteSecretsMutationPayload",
    },
  },
};

describe("ProviderServerCredentialsPanel", () => {
  let container: HTMLDivElement;
  let root: Root;
  let environment: ReturnType<typeof createMockEnvironment>;
  const onCredentialsUpdated = vi.fn();

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    environment = createMockEnvironment();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    notifySuccess.mockReset();
    onCredentialsUpdated.mockReset();
  });

  /**
   * Resolves the most recent pending operation, checking that it is the one
   * the test expects, and returns its variables.
   */
  async function resolveOperation({
    name,
    payload,
  }: {
    name: string;
    payload: { data: Record<string, unknown> };
  }) {
    const operation = environment.mock.getMostRecentOperation();
    expect(operation.request.node.params.name).toBe(name);
    await act(async () => {
      environment.mock.resolve(operation, payload);
    });
    return operation.request.variables;
  }

  async function renderPanel(storedSecrets: Record<string, string> = {}) {
    await act(async () => {
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <ThemeProvider themeMode="light" disableBodyTheme>
            <Suspense fallback={null}>
              <ProviderServerCredentialsPanel
                provider={AWS_PROVIDER}
                onCredentialsUpdated={onCredentialsUpdated}
              />
            </Suspense>
          </ThemeProvider>
        </RelayEnvironmentProvider>
      );
    });
    await resolveOperation({
      name: SECRETS_QUERY,
      payload: secretsPayload(storedSecrets),
    });
  }

  const getInput = (name: string) =>
    container.querySelector<HTMLInputElement>(`input[name="${name}"]`);

  const getDescription = (name: string) =>
    (getInput(name)?.getAttribute("aria-describedby") ?? "")
      .split(" ")
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join("");

  const getButton = (text: string) =>
    Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === text
    );

  const pressButton = async (text: string) => {
    await act(async () => {
      getButton(text)?.click();
    });
  };

  it("marks each field that a server environment variable provides", async () => {
    await renderPanel();

    expect(container.textContent).toContain(ENVIRONMENT_ALERT);
    for (const name of ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"]) {
      const input = getInput(name);
      expect(input?.value).toBe("");
      expect(input?.placeholder).toBe(ENVIRONMENT_PLACEHOLDER);
      expect(getDescription(name)).toBe(ENVIRONMENT_DESCRIPTION);
    }
    expect(getInput("AWS_SESSION_TOKEN")?.placeholder).toBe("");
    expect(getDescription("AWS_SESSION_TOKEN")).toBe("");
  });

  it("says when a stored secret overrides the environment variable", async () => {
    await renderPanel({ AWS_ACCESS_KEY_ID: "stored-key" });

    expect(container.textContent).toContain(
      "AWS_SECRET_ACCESS_KEY is set via a server environment variable and can only be removed on the server."
    );
    const input = getInput("AWS_ACCESS_KEY_ID");
    expect(input?.value).toBe("stored-key");
    expect(input?.placeholder).not.toBe(ENVIRONMENT_PLACEHOLDER);
    expect(getDescription("AWS_ACCESS_KEY_ID")).toBe(OVERRIDE_DESCRIPTION);
    expect(getDescription("AWS_SECRET_ACCESS_KEY")).toBe(
      ENVIRONMENT_DESCRIPTION
    );
  });

  it("refetches the secrets after saving and shows the saved overrides", async () => {
    await renderPanel();

    await act(async () => {
      await userEvent.type(getInput("AWS_ACCESS_KEY_ID")!, "new-key");
      await userEvent.type(getInput("AWS_SECRET_ACCESS_KEY")!, "new-secret");
    });
    await pressButton("Save");

    const mutationVariables = await resolveOperation({
      name: UPSERT_OR_DELETE_SECRETS_MUTATION,
      payload: MUTATION_PAYLOAD,
    });
    expect(mutationVariables).toEqual({
      input: {
        secrets: [
          { key: "AWS_ACCESS_KEY_ID", value: "new-key" },
          { key: "AWS_SECRET_ACCESS_KEY", value: "new-secret" },
        ],
      },
    });
    expect(onCredentialsUpdated).toHaveBeenCalledTimes(1);

    // The panel must ask the server again rather than trust the old result
    await resolveOperation({
      name: SECRETS_QUERY,
      payload: secretsPayload({
        AWS_ACCESS_KEY_ID: "new-key",
        AWS_SECRET_ACCESS_KEY: "new-secret",
      }),
    });

    expect(container.textContent).not.toContain(
      "can only be removed on the server"
    );
    expect(getDescription("AWS_ACCESS_KEY_ID")).toBe(OVERRIDE_DESCRIPTION);
    expect(getDescription("AWS_SECRET_ACCESS_KEY")).toBe(OVERRIDE_DESCRIPTION);
    expect(getButton("Clear")).toBeDefined();
  });

  it("refetches the secrets after clearing and falls back to the environment variables", async () => {
    await renderPanel({
      AWS_ACCESS_KEY_ID: "stored-key",
      AWS_SECRET_ACCESS_KEY: "stored-secret",
      AWS_SESSION_TOKEN: "stored-token",
    });
    expect(container.textContent).not.toContain(
      "can only be removed on the server"
    );

    await pressButton("Clear");

    const mutationVariables = await resolveOperation({
      name: UPSERT_OR_DELETE_SECRETS_MUTATION,
      payload: MUTATION_PAYLOAD,
    });
    expect(mutationVariables).toEqual({
      input: {
        secrets: [
          { key: "AWS_ACCESS_KEY_ID", value: null },
          { key: "AWS_SECRET_ACCESS_KEY", value: null },
          { key: "AWS_SESSION_TOKEN", value: null },
        ],
      },
    });
    expect(onCredentialsUpdated).toHaveBeenCalledTimes(1);
    expect(notifySuccess).toHaveBeenCalledWith({
      title: "Secrets deleted",
      message:
        "3 secret(s) removed. AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY are now set via server environment variables.",
    });

    // The panel must ask the server again rather than keep the deleted secrets
    await resolveOperation({
      name: SECRETS_QUERY,
      payload: secretsPayload({}),
    });

    expect(container.textContent).toContain(ENVIRONMENT_ALERT);
    for (const name of ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"]) {
      const input = getInput(name);
      expect(input?.value).toBe("");
      expect(input?.placeholder).toBe(ENVIRONMENT_PLACEHOLDER);
      expect(getDescription(name)).toBe(ENVIRONMENT_DESCRIPTION);
    }
    expect(getInput("AWS_SESSION_TOKEN")?.value).toBe("");
    expect(getButton("Clear")).toBeUndefined();
  });
});
