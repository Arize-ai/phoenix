import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ViewlessKeyboardEvent } from "@phoenix/__tests__/ViewlessKeyboardEvent";
import type { ModelMenuValue } from "@phoenix/components/generative/ModelMenu";
import { AgentContext } from "@phoenix/contexts/AgentContext";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";
import {
  type AgentProps,
  type AgentStore,
  createAgentStore,
} from "@phoenix/store/agentStore";
import type { AwsBedrockModelPrefix } from "@phoenix/store/preferencesStore";

import { AgentModelPicker } from "../AgentModelPicker";

const MODEL_MENU_DATA = {
  customProviders: [
    {
      id: "custom-acme",
      name: "Acme gateway",
      sdk: "OPENAI",
      modelNames: ["acme/gpt-5.4-internal"],
    },
  ],
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
        credentialsSet: false,
      },
      {
        key: "AZURE_OPENAI",
        name: "Azure OpenAI",
        dependenciesInstalled: true,
        credentialsSet: false,
      },
      {
        key: "GOOGLE",
        name: "Google",
        dependenciesInstalled: true,
        credentialsSet: false,
      },
    ],
    playgroundModels: [
      { providerKey: "OPENAI", name: "gpt-4o-mini" },
      { providerKey: "OPENAI", name: "gpt-5.4" },
      { providerKey: "OPENAI", name: "gpt-5.4-mini" },
      { providerKey: "OPENAI", name: "gpt-6-sol" },
      { providerKey: "OPENAI", name: "gpt-6.1-terra" },
      { providerKey: "OPENAI", name: "gpt-6.2-sol" },
      { providerKey: "ANTHROPIC", name: "claude-fable-5-1" },
      { providerKey: "ANTHROPIC", name: "claude-fable-5-2" },
      { providerKey: "ANTHROPIC", name: "claude-opus-5" },
      { providerKey: "ANTHROPIC", name: "claude-opus-5-5" },
      { providerKey: "ANTHROPIC", name: "claude-opus-4-5" },
      { providerKey: "ANTHROPIC", name: "claude-sonnet-5-5" },
      { providerKey: "AWS", name: "anthropic.claude-opus-4-6-v1:0" },
      { providerKey: "GOOGLE", name: "gemini-4-carbon" },
      { providerKey: "GOOGLE", name: "gemini-4-hydrogen" },
      { providerKey: "GOOGLE", name: "gemini-4-neon" },
      { providerKey: "GOOGLE", name: "gemini-3.7-flash" },
      { providerKey: "GOOGLE", name: "gemini-3.1-pro-preview" },
      { providerKey: "GOOGLE", name: "gemini-2.5-flash" },
    ],
  },
};

vi.mock("@phoenix/components/generative/useModelMenuData", async () => ({
  ...(await vi.importActual<object>(
    "@phoenix/components/generative/useModelMenuData"
  )),
  useModelMenuData: () => MODEL_MENU_DATA,
}));

const BEDROCK_OPUS: ModelMenuValue = {
  provider: "AWS",
  modelName: "anthropic.claude-opus-4-6-v1:0",
};

const CURRENT_MODEL: ModelMenuValue = {
  provider: "ANTHROPIC",
  modelName: "claude-opus-5-5",
};

describe("AgentModelPicker", () => {
  installTestMatchMedia();

  let container: HTMLDivElement;
  let root: Root;
  let store: AgentStore;
  let onChange: ReturnType<typeof vi.fn<(model: ModelMenuValue) => void>>;

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("KeyboardEvent", ViewlessKeyboardEvent);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onChange = vi.fn<(model: ModelMenuValue) => void>();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  function renderPicker({
    value = CURRENT_MODEL,
    storeProps = {},
    awsBedrockModelPrefix = "",
  }: {
    value?: ModelMenuValue;
    storeProps?: Partial<AgentProps>;
    awsBedrockModelPrefix?: AwsBedrockModelPrefix;
  } = {}) {
    store = createAgentStore(storeProps);
    act(() => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <PreferencesProvider awsBedrockModelPrefix={awsBedrockModelPrefix}>
            <AgentContext.Provider value={store}>
              <AgentModelPicker value={value} onChange={onChange} />
            </AgentContext.Provider>
          </PreferencesProvider>
        </ThemeProvider>
      );
    });
  }

  const getTrigger = () => {
    const trigger = container.querySelector<HTMLButtonElement>(
      'button[aria-label^="Model:"], button[aria-label="Select model"]'
    );
    if (!trigger) throw new Error("trigger not rendered");
    return trigger;
  };
  const getSearchField = () =>
    document.body.querySelector<HTMLInputElement>('input[type="search"]');
  const getItems = () => [
    ...document.body.querySelectorAll<HTMLElement>('[role="menuitemradio"]'),
  ];
  const getItemTexts = () => getItems().map((item) => item.textContent ?? "");
  const findItem = (text: string) => {
    const item = getItems().find((candidate) =>
      candidate.textContent?.includes(text)
    );
    if (!item) {
      throw new Error(`no row with "${text}" in ${getItemTexts().join(" | ")}`);
    }
    return item;
  };
  const isOpen = () => document.body.querySelector('[role="menu"]') != null;
  const getMenus = () => [
    ...document.body.querySelectorAll<HTMLElement>('[role="menu"]'),
  ];
  const getRootMenuRows = () => [
    ...getMenus()[0].querySelectorAll<HTMLElement>(
      '[role="menuitemradio"], [role="menuitem"]'
    ),
  ];
  const getCustomModelRow = () =>
    getRootMenuRows().find((row) => row.getAttribute("aria-haspopup")) ?? null;
  /** The provider submenu, once it's open. */
  const getSubmenu = () => (getMenus().length > 1 ? getMenus()[1] : null);
  const getSubmenuItems = () => [
    ...(getSubmenu()?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []),
  ];
  const getSubmenuNames = () =>
    getSubmenuItems().map(
      (item) => item.querySelector(".agent-model-row__name")?.textContent
    );
  const findSubmenuItem = (name: string) => {
    const item = getSubmenuItems().find(
      (candidate) =>
        candidate.querySelector(".agent-model-row__name")?.textContent === name
    );
    if (!item) {
      throw new Error(`no provider "${name}" in ${getSubmenuNames().join()}`);
    }
    return item;
  };

  /** Types a name and opens the custom-model submenu with the pointer. */
  async function openCustomModelSubmenu(query: string) {
    const user = await openAndType(query);
    const row = getCustomModelRow();
    if (!row) throw new Error("no custom-model row");
    await act(() => user.click(row));
    await vi.waitFor(() => expect(getSubmenu()).not.toBeNull());
    return user;
  }

  async function openAndType(query: string) {
    const user = userEvent.setup();
    getTrigger().focus();
    await act(() => user.keyboard(query));
    return user;
  }

  it("opens with the typed character when typing on the trigger", async () => {
    renderPicker();
    expect(isOpen()).toBe(false);

    await openAndType("g");

    expect(isOpen()).toBe(true);
    expect(getSearchField()?.value).toBe("g");
    expect(document.activeElement).toBe(getSearchField());
  });

  it("shows a current model whose custom provider was deleted", async () => {
    renderPicker({
      value: {
        provider: "OPENAI",
        modelName: "acme/retired",
        customProvider: { id: "custom-gone", name: "Deleted provider" },
      },
    });
    expect(getTrigger().getAttribute("aria-label")).toBe(
      "Model: acme/retired, Deleted provider"
    );

    await act(() => userEvent.setup().click(getTrigger()));

    const current = getItems()[0];
    expect(current.textContent).toContain("acme/retired");
    expect(current.textContent).toContain("Deleted provider");
    expect(current.textContent).toContain("Unavailable");
  });

  it("emits the pick with the Bedrock prefix and records it without", async () => {
    renderPicker({ awsBedrockModelPrefix: "us" });
    const user = await openAndType("anthropic.claude-opus-4-6");

    const bedrockRow = findItem("anthropic.claude-opus-4-6-v1:0");
    await act(() => user.click(bedrockRow));

    expect(onChange).toHaveBeenCalledWith({
      provider: "AWS",
      modelName: "us.anthropic.claude-opus-4-6-v1:0",
    });
    expect(store.getState().recentModels).toEqual([BEDROCK_OPUS]);
    expect(isOpen()).toBe(false);
  });

  it("applies the current Bedrock prefix to a prefixed current model", async () => {
    renderPicker({
      awsBedrockModelPrefix: "eu",
      value: {
        provider: "AWS",
        modelName: "us.anthropic.claude-opus-4-6-v1:0",
      },
    });
    const user = userEvent.setup();
    await act(() => user.click(getTrigger()));

    const currentRow = getItems()[0];
    expect(currentRow.getAttribute("aria-checked")).toBe("true");
    expect(currentRow.textContent).not.toContain("us.anthropic");
    await act(() => user.click(currentRow));

    expect(onChange).toHaveBeenCalledWith({
      provider: "AWS",
      modelName: "eu.anthropic.claude-opus-4-6-v1:0",
    });
  });

  it("keeps the region of a typed Bedrock name", async () => {
    renderPicker({ awsBedrockModelPrefix: "us" });
    const user = await openCustomModelSubmenu(
      "global.anthropic.claude-opus-5-5"
    );

    await act(() => user.click(findSubmenuItem("AWS Bedrock")));

    const expected = {
      provider: "AWS",
      modelName: "global.anthropic.claude-opus-5-5",
    };
    expect(onChange).toHaveBeenCalledWith(expected);
    expect(store.getState().recentModels).toEqual([expected]);
  });

  it("sends the typed name to a custom provider", async () => {
    renderPicker();
    const user = await openCustomModelSubmenu("acme/new-model");

    await act(() => user.click(findSubmenuItem("Acme gateway")));

    expect(onChange).toHaveBeenCalledWith({
      provider: "OPENAI",
      modelName: "acme/new-model",
      customProvider: { id: "custom-acme", name: "Acme gateway" },
    });
  });

  it("opens the submenu from the keyboard and picks with Enter", async () => {
    renderPicker();
    const user = await openAndType("claude-opus");
    const rows = getRootMenuRows();
    expect(rows.length).toBeGreaterThan(2);

    // Virtual focus moves from the field down to the last row
    const isCustomRowFocused = () =>
      getCustomModelRow()?.hasAttribute("data-focused") === true;
    for (
      let press = 0;
      press <= rows.length && !isCustomRowFocused();
      press++
    ) {
      await act(() => user.keyboard("{ArrowDown}"));
    }
    expect(isCustomRowFocused()).toBe(true);
    expect(document.activeElement).toBe(getSearchField());

    await act(() => user.keyboard("{ArrowRight}"));
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(findSubmenuItem("Anthropic"))
    );

    // ArrowLeft closes the submenu, back to the row; React Aria returns
    // focus to the field on the next frame
    await act(() => user.keyboard("{ArrowLeft}"));
    await vi.waitFor(() => expect(getSubmenu()).toBeNull());
    expect(isOpen()).toBe(true);
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(getSearchField())
    );

    // ArrowRight again, then Escape closes only the submenu
    await act(() => user.keyboard("{ArrowRight}"));
    await vi.waitFor(() => expect(getSubmenu()).not.toBeNull());
    await act(() => user.keyboard("{Escape}"));
    await vi.waitFor(() => expect(getSubmenu()).toBeNull());
    expect(isOpen()).toBe(true);
    expect(getSearchField()?.value).toBe("claude-opus");
    expect(onChange).not.toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(getSearchField())
    );

    // Enter on the row opens it too; ArrowDown, Enter picks the second one
    await act(() => user.keyboard("{Enter}"));
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(findSubmenuItem("Anthropic"))
    );
    await act(() => user.keyboard("{ArrowDown}{Enter}"));

    expect(onChange).toHaveBeenCalledWith({
      provider: "OPENAI",
      modelName: "claude-opus",
    });
  });

  it("is disabled while a session is streaming", () => {
    renderPicker();
    expect(getTrigger().disabled).toBe(false);

    act(() => {
      store.setState({ chatStatusBySessionId: { "session-1": "streaming" } });
    });
    expect(getTrigger().disabled).toBe(true);
  });
});
