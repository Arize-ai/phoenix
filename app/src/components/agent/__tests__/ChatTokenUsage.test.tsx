import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { ChatTokenUsage } from "../ChatTokenUsage";

describe("ChatTokenUsage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root.render(
        <ThemeProvider themeMode="dark" disableBodyTheme>
          <ChatTokenUsage total={16_567} prompt={15_937} completion={630} />
        </ThemeProvider>
      );
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("reveals the prompt and completion breakdown on hover", async () => {
    const user = userEvent.setup();
    const trigger = container.querySelector<HTMLElement>(
      '[aria-label="16,567 total tokens"]'
    );

    expect(trigger).not.toBeNull();
    expect(container.textContent).not.toContain("Prompt");

    await act(async () => user.hover(trigger!));

    expect(container.textContent).toContain("16K Prompt");
    expect(container.textContent).toContain("630 Completion");

    const details = container.querySelector<HTMLElement>(
      '[aria-label="Token usage breakdown"]'
    );
    expect(details).not.toBeNull();

    await act(async () => user.hover(details!));

    expect(container.textContent).toContain("16K Prompt");

    await act(async () => user.unhover(details!));

    expect(container.textContent).not.toContain("Prompt");
  });

  it("reveals the breakdown for keyboard focus", () => {
    const trigger = container.querySelector<HTMLElement>(
      '[aria-label="16,567 total tokens"]'
    );

    expect(trigger).not.toBeNull();

    act(() => trigger!.focus());

    expect(trigger?.getAttribute("aria-expanded")).toBe("true");
    expect(container.textContent).toContain("16K Prompt");
    expect(container.textContent).toContain("630 Completion");
  });
});
