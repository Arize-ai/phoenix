import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import {
  Environment,
  Network,
  Observable,
  type RequestParameters,
  RecordSource,
  Store,
  type Variables,
} from "relay-runtime";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { ProviderForm, type ProviderFormData } from "../CustomProviderForm";
import { createDefaultFormData } from "../customProviderFormUtils";

installTestMatchMedia();

type Sent = { name: string; variables: Variables };

describe("CustomProviderForm decision models", () => {
  let container: HTMLDivElement;
  let root: Root;
  let sent: Sent[];

  beforeEach(() => {
    sent = [];
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function environment() {
    return new Environment({
      network: Network.create(
        (request: RequestParameters, variables: Variables) => {
          sent.push({ name: request.name, variables });
          return Observable.from(
            Promise.resolve({
              data: {
                testGenerativeModelCustomProviderDecisionEndpoint: {
                  error: null,
                  url: "https://api.typesafe.ai/v1/systemone",
                },
              },
            })
          );
        }
      ),
      store: new Store(new RecordSource()),
    });
  }

  function render(initialValues?: ProviderFormData) {
    act(() => {
      root.render(
        <RelayEnvironmentProvider environment={environment()}>
          <ThemeProvider themeMode="light" disableBodyTheme>
            <ProviderForm
              onSubmit={vi.fn()}
              onCancel={vi.fn()}
              initialValues={initialValues}
            />
          </ThemeProvider>
        </RelayEnvironmentProvider>
      );
    });
  }

  const decisionSwitch = () => {
    const input = container.querySelector<HTMLInputElement>(
      'input[role="switch"]'
    );
    if (!input) throw new Error("no decision models switch");
    return input;
  };
  const preview = () =>
    container.querySelector('[data-testid="decision-endpoint"]')?.textContent;
  const input = (placeholder: string) => {
    const element = container.querySelector<HTMLInputElement>(
      `input[placeholder="${placeholder}"]`
    );
    if (!element) throw new Error(`no input with placeholder ${placeholder}`);
    return element;
  };

  it("pre-fills the base URL from the chat base URL and previews the exact POST URL", async () => {
    const user = userEvent.setup();
    render();
    expect(decisionSwitch().checked).toBe(false);
    expect(preview()).toBeUndefined();

    await act(() =>
      user.type(input("https://api.openai.com/v1"), "https://proxy.example/v1")
    );
    await act(() => user.click(decisionSwitch()));
    expect(decisionSwitch().checked).toBe(true);
    expect(input("https://proxy.example/v1").value).toBe(
      "https://proxy.example/v1"
    );
    expect(preview()).toBe("POST https://proxy.example/v1/decisions");
  });

  it("previews System One's URL and sends the decision settings to the endpoint test", async () => {
    const user = userEvent.setup();
    render({
      ...(createDefaultFormData("OPENAI") as ProviderFormData),
      name: "proxy",
      openai_api_key: "sk-test",
      decision_enabled: true,
      decision_sdk: "TYPESAFE",
      decision_base_url: "https://api.typesafe.ai/v1",
    } as ProviderFormData);
    // System One adds its own /v1, so a trailing one is dropped.
    expect(preview()).toBe("POST https://api.typesafe.ai/v1/systemone");

    const button = [...container.querySelectorAll("button")].find(
      (candidate) => candidate.textContent === "Test decision endpoint"
    );
    if (!button) throw new Error("no test button");
    await act(() => user.click(button));
    const call = sent.find(
      (request) => request.name === "DecisionModelsSectionTestMutation"
    );
    expect(call?.variables.input).toMatchObject({
      openai: {
        decisionModels: {
          decisionSdk: "TYPESAFE",
          baseUrl: "https://api.typesafe.ai/v1",
        },
      },
    });
    expect(container.textContent).toContain("Decision endpoint works");
  });

  it("keeps a TypeSafe provider on System One at its own base URL", () => {
    render({
      ...(createDefaultFormData("TYPESAFE") as ProviderFormData),
      name: "ts",
      typesafe_base_url: "https://system-one.example",
    } as ProviderFormData);
    expect(decisionSwitch().checked).toBe(true);
    expect(decisionSwitch().disabled).toBe(true);
    expect(preview()).toBe("POST https://system-one.example/v1/systemone");
    // Its credential test is its decision endpoint test.
    expect(container.textContent).not.toContain("Test Credentials");
  });

  it("offers no decision section on SDKs that cannot serve decisions", () => {
    render({
      ...(createDefaultFormData("ANTHROPIC") as ProviderFormData),
      name: "anthropic",
    });
    expect(container.querySelector('input[role="switch"]')).toBeNull();
    expect(container.textContent).toContain("Test Credentials");
  });
});
