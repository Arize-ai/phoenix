import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { AgentContext } from "@phoenix/contexts/AgentContext";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";
import {
  type AgentProps,
  type AgentStore,
  createAgentStore,
} from "@phoenix/store/agentStore";
import type { AwsBedrockModelPrefix } from "@phoenix/store/preferencesStore";

import { SettingsAgentsGeneralTab } from "../SettingsAgentsGeneralTab";

installTestMatchMedia();

const MODEL_MENU_DATA = {
  customProviders: [],
  data: {
    modelProviders: [
      {
        key: "OPENAI",
        name: "OpenAI",
        dependenciesInstalled: true,
        credentialsSet: true,
      },
      {
        key: "ANTHROPIC",
        name: "Anthropic",
        dependenciesInstalled: true,
        credentialsSet: true,
      },
      {
        key: "AWS",
        name: "AWS Bedrock",
        dependenciesInstalled: true,
        credentialsSet: true,
      },
    ],
    playgroundModels: [
      { providerKey: "OPENAI", name: "gpt-4o-mini" },
      { providerKey: "OPENAI", name: "gpt-5.4-mini" },
      { providerKey: "ANTHROPIC", name: "claude-opus-5-5" },
      { providerKey: "ANTHROPIC", name: "claude-sonnet-5-5" },
      { providerKey: "AWS", name: "anthropic.claude-opus-4-6-v1:0" },
    ],
  },
};

vi.mock("@phoenix/components/generative/useModelMenuData", async () => ({
  ...(await vi.importActual<object>(
    "@phoenix/components/generative/useModelMenuData"
  )),
  useModelMenuData: () => MODEL_MENU_DATA,
}));

vi.mock("@phoenix/contexts/ViewerContext", async () => ({
  ...(await vi.importActual<object>("@phoenix/contexts/ViewerContext")),
  useIsAdminOrAuthDisabled: () => true,
}));

/**
 * React Aria's Autocomplete re-dispatches keys with
 * `new KeyboardEvent(type, nativeEvent)`, which jsdom rejects for user-event's
 * `view`; this copies the init without it.
 */
class ViewlessKeyboardEvent extends KeyboardEvent {
  constructor(type: string, init?: KeyboardEventInit) {
    super(
      type,
      init && {
        key: init.key,
        code: init.code,
        ctrlKey: init.ctrlKey,
        shiftKey: init.shiftKey,
        altKey: init.altKey,
        metaKey: init.metaKey,
        bubbles: init.bubbles,
        cancelable: init.cancelable,
        composed: init.composed,
      }
    );
  }
}

const UNVERIFIED_WARNING = "This model has not been verified";

describe("SettingsAgentsGeneralTab model setting", () => {
  let container: HTMLDivElement;
  let root: Root;
  let store: AgentStore;

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("KeyboardEvent", ViewlessKeyboardEvent);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  function renderTab({
    storeProps = {},
    awsBedrockModelPrefix = "",
  }: {
    storeProps?: Partial<AgentProps>;
    awsBedrockModelPrefix?: AwsBedrockModelPrefix;
  } = {}) {
    store = createAgentStore(storeProps);
    act(() => {
      root.render(
        <MemoryRouter>
          <ThemeProvider themeMode="light" disableBodyTheme>
            <PreferencesProvider awsBedrockModelPrefix={awsBedrockModelPrefix}>
              <AgentContext.Provider value={store}>
                <SettingsAgentsGeneralTab />
              </AgentContext.Provider>
            </PreferencesProvider>
          </ThemeProvider>
        </MemoryRouter>
      );
    });
  }

  const getTrigger = () => {
    const trigger = container.querySelector<HTMLButtonElement>(
      'button[aria-label^="Model:"], button[aria-label="Select model"]'
    );
    if (!trigger) throw new Error("model picker trigger not rendered");
    return trigger;
  };
  const findItem = (name: string) => {
    const item = [
      ...document.body.querySelectorAll<HTMLElement>('[role="menuitemradio"]'),
    ].find(
      (candidate) =>
        candidate.querySelector(".agent-model-row__name")?.textContent === name
    );
    if (!item) throw new Error(`no row named "${name}"`);
    return item;
  };

  async function pickModel({ query, name }: { query: string; name: string }) {
    const user = userEvent.setup();
    getTrigger().focus();
    await act(() => user.keyboard(query));
    await act(() => user.click(findItem(name)));
  }

  it("sets the default model and records it as recent", async () => {
    renderTab({
      storeProps: {
        defaultModelConfig: {
          ...createAgentStore().getState().defaultModelConfig,
          provider: "OPENAI",
          modelName: "gpt-4o-mini",
          customProvider: null,
        },
      },
    });
    expect(container.textContent).toContain(UNVERIFIED_WARNING);

    await pickModel({ query: "sonnet", name: "Claude Sonnet 5.5" });

    const { defaultModelConfig, recentModels } = store.getState();
    expect(defaultModelConfig).toMatchObject({
      provider: "ANTHROPIC",
      modelName: "claude-sonnet-5-5",
      customProvider: null,
    });
    expect(recentModels[0]).toMatchObject({
      provider: "ANTHROPIC",
      modelName: "claude-sonnet-5-5",
    });
    expect(getTrigger().getAttribute("aria-label")).toBe(
      "Model: Claude Sonnet 5.5 (claude-sonnet-5-5), Anthropic"
    );
    expect(container.textContent).not.toContain(UNVERIFIED_WARNING);
  });

  it("applies the Bedrock prefix to the default model", async () => {
    renderTab({ awsBedrockModelPrefix: "us" });

    await pickModel({
      query: "anthropic.claude",
      name: "anthropic.claude-opus-4-6-v1:0",
    });

    expect(store.getState().defaultModelConfig).toMatchObject({
      provider: "AWS",
      modelName: "us.anthropic.claude-opus-4-6-v1:0",
    });
  });
});
