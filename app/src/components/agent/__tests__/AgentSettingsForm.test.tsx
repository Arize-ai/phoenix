import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentProvider } from "@phoenix/contexts/AgentContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";
import { getDefaultInvocationConfig } from "@phoenix/pages/playground/providerAdapters";
import type { ModelConfig } from "@phoenix/store/playground/types";

import { AgentSettingsForm } from "../AgentSettingsForm";

vi.mock("../AgentModelMenu", () => ({
  AgentModelMenu: ({
    limitToCuratedModels,
    value,
  }: {
    limitToCuratedModels?: boolean;
    value?: { modelName: string } | null;
  }) => (
    <div
      data-limit-to-curated-models={String(limitToCuratedModels)}
      data-testid="agent-model-menu"
    >
      {value?.modelName}
    </div>
  ),
}));

let container: HTMLDivElement;
let root: Root;

function createModelConfig({
  provider,
  modelName,
  customProvider,
}: Pick<ModelConfig, "provider" | "modelName" | "customProvider">) {
  return {
    provider,
    modelName,
    customProvider,
    invocationParameters: getDefaultInvocationConfig(provider),
  };
}

function renderAgentSettingsForm(defaultModelConfig: ModelConfig) {
  act(() => {
    root.render(
      <ThemeProvider themeMode="light" disableBodyTheme>
        <AgentProvider defaultModelConfig={defaultModelConfig}>
          <AgentSettingsForm />
        </AgentProvider>
      </ThemeProvider>
    );
  });
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      media: "",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.clearAllMocks();
});

describe("AgentSettingsForm", () => {
  it("allows non-curated models in the settings model menu", () => {
    renderAgentSettingsForm(
      createModelConfig({
        provider: "ANTHROPIC",
        modelName: "claude-opus-4-6",
        customProvider: null,
      })
    );

    expect(
      container
        .querySelector("[data-testid='agent-model-menu']")
        ?.getAttribute("data-limit-to-curated-models")
    ).toBe("false");
  });

  it("does not warn for recommended models", () => {
    renderAgentSettingsForm(
      createModelConfig({
        provider: "ANTHROPIC",
        modelName: "claude-opus-4-6",
        customProvider: null,
      })
    );

    expect(container.textContent).not.toContain(
      "This model has not been verified with PXI"
    );
  });

  it("warns for untested built-in models", () => {
    renderAgentSettingsForm(
      createModelConfig({
        provider: "OPENAI",
        modelName: "gpt-4o",
        customProvider: null,
      })
    );

    expect(container.textContent).toContain(
      "This model has not been verified with PXI and may fail or behave poorly."
    );
  });

  it("warns for custom provider models", () => {
    renderAgentSettingsForm(
      createModelConfig({
        provider: "OPENAI",
        modelName: "custom-agent-model",
        customProvider: {
          id: "custom-provider-id",
          name: "Custom Provider",
        },
      })
    );

    expect(container.textContent).toContain(
      "This model has not been verified with PXI and may fail or behave poorly."
    );
  });
});
