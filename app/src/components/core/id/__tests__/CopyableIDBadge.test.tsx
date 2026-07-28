import copy from "copy-to-clipboard";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CopyableIDBadge } from "../CopyableIDBadge";

vi.mock("copy-to-clipboard", () => ({
  default: vi.fn(() => true),
}));

describe("CopyableIDBadge", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function renderBadge(element: React.ReactNode) {
    act(() => root.render(element));
    const button = container.querySelector<HTMLButtonElement>("button");
    const value = container.querySelector<HTMLElement>(
      ".copyable-id-badge__value"
    );
    expect(button).not.toBeNull();
    return { button: button!, value };
  }

  function mockCharacterCapacity(availableCharacterCount: number) {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        const width = this.classList.contains("copyable-id-badge__value")
          ? availableCharacterCount * 8
          : this.hasAttribute("data-copyable-id-character")
            ? 8
            : 0;
        return new DOMRect(0, 0, width, 16);
      }
    );
  }

  it("uses the non-truncating treatment by default", () => {
    const { button, value } = renderBadge(
      <CopyableIDBadge id="abc123" tooltipText="Copy Span ID" />
    );

    expect(button.dataset.overflowMode).toBe("visible");
    expect(button.getAttribute("aria-label")).toBe("Copy Span ID abc123");
    expect(button.title).toBe("abc123");
    expect(value?.textContent).toBe("abc123");
  });

  it("uses tooltips only when the hover state cannot show copy", () => {
    const iconOnly = renderBadge(
      <CopyableIDBadge id="icon-only-id" showValue={false} />
    );
    expect(iconOnly.button.hasAttribute("title")).toBe(false);

    act(() => root.render(<CopyableIDBadge id="abc" />));
    const shortIDButton = container.querySelector<HTMLButtonElement>("button");
    expect(shortIDButton?.hasAttribute("title")).toBe(false);

    act(() => root.render(<CopyableIDBadge id="abcd" />));
    const fourCharacterButton =
      container.querySelector<HTMLButtonElement>("button");
    expect(fourCharacterButton?.title).toBe("abcd");
  });

  it("uses stable-width copy and copied labels", async () => {
    const { button, value } = renderBadge(<CopyableIDBadge id="abc1234" />);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    await act(async () => user.hover(button));
    expect(value?.textContent).toBe("copy234");

    await act(async () => user.click(button));
    expect(copy).toHaveBeenCalledWith("abc1234");
    expect(value?.textContent).toBe("copied4");

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(value?.textContent).toBe("copy234");
  });

  it("supports constrained and icon-only variants", () => {
    const { button, value } = renderBadge(
      <CopyableIDBadge id="abc123" overflowMode="truncate" showValue={false} />
    );

    expect(button.dataset.overflowMode).toBe("truncate");
    expect(button.hasAttribute("title")).toBe(false);
    expect(value).toBeNull();
  });

  it("splits long truncated IDs into prioritized middle segments", () => {
    mockCharacterCapacity(12);
    const { value } = renderBadge(
      <CopyableIDBadge id="abcdefghijklmnop" overflowMode="truncate" />
    );

    expect(value?.classList).toContain(
      "copyable-id-badge__value--measured-truncated"
    );
    expect(
      value?.querySelector(".copyable-id-badge__prefix")?.textContent
    ).toBe("abcdef");
    expect(
      value?.querySelector(".copyable-id-badge__ellipsis")?.textContent
    ).toBe("…");
    expect(
      value?.querySelector(".copyable-id-badge__suffix")?.textContent
    ).toBe("lmnop");
    expect(value?.textContent).toBe("abcdef…lmnop");
  });

  it("uses whole-character compact states without clipping copy feedback", async () => {
    mockCharacterCapacity(8);

    const { button, value } = renderBadge(
      <CopyableIDBadge id="abcdefghijklmnop" overflowMode="truncate" />
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    expect(value?.classList).toContain(
      "copyable-id-badge__value--measured-truncated"
    );
    expect(value?.style.width).toBe("8ch");
    expect(value?.textContent).toBe("abc…op");
    expect(
      value?.querySelector<HTMLElement>(".copyable-id-badge__ellipsis")?.style
        .opacity
    ).toBe("");

    await act(async () => user.hover(button));
    expect(value?.style.width).toBe("8ch");
    expect(value?.textContent).toBe("copyop");
    expect(value?.querySelector(".copyable-id-badge__ellipsis")).toBeNull();

    await act(async () => user.click(button));
    expect(value?.style.width).toBe("8ch");
    expect(value?.textContent).toBe("copiedop");
    expect(value?.querySelector(".copyable-id-badge__ellipsis")).toBeNull();
  });
});
