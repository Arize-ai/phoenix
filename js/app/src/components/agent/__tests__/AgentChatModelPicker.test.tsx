import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import { AgentChatModelPicker } from "../AgentChatModelPicker";

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
      { providerKey: "ANTHROPIC", name: "claude-opus-5" },
      { providerKey: "ANTHROPIC", name: "claude-opus-4-6" },
      { providerKey: "ANTHROPIC", name: "claude-opus-4-5" },
      { providerKey: "ANTHROPIC", name: "claude-sonnet-4-6" },
      { providerKey: "AWS", name: "anthropic.claude-opus-4-6-v1:0" },
      { providerKey: "GOOGLE", name: "gemini-3.7-flash" },
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

/**
 * React Aria's Autocomplete forwards keys to the menu with
 * `new KeyboardEvent(type, nativeEvent)`. jsdom rejects the `view` of a
 * user-event event there ("member view is not of type Window"), so this copies
 * the init without it.
 */
class ViewlessKeyboardEvent extends KeyboardEvent {
  constructor(type: string, init?: KeyboardEventInit) {
    super(
      type,
      init && {
        key: init.key,
        code: init.code,
        location: init.location,
        repeat: init.repeat,
        isComposing: init.isComposing,
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

const CURRENT_MODEL: ModelMenuValue = {
  provider: "ANTHROPIC",
  modelName: "claude-opus-4-6",
};

describe("AgentChatModelPicker", () => {
  let container: HTMLDivElement;
  let root: Root;
  let store: AgentStore;
  let onChange: ReturnType<typeof vi.fn<(model: ModelMenuValue) => void>>;

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("KeyboardEvent", ViewlessKeyboardEvent);
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    );
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
              <AgentChatModelPicker value={value} onChange={onChange} />
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
  const getItemNames = () =>
    getItems().map(
      (item) => item.querySelector(".agent-model-row__name")?.textContent
    );
  const getSectionTitles = () =>
    [...document.body.querySelectorAll('[role="menu"] header')].map(
      (header) => header.textContent
    );
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

  it("labels the trigger with the display name, id and provider", () => {
    renderPicker();
    expect(getTrigger().getAttribute("aria-label")).toBe(
      "Model: Claude Opus 4.6 (claude-opus-4-6), Anthropic"
    );
    expect(
      getTrigger().querySelector(".agent-model-picker-trigger__name")
        ?.textContent
    ).toBe("Claude Opus 4.6");
    expect(
      getTrigger().querySelector(".agent-model-picker-trigger__dot")
    ).toBeNull();
  });

  it("shows Current, Recent and Recommended before typing", async () => {
    renderPicker({
      value: { provider: "OPENAI", modelName: "gpt-9-preview" },
      storeProps: {
        recentModels: [
          { provider: "OPENAI", modelName: "gpt-9-preview" },
          { provider: "ANTHROPIC", modelName: "claude-opus-5" },
          { provider: "OPENAI", modelName: "my-typed-name" },
          { provider: "GOOGLE", modelName: "gemini-2.5-flash" },
          { provider: "OPENAI", modelName: "gpt-4o-mini" },
        ],
      },
    });
    // A non-curated current model: raw id in the trigger, with the dot
    expect(getTrigger().getAttribute("aria-label")).toBe(
      "Model: gpt-9-preview, OpenAI"
    );
    expect(
      getTrigger().querySelector(".agent-model-picker-trigger__dot")
    ).not.toBeNull();

    await act(() => userEvent.setup().click(getTrigger()));

    expect(getSectionTitles()).toEqual(["Current", "Recent", "Recommended"]);
    const texts = getItemTexts();
    expect(texts[0]).toContain("gpt-9-preview");
    // Recent: the top 3 without the current model
    expect(texts.slice(1, 4)).toEqual([
      expect.stringContaining("Claude Opus 5"),
      expect.stringContaining("my-typed-name"),
      expect.stringContaining("gemini-2.5-flash"),
    ]);
    // Recommended: the curated models the catalog has, in curated order
    expect(getItemNames().slice(4)).toEqual([
      "Claude Opus 5",
      "Claude Opus 4.6",
      "Claude Sonnet 4.6",
      "GPT-5.4 mini",
      "Gemini 3.7 Flash",
    ]);
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

  it("checks the current model", async () => {
    renderPicker();
    await act(() => userEvent.setup().click(getTrigger()));

    const checked = getItems().filter(
      (item) => item.getAttribute("aria-checked") === "true"
    );
    expect(checked.length).toBeGreaterThan(0);
    for (const item of checked) {
      expect(item.textContent).toContain("claude-opus-4-6");
    }
    expect(getItems()[0].getAttribute("aria-checked")).toBe("true");
  });

  it("ranks token matches flat, with provider and Recommended badges", async () => {
    renderPicker();
    await openAndType("opus 5");

    expect(getSectionTitles()).toEqual([]);
    const texts = getItemTexts();
    expect(texts[0]).toContain("Claude Opus 5");
    expect(texts[0]).toContain("claude-opus-5 · Anthropic");
    expect(texts[0]).toContain("Recommended");
    expect(texts[1]).toContain("claude-opus-4-5");
    expect(texts[1]).not.toContain("Recommended");
    expect(
      getItems()[0].querySelectorAll("mark").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("still lists models without a key, marked Add key", async () => {
    renderPicker();
    await openAndType("gemini");

    const gemini = findItem("Gemini 3.7 Flash");
    expect(gemini.textContent).toContain("Add key");
    await act(() => userEvent.setup().click(gemini));
    expect(onChange).toHaveBeenCalledWith({
      provider: "GOOGLE",
      modelName: "gemini-3.7-flash",
    });
  });

  it("emits the pick and records it after the Bedrock prefix", async () => {
    renderPicker({ awsBedrockModelPrefix: "us" });
    const user = await openAndType("anthropic.claude-opus-4-6");

    const bedrockRow = findItem("anthropic.claude-opus-4-6-v1:0");
    expect(bedrockRow.textContent).toContain("May work");
    await act(() => user.click(bedrockRow));

    const expected = {
      provider: "AWS",
      modelName: "us.anthropic.claude-opus-4-6-v1:0",
    };
    expect(onChange).toHaveBeenCalledWith(expected);
    expect(store.getState().recentModels).toEqual([expected]);
    expect(isOpen()).toBe(false);
  });

  it("has no provider scope chip", async () => {
    renderPicker();
    const user = userEvent.setup();
    await act(() => user.click(getTrigger()));

    expect(
      document.body.querySelector('button[aria-label^="Provider:"]')
    ).toBeNull();
    // Backspace in the empty field no longer swaps in a provider list
    await act(() => user.keyboard("{Backspace}"));
    expect(getSectionTitles()).toEqual(["Current", "Recommended"]);
    expect(getSearchField()?.placeholder).toBe(
      "Search, or type any model name"
    );
  });

  it("ends a search with the custom-model row", async () => {
    renderPicker();
    await openAndType("claude-opus");

    const rows = getRootMenuRows();
    expect(rows.length).toBeGreaterThan(1);
    const lastRow = rows[rows.length - 1];
    expect(lastRow).toBe(getCustomModelRow());
    expect(lastRow.textContent).toContain(
      'Use "claude-opus" as a custom model'
    );
    expect(lastRow.getAttribute("aria-haspopup")).toBe("menu");
  });

  it("offers the custom-model row for a listed id too", async () => {
    renderPicker();
    await openAndType("gpt-5.4");

    expect(getCustomModelRow()?.textContent).toContain(
      'Use "gpt-5.4" as a custom model'
    );
  });

  it("offers no custom-model row for a multi-word search", async () => {
    renderPicker();
    await openAndType("opus 5");

    expect(getCustomModelRow()).toBeNull();
  });

  it("lists providers with the guessed one first", async () => {
    renderPicker();
    await openCustomModelSubmenu("gemini-4-pro");

    expect(getSubmenuNames()).toEqual([
      "Google",
      "OpenAI",
      "Anthropic",
      "Acme gateway",
      "AWS Bedrock",
      "Azure OpenAI",
    ]);
    const google = findSubmenuItem("Google");
    expect(google.textContent).toContain("Guessed from the name");
    expect(google.textContent).toContain("Add key");
    expect(findSubmenuItem("AWS Bedrock").textContent).toContain("May work");
    expect(findSubmenuItem("Azure OpenAI").textContent).toContain(
      "As a deployment name"
    );
    expect(findSubmenuItem("Acme gateway").textContent).toContain(
      "Custom provider"
    );
  });

  it("sends the typed name to the picked provider", async () => {
    renderPicker();
    const user = await openCustomModelSubmenu("claude-opus-9");

    await act(() => user.click(findSubmenuItem("Anthropic")));

    const expected = { provider: "ANTHROPIC", modelName: "claude-opus-9" };
    expect(onChange).toHaveBeenCalledWith(expected);
    expect(store.getState().recentModels[0]).toEqual(expected);
    expect(isOpen()).toBe(false);
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

  it("applies the Bedrock prefix to a typed AWS name", async () => {
    renderPicker({ awsBedrockModelPrefix: "us" });
    const user = await openCustomModelSubmenu("anthropic.claude-opus-9-v1:0");

    expect(getSubmenuNames()[0]).toBe("AWS Bedrock");
    await act(() => user.click(findSubmenuItem("AWS Bedrock")));

    const expected = {
      provider: "AWS",
      modelName: "us.anthropic.claude-opus-9-v1:0",
    };
    expect(onChange).toHaveBeenCalledWith(expected);
    expect(store.getState().recentModels).toEqual([expected]);
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
