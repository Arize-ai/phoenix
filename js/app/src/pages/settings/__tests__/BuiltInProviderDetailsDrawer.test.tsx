import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { MemoryRouter, Route, Routes } from "react-router";
import { createMockEnvironment, MockPayloadGenerator } from "relay-test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { BuiltInProviderDetailsDrawer } from "../BuiltInProviderDetailsDrawer";

installTestMatchMedia();
installTestStorage();

describe("BuiltInProviderDetailsDrawer", () => {
  let container: HTMLDivElement;
  let root: Root;
  let environment: ReturnType<typeof createMockEnvironment>;

  beforeEach(() => {
    environment = createMockEnvironment();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function renderDrawer(path: string) {
    await act(async () => {
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <ThemeProvider themeMode="light" disableBodyTheme>
            <MemoryRouter initialEntries={[path]}>
              <Routes>
                <Route
                  path="/settings/providers/built-in/:providerKey"
                  element={<BuiltInProviderDetailsDrawer />}
                />
              </Routes>
            </MemoryRouter>
          </ThemeProvider>
        </RelayEnvironmentProvider>
      );
    });
  }

  function readSection(title: string): Element | undefined {
    return [...document.querySelectorAll("section")].find(
      (section) => section.querySelector("h3")?.textContent === title
    );
  }

  it("lists the provider's credentials and the models of each type it serves", async () => {
    await renderDrawer("/settings/providers/built-in/FIREWORKS");
    await act(async () => {
      environment.mock.resolveMostRecentOperation((operation) =>
        MockPayloadGenerator.generate(operation, {
          Query: () => ({
            modelProviders: [
              {
                key: "FIREWORKS",
                name: "Fireworks",
                modelTypes: ["DECISION"],
                credentialsSet: false,
                credentialRequirements: [
                  { envVarName: "FIREWORKS_API_KEY", isRequired: true },
                ],
                chatDependencies: [],
                chatDependenciesInstalled: true,
                decisionDependencies: ["typesafe-sdk"],
                decisionDependenciesInstalled: false,
              },
            ],
            chatModels: [],
            decisionModels: [{ name: "accounts/fireworks/models/rune" }],
          }),
        })
      );
    });
    expect(readSection("Credentials")?.textContent).toContain(
      "FIREWORKS_API_KEY"
    );
    expect(readSection("Chat models")).toBeUndefined();
    const decisionModels = readSection("Decision models");
    expect(decisionModels?.querySelector("li")?.textContent).toBe(
      "accounts/fireworks/models/rune"
    );
    expect(decisionModels?.textContent).toContain("Not installed");
  });

  it("explains an unknown provider key without querying", async () => {
    await renderDrawer("/settings/providers/built-in/NOT_A_PROVIDER");
    expect(document.body.textContent).toContain("Provider not found");
    expect(environment.mock.getAllOperations()).toHaveLength(0);
  });
});
