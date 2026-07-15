import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { ToolChoiceSelector } from "../ToolChoiceSelector";

describe("ToolChoiceSelector", () => {
  let container: HTMLDivElement;
  let root: Root;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
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
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
  });

  it("labels a forced tool choice with the action and always token", async () => {
    await act(async () => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <ToolChoiceSelector
            provider="OPENAI"
            choice={{
              type: "SPECIFIC_FUNCTION",
              functionName: "get_weather",
            }}
            onChange={() => undefined}
            toolNames={["get_weather"]}
          />
        </ThemeProvider>
      );
    });

    expect(container.querySelector("button")?.textContent).toContain(
      "Use get_weather"
    );
    expect(container.querySelector(".token__text")?.textContent).toBe("always");
  });
});
