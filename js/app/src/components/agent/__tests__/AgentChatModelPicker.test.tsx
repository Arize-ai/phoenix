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
      "GPT-5.4",
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

  it("offers a typed name with the guessed provider", async () => {
    renderPicker();
    const user = await openAndType("claude-opus-9");

    const freeText = findItem('Use "claude-opus-9" with Anthropic');
    expect(freeText.textContent).toContain("Provider guessed from the name");
    await act(() => user.click(freeText));

    expect(onChange).toHaveBeenCalledWith({
      provider: "ANTHROPIC",
      modelName: "claude-opus-9",
    });
    expect(store.getState().recentModels[0]).toEqual({
      provider: "ANTHROPIC",
      modelName: "claude-opus-9",
    });
  });

  it("doesn't offer a typed name that differs from an id only in case", async () => {
    renderPicker();
    await openAndType("Claude-Opus-4-6");

    expect(getItemTexts().some((text) => text.startsWith("Use"))).toBe(false);
  });

  it("scopes search to a provider and sends the typed name there", async () => {
    renderPicker();
    const user = userEvent.setup();
    await act(() => user.click(getTrigger()));

    // Backspace in the empty field opens the provider list
    await act(() => user.keyboard("{Backspace}"));
    expect(getItemTexts()).toEqual([
      expect.stringContaining("All providers"),
      expect.stringContaining("OpenAI"),
      expect.stringContaining("Anthropic"),
      expect.stringContaining("Acme gateway"),
      expect.stringContaining("AWS Bedrock"),
      expect.stringContaining("Azure OpenAI"),
      expect.stringContaining("Google"),
    ]);
    await act(() => user.click(findItem("Azure OpenAI")));

    expect(isOpen()).toBe(true);
    expect(
      document.body
        .querySelector('button[aria-label^="Provider:"]')
        ?.getAttribute("aria-label")
    ).toBe("Provider: Azure OpenAI. Change provider");
    expect(getSearchField()?.placeholder).toBe(
      "Search Azure OpenAI, or type a deployment name"
    );

    await act(() => user.keyboard("my-deployment"));
    const freeText = findItem('Use "my-deployment" with Azure OpenAI');
    expect(freeText.textContent).toContain("As a deployment name");
    await act(() => user.click(freeText));

    expect(onChange).toHaveBeenCalledWith({
      provider: "AZURE_OPENAI",
      modelName: "my-deployment",
    });
  });

  it("lists the whole provider for a scope with no query", async () => {
    renderPicker();
    const user = userEvent.setup();
    await act(() => user.click(getTrigger()));
    await act(() =>
      user.click(
        document.body.querySelector<HTMLElement>(
          'button[aria-label^="Provider:"]'
        )!
      )
    );
    await act(() => user.click(findItem("Anthropic")));

    expect(getItemTexts()).toHaveLength(4);
    for (const text of getItemTexts()) {
      expect(text).toContain("Anthropic");
    }
  });

  it("clears the query, then the scope, then closes on Escape", async () => {
    renderPicker();
    const user = userEvent.setup();
    await act(() => user.click(getTrigger()));
    await act(() => user.keyboard("{Backspace}"));
    await act(() => user.click(findItem("OpenAI")));
    await act(() => user.keyboard("gpt"));
    const getScopeLabel = () =>
      document.body
        .querySelector('button[aria-label^="Provider:"]')
        ?.getAttribute("aria-label");

    await act(() => user.keyboard("{Escape}"));
    expect(getSearchField()?.value).toBe("");
    expect(getScopeLabel()).toBe("Provider: OpenAI. Change provider");

    await act(() => user.keyboard("{Escape}"));
    expect(isOpen()).toBe(true);
    expect(getScopeLabel()).toBe("Provider: all providers. Choose a provider");

    await act(() => user.keyboard("{Escape}"));
    expect(isOpen()).toBe(false);
    // React Aria restores focus to the trigger on the next frame
    await vi.waitFor(() => expect(document.activeElement).toBe(getTrigger()));
    expect(onChange).not.toHaveBeenCalled();
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
