import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { MemoryRouter, Route, Routes } from "react-router";
import { createMockEnvironment, MockPayloadGenerator } from "relay-test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { CustomProviderDetailsDrawer } from "../CustomProviderDetailsDrawer";

installTestMatchMedia();
installTestStorage();

const REDACTED_API_KEY = "redacted-api-key-ciphertext";
const HEADER_SECRET = "Bearer header-secret";

describe("CustomProviderDetailsDrawer", () => {
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

  async function renderDrawer() {
    await act(async () => {
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <ThemeProvider themeMode="light" disableBodyTheme>
            <MemoryRouter
              initialEntries={["/settings/providers/custom/provider-1"]}
            >
              <Routes>
                <Route
                  path="/settings/providers/custom/:providerId"
                  element={<CustomProviderDetailsDrawer />}
                />
              </Routes>
            </MemoryRouter>
          </ThemeProvider>
        </RelayEnvironmentProvider>
      );
    });
    await act(async () => {
      environment.mock.resolveMostRecentOperation((operation) =>
        MockPayloadGenerator.generate(operation, {
          Node: () => ({ __typename: "GenerativeModelCustomProvider" }),
          GenerativeModelCustomProvider: () => ({
            id: "provider-1",
            name: "gateway",
            description: "Company gateway",
            provider: "openai",
            sdk: "OPENAI",
            createdAt: "2026-11-17T12:00:00Z",
            updatedAt: "2026-11-17T12:00:00Z",
            user: null,
            modelTypes: ["CHAT", "DECISION"],
            models: {
              chat: { names: ["gpt-gateway"] },
              decision: { names: [] },
            },
            chatModelNames: ["gpt-gateway"],
            decisionModelNames: ["gpt-6-luna"],
            config: {
              __typename: "OpenAICustomProviderConfig",
              openaiApiType: "RESPONSES",
              openaiAuthenticationMethod: { apiKey: REDACTED_API_KEY },
              openaiClientKwargs: {
                baseUrl: "https://gateway.example.com/v1",
                organization: null,
                project: null,
                defaultHeaders: { Authorization: HEADER_SECRET },
              },
            },
          }),
        })
      );
    });
  }

  function readDetail(label: string): string | null | undefined {
    const term = [...document.querySelectorAll("dt")].find(
      (candidate) => candidate.textContent === label
    );
    return term?.nextElementSibling?.textContent;
  }

  function readSectionText(title: string): string | null | undefined {
    const section = [...document.querySelectorAll("section")].find(
      (candidate) => candidate.querySelector("h3")?.textContent === title
    );
    return section?.querySelector("ul, p, span")?.textContent;
  }

  it("shows the provider's connection and models", async () => {
    await renderDrawer();
    expect(readDetail("SDK")).toBe("OpenAI");
    expect(readDetail("Base URL")).toBe("https://gateway.example.com/v1");
    expect(readSectionText("Chat models")).toBe("gpt-gateway");
    expect(readSectionText("Decision models")).toBe("gpt-6-luna");
  });

  it("shows secrets as set and header names without their values", async () => {
    await renderDrawer();
    expect(readDetail("API key")).toBe("Set");
    expect(readDetail("Default headers")).toBe("Authorization");
    expect(document.body.textContent).not.toContain(REDACTED_API_KEY);
    expect(document.body.textContent).not.toContain(HEADER_SECRET);
  });
});
