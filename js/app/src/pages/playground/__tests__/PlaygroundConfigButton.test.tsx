import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { PlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";
import type { PlaygroundStore } from "@phoenix/store";
import {
  _resetInstanceId,
  createPlaygroundStore,
} from "@phoenix/store/playground/playgroundStore";

import { PlaygroundConfigButton } from "../PlaygroundConfigButton";

installTestMatchMedia();

describe("PlaygroundConfigButton", () => {
  let container: HTMLDivElement;
  let root: Root;
  let store: PlaygroundStore;

  beforeEach(() => {
    localStorage.clear();
    _resetInstanceId();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function renderButton(defaultModelProvider: "OPENAI" | "AWS") {
    store = createPlaygroundStore({
      modelConfigByProvider: {},
      defaultModelProvider,
    });
    act(() => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <PreferencesProvider>
            <PlaygroundContext.Provider value={store}>
              <PlaygroundConfigButton />
            </PlaygroundContext.Provider>
          </PreferencesProvider>
        </ThemeProvider>
      );
    });
  }

  const getButton = () => {
    const button = container.querySelector("button");
    if (!button) throw new Error("settings button not rendered");
    return button;
  };

  async function openSettings() {
    await act(() => userEvent.setup().click(getButton()));
    const dialog = document.body.querySelector('[role="dialog"]');
    if (!dialog) throw new Error("settings dialog did not open");
    return dialog;
  }

  const getPrefixField = () =>
    document.body.querySelector('[aria-label="AWS Bedrock Model Prefix"]');

  it("labels the settings button with visible text and an accessible name", () => {
    renderButton("OPENAI");
    const button = getButton();
    expect(button.textContent).toContain("Settings");
    expect(button.getAttribute("aria-label")).toBe("Playground Settings");
  });

  it("hides the AWS Bedrock prefix when no instance uses AWS", async () => {
    renderButton("OPENAI");
    const dialog = await openSettings();
    expect(dialog.textContent).toContain("Repetitions");
    expect(dialog.textContent).toContain("Streaming");
    expect(getPrefixField()).toBeNull();
  });

  it("shows the AWS Bedrock prefix when an instance uses AWS", async () => {
    renderButton("AWS");
    await openSettings();
    expect(getPrefixField()).not.toBeNull();
  });

  it("shows the AWS Bedrock prefix when any one of several instances uses AWS", async () => {
    renderButton("OPENAI");
    act(() => {
      store.getState().addInstance();
    });
    const [, secondInstance] = store.getState().instances;
    act(() => {
      store.getState().updateProvider({
        instanceId: secondInstance.id,
        provider: "AWS",
        modelConfigByProvider: {},
      });
    });
    await openSettings();
    expect(getPrefixField()).not.toBeNull();
  });
});
