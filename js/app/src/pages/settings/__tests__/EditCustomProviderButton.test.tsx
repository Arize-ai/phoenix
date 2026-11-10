import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { createMockEnvironment, MockPayloadGenerator } from "relay-test-utils";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
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
