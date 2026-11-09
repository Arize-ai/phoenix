import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { createMockEnvironment } from "relay-test-utils";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { ProviderForm, type ProviderFormData } from "../CustomProviderForm";
import { createDefaultFormData } from "../customProviderFormUtils";

installTestMatchMedia();

describe("CustomProviderForm decision models", () => {
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

  function render(
    initialValues?: ProviderFormData,
    onSubmit: (data: ProviderFormData) => void = vi.fn()
  ) {
    act(() => {
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <ThemeProvider themeMode="light" disableBodyTheme>
            <ProviderForm
              onSubmit={onSubmit}
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
  const input = (placeholder: string) => {
    const element = container.querySelector<HTMLInputElement>(
      `input[placeholder="${placeholder}"]`
    );
    if (!element) throw new Error(`no input with placeholder ${placeholder}`);
    return element;
  };

  it("turns decision models on without a URL of their own", async () => {
    const user = userEvent.setup();
    render();
    expect(decisionSwitch().checked).toBe(false);
    await act(() => user.click(decisionSwitch()));
    expect(decisionSwitch().checked).toBe(true);
    expect(container.textContent).not.toContain("Decision base URL");
    expect(container.textContent).not.toContain("POST ");
  });

  it("runs an OpenAI provider's decisions over its own protocol, with no other choice", async () => {
    const user = userEvent.setup();
    render();
    await act(() => user.click(decisionSwitch()));
    expect(container.textContent).toContain("OpenAI Decisions API");
    expect(container.textContent).not.toContain("Decision client");
  });

  it("shows only the decision heading while decision models are off", () => {
    render();
    const section = [...container.querySelectorAll("section")].find(
      (candidate) => candidate.textContent?.startsWith("Decision models")
    );
    expect(section?.querySelector(".provider-form-section__body")).toBeNull();
  });

  it("checks a TypeSafe provider's System One endpoint in the connection test", async () => {
    const user = userEvent.setup();
    render({
      ...(createDefaultFormData("TYPESAFE") as ProviderFormData),
      name: "ollama-system-one",
      typesafe_api_key: "ts-key",
      typesafe_base_url: "https://ollama.example",
    } as ProviderFormData);
    const button = [...container.querySelectorAll("button")].find(
      (candidate) => candidate.textContent === "Test connection"
    );
    if (!button) throw new Error("no test button");
    await act(() => user.click(button));
    const operation = environment.mock.getMostRecentOperation();
    expect(operation.request.variables.input).toMatchObject({
      typesafe: {
        typesafeClientKwargs: { baseUrl: "https://ollama.example" },
      },
    });
    expect(operation.request.variables.input.typesafe).not.toHaveProperty(
      "decisionModels"
    );
    expect(operation.request.variables.models).toEqual({
      decision: { names: [] },
    });
    await act(async () =>
      environment.mock.resolve(operation, {
        data: {
          testGenerativeModelCustomProviderCredentials: {
            error: null,
            chat: null,
            decision: { error: null },
          },
        },
      })
    );
    expect(container.textContent).toContain("Connection works");
    expect(container.textContent).toContain("Decision models: connected");
  });

  it("shows which model type failed the connection test", async () => {
    const user = userEvent.setup();
    render({
      ...(createDefaultFormData("OPENAI") as ProviderFormData),
      name: "proxy",
      openai_api_key: "sk-test",
      decision_enabled: true,
    } as ProviderFormData);
    const button = [...container.querySelectorAll("button")].find(
      (candidate) => candidate.textContent === "Test connection"
    );
    if (!button) throw new Error("no test button");
    await act(() => user.click(button));
    const operation = environment.mock.getMostRecentOperation();
    expect(operation.request.variables.models).toEqual({
      chat: { names: [] },
      decision: { names: [] },
    });
    await act(async () =>
      environment.mock.resolve(operation, {
        data: {
          testGenerativeModelCustomProviderCredentials: {
            error: "HTTP 401 from the endpoint. Check the API key.",
            chat: { error: null },
            decision: {
              error: "HTTP 401 from the endpoint. Check the API key.",
            },
          },
        },
      })
    );
    expect(container.textContent).toContain("Connection check failed");
    expect(container.textContent).toContain("Chat models: connected");
    expect(container.textContent).toContain(
      "HTTP 401 from the endpoint. Check the API key."
    );
  });

  it("keeps a TypeSafe provider's decision models on", () => {
    render({
      ...(createDefaultFormData("TYPESAFE") as ProviderFormData),
      name: "ts",
      typesafe_base_url: "https://system-one.example",
    } as ProviderFormData);
    expect(decisionSwitch().checked).toBe(true);
    expect(decisionSwitch().disabled).toBe(true);
    expect(container.textContent).toContain("Test connection");
  });

  it("offers no decision section on SDKs that cannot serve decisions", () => {
    render({
      ...(createDefaultFormData("ANTHROPIC") as ProviderFormData),
      name: "anthropic",
    });
    expect(container.querySelector('input[role="switch"]')).toBeNull();
    expect(container.textContent).toContain("Test connection");
  });

  it("offers suggested chat model names on chat SDKs", () => {
    render({
      ...(createDefaultFormData("ANTHROPIC") as ProviderFormData),
      name: "anthropic",
      model_names: "claude-gateway-sonnet",
    } as ProviderFormData);
    expect(input("qwen3-coder, llama-5-70b").value).toBe(
      "claude-gateway-sonnet"
    );
    expect(container.textContent).toContain("built-in Anthropic list");
  });

  it("folds optional fields away unless they have a value", () => {
    render();
    const organization = container.querySelector(
      'input[name="openai_organization"]'
    );
    expect(organization?.closest("[hidden]")).not.toBeNull();
    expect(container.textContent).toContain(
      "Organization, project and default headers"
    );
  });

  it("opens the optional fields when one has a value", () => {
    render({
      ...(createDefaultFormData("OPENAI") as ProviderFormData),
      name: "proxy",
      openai_api_key: "sk-test",
      openai_organization: "org-123",
    } as ProviderFormData);
    expect(
      container.querySelector<HTMLInputElement>(
        'input[name="openai_organization"]'
      )?.value
    ).toBe("org-123");
    expect(
      container
        .querySelector('input[name="openai_organization"]')
        ?.closest("[hidden]")
    ).toBeNull();
  });

  it("shows one Connection section after switching SDKs", async () => {
    const user = userEvent.setup();
    render();
    const chooseSdk = async (label: string) => {
      const trigger = container.querySelector<HTMLButtonElement>(
        'button[aria-haspopup="listbox"]'
      );
      if (!trigger) throw new Error("no SDK select");
      await act(() => user.click(trigger));
      const option = [
        ...document.querySelectorAll<HTMLElement>('[role="option"]'),
      ].find((candidate) => candidate.textContent === label);
      if (!option) throw new Error(`no SDK option ${label}`);
      await act(() => user.click(option));
    };
    await chooseSdk("TypeSafe");
    await chooseSdk("OpenAI");
    const headings = [...container.querySelectorAll("h1, h2, h3, h4")].map(
      (heading) => heading.textContent
    );
    expect(headings.filter((text) => text === "Connection")).toHaveLength(1);
    expect(headings.filter((text) => text === "Decision models")).toHaveLength(
      1
    );
  });

  it("saves an edit without retyping the stored API key", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      {
        ...(createDefaultFormData("OPENAI") as ProviderFormData),
        name: "proxy",
        openai_api_key: "\ue000REDACTED\ue000d6b6\ue000token",
      } as ProviderFormData,
      onSubmit
    );
    const submit = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Update Provider"
    );
    if (!submit) throw new Error("no submit button");
    await act(() => user.click(submit));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("offers no chat model names on TypeSafe, which serves decisions only", () => {
    render({
      ...(createDefaultFormData("TYPESAFE") as ProviderFormData),
      name: "ts",
    });
    expect(
      container.querySelector('input[placeholder="qwen3-coder, llama-5-70b"]')
    ).toBeNull();
  });
});
