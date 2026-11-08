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

const ENVIRONMENT_PLACEHOLDER =
  "•••••••• (set via server environment variable)";
const ENVIRONMENT_DESCRIPTION =
  "Set via a server environment variable. A value saved here overrides it.";
const OVERRIDE_DESCRIPTION =
  "Overrides the server environment variable. Clear to go back to it.";

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

function createEnvironment(storedSecrets: Record<string, string>) {
  const edges = Object.entries(storedSecrets).map(([key, value]) => ({
    node: {
      id: `Secret:${key}`,
      key,
      value: { __typename: "DecryptedSecret", value },
    },
  }));
  return new Environment({
    network: Network.create((operation) =>
      Observable.from(
        Promise.resolve(
          operation.operationKind === "mutation"
            ? {
                data: {
                  upsertOrDeleteSecrets: {
                    __typename: "UpsertOrDeleteSecretsMutationPayload",
                  },
                },
              }
            : { data: { secrets: { edges } } }
        )
      )
    ),
    store: new Store(new RecordSource()),
  });
}

describe("ProviderServerCredentialsPanel", () => {
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
    notifySuccess.mockReset();
  });

  async function renderPanel(storedSecrets: Record<string, string> = {}) {
    await act(async () => {
      root.render(
        <RelayEnvironmentProvider
          environment={createEnvironment(storedSecrets)}
        >
          <ThemeProvider themeMode="light" disableBodyTheme>
            <Suspense fallback={null}>
              <ProviderServerCredentialsPanel provider={AWS_PROVIDER} />
            </Suspense>
          </ThemeProvider>
        </RelayEnvironmentProvider>
      );
    });
  }

  const getInput = (name: string) =>
    container.querySelector<HTMLInputElement>(`input[name="${name}"]`);

  const getDescription = (name: string) =>
    (getInput(name)?.getAttribute("aria-describedby") ?? "")
      .split(" ")
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join("");

  it("marks each field that a server environment variable provides", async () => {
    await renderPanel();

    expect(container.textContent).toContain(
      "AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY are set via server environment variables and can only be removed on the server."
    );
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

  it("says which environment variables apply again after clearing", async () => {
    await renderPanel({
      AWS_ACCESS_KEY_ID: "stored-key",
      AWS_SECRET_ACCESS_KEY: "stored-secret",
      AWS_SESSION_TOKEN: "stored-token",
    });
    expect(container.textContent).not.toContain(
      "can only be removed on the server"
    );

    const clearButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Clear"
    );
    await act(async () => {
      clearButton?.click();
    });

    expect(notifySuccess).toHaveBeenCalledWith({
      title: "Secrets deleted",
      message:
        "3 secret(s) removed. AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY are now set via server environment variables.",
    });
  });
});
