import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ViewlessKeyboardEvent } from "@phoenix/__tests__/ViewlessKeyboardEvent";
import {
  ModelMenu,
  type ModelMenuValue,
} from "@phoenix/components/generative/ModelMenu";
import type {
  CustomProviderInfo,
  ModelProviderInfo,
} from "@phoenix/components/generative/useModelMenuData";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";
import type { AwsBedrockModelPrefix } from "@phoenix/store/preferencesStore";

const provider = (
  info: Pick<ModelProviderInfo, "key" | "name"> & Partial<ModelProviderInfo>
): ModelProviderInfo => ({
  dependenciesInstalled: true,
  credentialsSet: true,
  needsCredentials: false,
  modelTypes: ["LLM"],
  ...info,
});

/** What `useModelMenuData` returns for one model type, as ModelMenu reads it. */
type MenuData = {
  visibleProviders: ModelProviderInfo[];
  customProviders: CustomProviderInfo[];
  catalogModels: { name: string; providerKey: ModelProviderInfo["key"] }[];
};

const LLM_DATA: MenuData = {
  visibleProviders: [
    provider({ key: "OPENAI", name: "OpenAI" }),
    provider({ key: "ANTHROPIC", name: "Anthropic" }),
    provider({
      key: "AWS",
      name: "AWS Bedrock",
      credentialsSet: false,
      needsCredentials: true,
    }),
    provider({
      key: "GOOGLE",
      name: "Google",
      credentialsSet: false,
      needsCredentials: true,
    }),
  ],
  customProviders: [
    {
      id: "custom-acme",
      name: "Acme gateway",
      sdk: "OPENAI",
      modelNames: ["acme/gpt-5.4-internal"],
    },
  ],
  catalogModels: [
    { providerKey: "OPENAI", name: "gpt-5.4" },
    { providerKey: "OPENAI", name: "gpt-5.4-mini" },
    { providerKey: "ANTHROPIC", name: "claude-opus-5-5" },
    { providerKey: "AWS", name: "anthropic.claude-opus-4-6-v1:0" },
    { providerKey: "GOOGLE", name: "gemini-3.7-flash" },
  ],
};

/** The Decision tab lists only the providers that serve decision models. */
const DECISION_DATA: MenuData = {
  visibleProviders: [
    provider({
      key: "OPENAI",
      name: "OpenAI",
      modelTypes: ["LLM", "DECISION"],
    }),
    provider({
      key: "TYPESAFE",
      name: "TypeSafe",
      modelTypes: ["DECISION"],
    }),
  ],
  customProviders: [
    {
      id: "custom-judge",
      name: "Judge endpoint",
      sdk: "TYPESAFE",
      modelNames: ["judge-v1"],
    },
  ],
  catalogModels: [
    { providerKey: "OPENAI", name: "gpt-5.4-decision" },
    { providerKey: "TYPESAFE", name: "typesafe-small" },
  ],
};

vi.mock("@phoenix/components/generative/useModelMenuData", async () => ({
  ...(await vi.importActual<object>(
    "@phoenix/components/generative/useModelMenuData"
  )),
  useModelMenuData: ({ modelType = "LLM" }: { modelType?: ModelType } = {}) => {
    const data = modelType === "DECISION" ? DECISION_DATA : LLM_DATA;
    const modelsByProvider = new Map<string, string[]>();
    for (const model of data.catalogModels) {
      modelsByProvider.set(model.providerKey, [
        ...(modelsByProvider.get(model.providerKey) ?? []),
        model.name,
      ]);
    }
    return { ...data, modelsByProvider };
  },
}));

describe("ModelMenu", () => {
  installTestMatchMedia();

  let container: HTMLDivElement;
  let root: Root;
  let onChange: ReturnType<typeof vi.fn<(model: ModelMenuValue) => void>>;

  beforeEach(() => {
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

  function renderMenu({
    supportsDecisionModels = true,
    defaultModelType,
    awsBedrockModelPrefix = "",
  }: {
    supportsDecisionModels?: boolean;
    defaultModelType?: ModelType;
    awsBedrockModelPrefix?: AwsBedrockModelPrefix;
  } = {}) {
    act(() => {
      root.render(
        <MemoryRouter>
          <ThemeProvider themeMode="light" disableBodyTheme>
            <PreferencesProvider awsBedrockModelPrefix={awsBedrockModelPrefix}>
              <ModelMenu
                value={null}
                onChange={onChange}
                supportsDecisionModels={supportsDecisionModels}
                defaultModelType={defaultModelType}
              />
            </PreferencesProvider>
          </ThemeProvider>
        </MemoryRouter>
      );
    });
  }

  const getMenus = () => [
    ...document.body.querySelectorAll<HTMLElement>('[role="menu"]'),
  ];
  const getRootMenuItems = () => [
    ...(getMenus()[0]?.querySelectorAll<HTMLElement>('[role="menuitem"]') ??
      []),
  ];
  /** An item's text without its provider icon's title. */
  const getItemText = (item: HTMLElement) => {
    const copy = item.cloneNode(true) as HTMLElement;
    copy.querySelectorAll("svg").forEach((icon) => icon.remove());
    return copy.textContent ?? "";
  };
  const getRootMenuTexts = () => getRootMenuItems().map(getItemText);
  const getSectionTitles = () =>
    [...(getMenus()[0]?.querySelectorAll("header") ?? [])].map(
      (header) => header.textContent
    );
  const getCustomModelRow = () =>
    getRootMenuItems().find((item) => item.getAttribute("aria-haspopup")) ??
    null;
  const getSubmenu = () => (getMenus().length > 1 ? getMenus()[1] : null);
  const getSubmenuItems = () => [
    ...(getSubmenu()?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []),
  ];
  const getSubmenuNames = () =>
    getSubmenuItems().map(
      (item) => item.querySelector(".model-row__name")?.textContent
    );
  const findSubmenuItem = (name: string) => {
    const item = getSubmenuItems().find(
      (candidate) =>
        candidate.querySelector(".model-row__name")?.textContent === name
    );
    if (!item) {
      throw new Error(`no provider "${name}" in ${getSubmenuNames().join()}`);
    }
    return item;
  };

  async function openAndSearch(
    query: string,
    { tab }: { tab?: "LLM" | "Decision" } = {}
  ) {
    const user = userEvent.setup();
    const trigger = container.querySelector<HTMLButtonElement>("button");
    if (!trigger) throw new Error("trigger not rendered");
    await act(() => user.click(trigger));
    if (tab) {
      const tabElement = [
        ...document.body.querySelectorAll<HTMLElement>('[role="tab"]'),
      ].find((candidate) => candidate.textContent === tab);
      if (!tabElement) throw new Error(`no ${tab} tab`);
      await act(() => user.click(tabElement));
    }
    const searchField = document.body.querySelector<HTMLInputElement>(
      'input[aria-label="Search models"]'
    );
    if (!searchField) throw new Error("no search field");
    await act(() => user.click(searchField));
    await act(() => user.keyboard(query));
    return user;
  }

  async function openCustomModelSubmenu(
    query: string,
    options: { tab?: "LLM" | "Decision" } = {}
  ) {
    const user = await openAndSearch(query, options);
    const row = getCustomModelRow();
    if (!row) throw new Error("no custom-model row");
    await act(() => user.click(row));
    await vi.waitFor(() => expect(getSubmenu()).not.toBeNull());
    return user;
  }

  describe("in the LLM tab", () => {
    it("lists matches under their provider, then the custom-model row", async () => {
      renderMenu();
      await openAndSearch("gpt-5.4");

      expect(getSectionTitles()).toEqual(["Acme gateway", "OpenAI"]);
      const texts = getRootMenuTexts();
      expect(texts.slice(0, 3)).toEqual([
        "acme/gpt-5.4-internal",
        "gpt-5.4",
        "gpt-5.4-mini",
      ]);
      expect(texts.at(-1)).toContain('Use "gpt-5.4" as a custom model');
    });

    it("lists a provider's models when the query names it", async () => {
      renderMenu();
      await openAndSearch("anthropic");

      expect(getSectionTitles()).toContain("Anthropic");
      expect(getRootMenuTexts()).toContain("claude-opus-5-5");
    });

    it("offers an unknown name as a custom model on the listed providers", async () => {
      renderMenu();
      await openCustomModelSubmenu("claude-opus-9");

      expect(getRootMenuTexts()).toHaveLength(1);
      // Guessed first, then ready providers, then may-work and no-key ones
      expect(getSubmenuNames()).toEqual([
        "Anthropic",
        "OpenAI",
        "Acme gateway",
        "AWS Bedrock",
        "Google",
      ]);
      expect(findSubmenuItem("Anthropic").textContent).toContain(
        "Guessed from the name"
      );
      expect(findSubmenuItem("Google").textContent).toContain("Add key");
      expect(findSubmenuItem("AWS Bedrock").textContent).not.toContain(
        "Add key"
      );
    });

    it("selects the typed name on the picked provider", async () => {
      renderMenu();
      const user = await openCustomModelSubmenu("claude-opus-9");

      await act(() => user.click(findSubmenuItem("Anthropic")));

      expect(onChange).toHaveBeenCalledWith({
        provider: "ANTHROPIC",
        modelName: "claude-opus-9",
        modelType: "LLM",
      });
    });

    it("selects the typed name on a custom provider", async () => {
      renderMenu();
      const user = await openCustomModelSubmenu("my-finetune");

      await act(() => user.click(findSubmenuItem("Acme gateway")));

      expect(onChange).toHaveBeenCalledWith({
        provider: "OPENAI",
        modelName: "my-finetune",
        modelType: "LLM",
        customProvider: { id: "custom-acme", name: "Acme gateway" },
      });
    });

    it("applies the Bedrock prefix to a name sent to AWS", async () => {
      renderMenu({ awsBedrockModelPrefix: "us" });
      const user = await openCustomModelSubmenu("anthropic.claude-x");

      expect(getSubmenuNames()[0]).toBe("AWS Bedrock");
      await act(() => user.click(findSubmenuItem("AWS Bedrock")));

      expect(onChange).toHaveBeenCalledWith({
        provider: "AWS",
        modelName: "us.anthropic.claude-x",
        modelType: "LLM",
      });
    });

    it("offers no custom model for a query with spaces", async () => {
      renderMenu();
      await openAndSearch("no such model");

      expect(getCustomModelRow()).toBeNull();
    });
  });

  describe("in the Decision tab", () => {
    it("offers only the providers that serve decision models", async () => {
      renderMenu();
      await openCustomModelSubmenu("my-decision-v3", { tab: "Decision" });

      expect(getSubmenuNames()).toEqual([
        "OpenAI",
        "TypeSafe",
        "Judge endpoint",
      ]);
    });

    it("searches the decision catalog", async () => {
      renderMenu({ defaultModelType: "DECISION" });
      await openAndSearch("typesafe");

      expect(getSectionTitles()).toEqual(["TypeSafe"]);
      expect(getRootMenuTexts()[0]).toBe("typesafe-small");
    });

    it("selects the typed name as a decision model", async () => {
      renderMenu();
      const user = await openCustomModelSubmenu("my-decision-v3", {
        tab: "Decision",
      });

      await act(() => user.click(findSubmenuItem("TypeSafe")));

      expect(onChange).toHaveBeenCalledWith({
        provider: "TYPESAFE",
        modelName: "my-decision-v3",
        modelType: "DECISION",
      });
    });
  });
});
