import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type * as ReactRelayModule from "react-relay";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts";

installTestMatchMedia();

const relayMocks = vi.hoisted(() => ({
  useLazyLoadQuery: vi.fn(),
}));

vi.mock("react-relay", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRelayModule>()),
  useLazyLoadQuery: relayMocks.useLazyLoadQuery,
}));

import { PromptComboBox } from "../PromptComboBox";

describe("PromptComboBox", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    relayMocks.useLazyLoadQuery.mockReturnValue({
      prompts: {
        edges: [
          {
            prompt: {
              __typename: "Prompt",
              id: "prompt-1",
              name: "existing-prompt",
            },
          },
        ],
      },
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it("keeps the prompt selected when Escape reverts an edited name", async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <PromptComboBox
            label="Prompt"
            promptId="prompt-1"
            inputValue="existing"
            onInputChange={vi.fn()}
            allowsCustomValue
            onChange={onChange}
          />
        </ThemeProvider>
      );
    });
    const input = container.querySelector("input")!;

    await act(async () => {
      input.focus();
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
    });
    expect(onChange).toHaveBeenCalledWith("prompt-1");
    expect(onChange).not.toHaveBeenCalledWith(null);
  });
});
