import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { createMockEnvironment, MockPayloadGenerator } from "relay-test-utils";
import type { RelayMockEnvironment } from "relay-test-utils/lib/RelayModernMockEnvironment";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ViewportModal, ViewportModalOverlay } from "@phoenix/components";
import { ThemeProvider } from "@phoenix/contexts";
import { CredentialsProvider } from "@phoenix/contexts/CredentialsContext";

import type { ProviderCredentialsDialogProvider } from "../ProviderCredentialsDialog";
import { ProviderCredentialsDialog } from "../ProviderCredentialsDialog";

const isAdmin = vi.hoisted(() => ({ current: true }));

vi.mock("@phoenix/contexts/ViewerContext", () => ({
  useIsAdminOrAuthDisabled: () => isAdmin.current,
}));
vi.mock("@phoenix/contexts", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNotifySuccess: () => () => {},
}));

const REDACTED_TOKEN = "REDACTEDxyz9gAAAAABtoken";

const PROVIDER: ProviderCredentialsDialogProvider = {
  name: "OpenAI",
  key: "OPENAI",
  credentialRequirements: [
    {
      envVarName: "OPENAI_API_KEY",
      isRequired: true,
      isSetInEnvironment: true,
      isSetAsSecret: true,
    },
  ],
};

describe("ProviderCredentialsDialog", () => {
  let container: HTMLDivElement;
  let root: Root;
  let environment: RelayMockEnvironment;
  const onOpenChange = vi.fn();

  async function render({ browserKey }: { browserKey?: string } = {}) {
    environment = createMockEnvironment();
    await act(async () => {
      root.render(
        <ThemeProvider themeMode="light">
          <RelayEnvironmentProvider environment={environment}>
            <CredentialsProvider
              OPENAI={browserKey ? { OPENAI_API_KEY: browserKey } : undefined}
            >
              <ViewportModalOverlay isOpen onOpenChange={onOpenChange}>
                <ViewportModal size="M">
                  <ProviderCredentialsDialog provider={PROVIDER} />
                </ViewportModal>
              </ViewportModalOverlay>
            </CredentialsProvider>
          </RelayEnvironmentProvider>
        </ThemeProvider>
      );
    });
    await act(async () => {
      environment.mock.resolveMostRecentOperation((operation) =>
        MockPayloadGenerator.generate(operation, {
          Query: () => ({
            secrets: {
              edges: [
                {
                  node: {
                    key: "OPENAI_API_KEY",
                    value: {
                      __typename: "DecryptedSecret",
                      value: REDACTED_TOKEN,
                    },
                  },
                },
              ],
            },
          }),
        })
      );
    });
  }

  const fields = () =>
    Array.from(document.querySelectorAll<HTMLInputElement>("input"));
  const button = (text: string) =>
    Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (element) => element.textContent === text
    )!;

  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
    );
    isAdmin.current = true;
    onOpenChange.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("shows every source, with only the environment read-only for an admin", async () => {
    await render();
    const [browser, secret, environmentField] = fields();
    expect(browser.disabled).toBe(false);
    expect(secret.disabled).toBe(false);
    expect(secret.placeholder).toBe("••••xyz9");
    expect(environmentField.disabled).toBe(true);
    expect(environmentField.placeholder).toBe("••••••••");
    expect(button("Save").disabled).toBe(true);
  });

  it("shows the secret read-only to a viewer who is not an admin", async () => {
    isAdmin.current = false;
    await render();
    const [, secret] = fields();
    expect(secret.disabled).toBe(true);
    expect(secret.placeholder).toBe("••••••••");
  });

  it("returns to a clean, unflagged state when an edit is undone", async () => {
    await render();
    const [browser] = fields();
    const user = userEvent.setup();
    await act(async () => user.type(browser, "sk-typo"));
    expect(button("Save").disabled).toBe(false);
    await act(async () => user.clear(browser));
    expect(button("Save").disabled).toBe(true);
    expect(document.body.textContent).not.toContain("required");
  });

  it("marks a cleared saved secret for removal and saves it as a deletion", async () => {
    await render();
    const user = userEvent.setup();
    const clear = document.querySelectorAll<HTMLButtonElement>(
      'button[aria-label="Clear credential"]'
    );
    expect(clear).toHaveLength(1);
    await act(async () => user.click(clear[0]));
    expect(document.body.textContent).toContain("Removed when you save.");
    await act(async () => user.click(button("Save")));
    const operation = environment.mock.getMostRecentOperation();
    expect(operation.request.variables).toEqual({
      input: { secrets: [{ key: "OPENAI_API_KEY", value: null }] },
    });
  });

  it("closes on Cancel without saving", async () => {
    await render({ browserKey: "sk-saved" });
    const [browser] = fields();
    const user = userEvent.setup();
    await act(async () => user.type(browser, "-oops"));
    await act(async () => user.click(button("Cancel")));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(environment.mock.getAllOperations()).toHaveLength(0);
  });
});
