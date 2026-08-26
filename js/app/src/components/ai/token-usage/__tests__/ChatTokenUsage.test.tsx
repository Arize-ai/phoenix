import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { ChatTokenUsage, ChatTokenUsageDetails } from "../ChatTokenUsage";

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

  it("stays collapsed on hover", async () => {
    const user = userEvent.setup();
    const trigger = container.querySelector<HTMLButtonElement>(
      '[aria-label="16,567 total tokens"]'
    );

    expect(trigger).not.toBeNull();

    await act(async () => user.hover(trigger!));

    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    expect(container.textContent).not.toContain("Prompt");
  });

  it("toggles the prompt and completion breakdown on click", async () => {
    const user = userEvent.setup();
    const trigger = container.querySelector<HTMLButtonElement>(
      '[aria-label="16,567 total tokens"]'
    );

    expect(trigger).not.toBeNull();
    expect(container.textContent).not.toContain("Prompt");

    await act(async () => user.click(trigger!));

    expect(trigger?.getAttribute("aria-expanded")).toBe("true");
    expect(container.textContent).toContain("16K Prompt");
    expect(container.textContent).toContain("630 Completion");

    await act(async () => user.click(trigger!));

    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    expect(container.textContent).not.toContain("Prompt");
  });

  it("gives a tiny non-zero token segment a minimum width of one percent", () => {
    act(() => {
      root.render(
        <ThemeProvider themeMode="dark" disableBodyTheme>
          <ChatTokenUsageDetails
            total={16_567}
            prompt={16_566}
            completion={1}
          />
        </ThemeProvider>
      );
    });

    const chart = container.querySelector<HTMLElement>(
      '[aria-label="Token usage breakdown"] [aria-hidden="true"] > div'
    );
    const chartSegments = Array.from(chart?.children ?? []);
    const promptSegment = chartSegments[0] as HTMLElement;
    const completionSegment = chartSegments[1] as HTMLElement;

    expect(chartSegments).toHaveLength(2);
    expect(promptSegment.style.minWidth).toBe("1%");
    expect(completionSegment.style.width).toBe(`${(1 / 16_567) * 100}%`);
    expect(completionSegment.style.minWidth).toBe("1%");
  });

  it("does not render a slice or gap for a zero-value segment", () => {
    act(() => {
      root.render(
        <ThemeProvider themeMode="dark" disableBodyTheme>
          <ChatTokenUsageDetails
            total={16_567}
            prompt={16_567}
            completion={0}
          />
        </ThemeProvider>
      );
    });

    const chart = container.querySelector<HTMLElement>(
      '[aria-label="Token usage breakdown"] [aria-hidden="true"] > div'
    );
    const chartSegments = Array.from(chart?.children ?? []);
    const promptSegment = chartSegments[0] as HTMLElement;

    expect(chartSegments).toHaveLength(1);
    expect(promptSegment.style.width).toBe("100%");
  });

  it("toggles the breakdown from the keyboard", async () => {
    const user = userEvent.setup();
    const trigger = container.querySelector<HTMLButtonElement>(
      '[aria-label="16,567 total tokens"]'
    );

    expect(trigger).not.toBeNull();

    act(() => trigger!.focus());
    await act(async () => user.keyboard("{Enter}"));

    expect(trigger?.getAttribute("aria-expanded")).toBe("true");
    expect(container.textContent).toContain("16K Prompt");
    expect(container.textContent).toContain("630 Completion");

    await act(async () => user.keyboard(" "));

    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    expect(container.textContent).not.toContain("Prompt");
  });

  it("shows prompt cache details in a tooltip from the legend", async () => {
    const user = userEvent.setup();

    act(() => {
      root.render(
        <ThemeProvider themeMode="dark" disableBodyTheme>
          <ChatTokenUsageDetails
            total={33_200}
            prompt={32_000}
            completion={1_200}
            promptDetails={{ cacheRead: 21_000, cacheWrite: 3_000 }}
          />
        </ThemeProvider>
      );
    });

    const promptTrigger = container.querySelector<HTMLButtonElement>(
      '[aria-label="32,000 prompt tokens. Show cache details"]'
    );

    expect(promptTrigger).not.toBeNull();
    expect(container.textContent).toContain("32K Prompt");
    expect(document.querySelector('[role="tooltip"]')).toBeNull();

    document.dispatchEvent(
      new PointerEvent("pointermove", { bubbles: true, pointerType: "mouse" })
    );
    await act(async () => user.hover(promptTrigger!));

    await vi.waitFor(() => {
      const tooltip = document.querySelector('[role="tooltip"]');
      expect(tooltip?.textContent).toContain("Prompt details");
      expect(tooltip?.textContent).toContain("8.0K Uncached");
      expect(tooltip?.textContent).toContain("21K Cache read");
      expect(tooltip?.textContent).toContain("3.0K Cache write");
    });
    expect(container.textContent).toContain("32K Prompt");
    expect(container.textContent).toContain("1.2K Completion");

    const chart = container.querySelector<HTMLElement>(
      '[aria-label="Token usage breakdown"] [aria-hidden="true"] > div'
    );
    expect(chart?.children).toHaveLength(2);

    await act(async () => user.unhover(promptTrigger!));

    await vi.waitFor(() => {
      expect(document.querySelector('[role="tooltip"]')).toBeNull();
    });
  });

  it("shows prompt cache details when the legend receives keyboard focus", async () => {
    const user = userEvent.setup();

    act(() => {
      root.render(
        <ThemeProvider themeMode="dark" disableBodyTheme>
          <ChatTokenUsageDetails
            total={33_200}
            prompt={32_000}
            completion={1_200}
            promptDetails={{ cacheRead: 32_000, cacheWrite: 0 }}
          />
        </ThemeProvider>
      );
    });

    const promptTrigger = container.querySelector<HTMLButtonElement>(
      '[aria-label="32,000 prompt tokens. Show cache details"]'
    );

    await act(async () => user.tab());

    expect(document.activeElement).toBe(promptTrigger);

    await vi.waitFor(() => {
      const tooltip = document.querySelector('[role="tooltip"]');
      expect(tooltip?.textContent).toContain("32K Cache read");
      expect(tooltip?.textContent).not.toContain("Uncached");
    });

    await act(async () => promptTrigger!.blur());
  });
});
