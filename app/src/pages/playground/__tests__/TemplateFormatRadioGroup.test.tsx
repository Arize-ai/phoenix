import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import { PlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { TemplateFormatRadioGroup } from "@phoenix/pages/playground/TemplateFormatRadioGroup";
import { createPlaygroundStore } from "@phoenix/store";

describe("TemplateFormatRadioGroup", () => {
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

  it("keeps a template format selected when the active option is clicked", async () => {
    const playgroundStore = createPlaygroundStore({
      modelConfigByProvider: {},
      templateFormat: TemplateFormats.FString,
    });

    act(() => {
      root.render(
        <PlaygroundContext.Provider value={playgroundStore}>
          <TemplateFormatRadioGroup />
        </PlaygroundContext.Provider>
      );
    });

    const fStringButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="F-String"]'
    );
    const mustacheButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Mustache"]'
    );
    expect(fStringButton).not.toBeNull();
    expect(mustacheButton).not.toBeNull();
    expect(fStringButton?.dataset.selected).toBe("true");

    const user = userEvent.setup();
    await act(async () => user.click(fStringButton!));

    expect(playgroundStore.getState().templateFormat).toBe(
      TemplateFormats.FString
    );
    expect(fStringButton?.dataset.selected).toBe("true");

    await act(async () => user.click(mustacheButton!));

    expect(playgroundStore.getState().templateFormat).toBe(
      TemplateFormats.Mustache
    );
    expect(mustacheButton?.dataset.selected).toBe("true");
    expect(fStringButton?.dataset.selected).toBeUndefined();
  });
});
