import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { createMockEnvironment, MockPayloadGenerator } from "relay-test-utils";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { useModelMenuData } from "@phoenix/components/generative/useModelMenuData";
import { CredentialsProvider } from "@phoenix/contexts/CredentialsContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { EditCustomProviderButton } from "../EditCustomProviderButton";

installTestMatchMedia();

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

it("preserves saved models when repairing an unreadable connection", async () => {
  const environment = createMockEnvironment();
  const user = userEvent.setup();
  await act(async () => {
    root.render(
      <RelayEnvironmentProvider environment={environment}>
        <ThemeProvider themeMode="light" disableBodyTheme>
          <EditCustomProviderButton
            providerId="provider-id"
            providerName="proxy"
          />
        </ThemeProvider>
      </RelayEnvironmentProvider>
    );
  });
  const edit = container.querySelector<HTMLButtonElement>(
    'button[aria-label="Edit provider"]'
  );
  if (!edit) throw new Error("Missing edit button");
  await act(() => user.click(edit));
  await act(async () => {
    environment.mock.resolveMostRecentOperation((operation) =>
      MockPayloadGenerator.generate(operation, {
        Node: () => ({ __typename: "GenerativeModelCustomProvider" }),
        GenerativeModelCustomProvider: () => ({
          id: "provider-id",
          name: "proxy",
          description: null,
          sdk: "OPENAI",
          provider: "openai",
          user: null,
          models: {
            chat: { names: ["chat-custom"] },
            decision: { names: ["decision-custom"] },
          },
          config: {
            __typename: "UnparsableConfig",
            parseError: "Cannot decrypt",
          },
        }),
      })
    );
  });
  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog?.textContent).toContain("Cannot decrypt");
  expect(
    dialog?.querySelector<HTMLInputElement>('input[role="switch"]')?.checked
  ).toBe(true);
  const values = [
    ...(dialog?.querySelectorAll<HTMLInputElement>("input") ?? []),
  ].map((input) => input.value);
  expect(values).toContain("chat-custom");
  expect(values).toContain("decision-custom");

  const apiKey = dialog?.querySelector<HTMLInputElement>(
    'input[placeholder="sk-..."]'
  );
  if (!apiKey) throw new Error("Missing API key input");
  await act(() => user.type(apiKey, "sk-new"));
  const submit = [...(dialog?.querySelectorAll("button") ?? [])].find(
    (button) => button.textContent === "Update Provider"
  );
  if (!submit) throw new Error("Missing update button");
  await act(() => user.click(submit));
  const input =
    environment.mock.getMostRecentOperation().request.variables.input;
  expect(input.clientConfig.openai.openaiAuthenticationMethod).toEqual({
    apiKey: "sk-new",
  });
  expect(input.models).toBeUndefined();
});

it("updates a mounted model menu's custom provider model names in the Relay store on patch", async () => {
  const environment = createMockEnvironment();
  const user = userEvent.setup();
  function MenuReader() {
    const chat = useModelMenuData({
      modelType: "CHAT",
      includeDecisionModels: true,
    });
    const decision = useModelMenuData({
      modelType: "DECISION",
      includeDecisionModels: true,
    });
    return (
      <output>
        {JSON.stringify({
          chat: chat.customProviders[0]?.modelNames ?? [],
          decision: decision.customProviders[0]?.modelNames ?? [],
        })}
      </output>
    );
  }

  const readMenuModels = () =>
    JSON.parse(container.querySelector("output")?.textContent ?? "{}");

  await act(async () => {
    root.render(
      <RelayEnvironmentProvider environment={environment}>
        <ThemeProvider themeMode="light" disableBodyTheme>
          <CredentialsProvider>
            <Suspense fallback={null}>
              <MenuReader />
            </Suspense>
            <EditCustomProviderButton
              providerId="provider-id"
              providerName="proxy"
            />
          </CredentialsProvider>
        </ThemeProvider>
      </RelayEnvironmentProvider>
    );
  });

  // Resolve initial useModelMenuDataQuery
  await act(async () => {
    environment.mock.resolveMostRecentOperation((operation) =>
      MockPayloadGenerator.generate(operation, {
        GenerativeModelCustomProvider: () => ({
          id: "provider-id",
          name: "proxy",
          sdk: "OPENAI",
          modelTypes: ["CHAT"],
          modelNames: ["old-chat"],
          decisionModelNames: [],
        }),
      })
    );
  });
  expect(readMenuModels()).toEqual({ chat: ["old-chat"], decision: [] });

  const edit = container.querySelector<HTMLButtonElement>(
    'button[aria-label="Edit provider"]'
  );
  if (!edit) throw new Error("Missing edit button");
  await act(() => user.click(edit));

  await act(async () => {
    environment.mock.resolveMostRecentOperation((operation) =>
      MockPayloadGenerator.generate(operation, {
        Node: () => ({ __typename: "GenerativeModelCustomProvider" }),
        GenerativeModelCustomProvider: () => ({
          id: "provider-id",
          name: "proxy",
          description: null,
          sdk: "OPENAI",
          provider: "openai",
          user: null,
          models: {
            chat: { names: ["old-chat"] },
            decision: null,
          },
          config: {
            __typename: "OpenAICustomProviderConfig",
            openaiApiType: "RESPONSES",
            openaiAuthenticationMethod: { apiKey: "sk-stored" },
            openaiClientKwargs: null,
          },
        }),
      })
    );
  });

  const dialog = document.querySelector('[role="dialog"]');
  const switchInput = dialog?.querySelector<HTMLInputElement>(
    'input[role="switch"]'
  );
  if (!switchInput) throw new Error("Missing decision switch");
  await act(() => user.click(switchInput));

  const submit = [...(dialog?.querySelectorAll("button") ?? [])].find(
    (button) => button.textContent === "Update Provider"
  );
  if (!submit) throw new Error("Missing update button");
  await act(() => user.click(submit));

  await act(async () => {
    environment.mock.resolveMostRecentOperation((operation) =>
      MockPayloadGenerator.generate(operation, {
        GenerativeModelCustomProvider: () => ({
          id: "provider-id",
          name: "proxy",
          description: null,
          sdk: "OPENAI",
          provider: "openai",
          modelTypes: ["CHAT", "DECISION"],
          modelNames: ["new-chat"],
          decisionModelNames: ["gpt-6-luna"],
        }),
      })
    );
  });

  expect(readMenuModels()).toEqual({
    chat: ["new-chat"],
    decision: ["gpt-6-luna"],
  });
});
