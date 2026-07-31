import { act } from "react";
import { DialogTrigger } from "react-aria-components";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { userEvent } from "storybook/test";

import { Button } from "../../button";
import { Popover } from "../Popover";

describe("Popover", () => {
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

  it("contains repeated clicks within the portaled overlay", () => {
    const onContentClick = vi.fn();
    const onPopoverClick = vi.fn();
    const onTriggerAncestorClick = vi.fn();

    act(() => {
      root.render(
        <div onClick={onTriggerAncestorClick}>
          <DialogTrigger defaultOpen>
            <Button>Open popover</Button>
            <Popover onClick={onPopoverClick}>
              <button onClick={onContentClick}>Popover action</button>
            </Popover>
          </DialogTrigger>
        </div>
      );
    });

    const popover = document.querySelector<HTMLElement>(".popover");
    expect(popover).not.toBeNull();

    act(() => {
      for (let clickCount = 0; clickCount < 500; clickCount++) {
        popover?.click();
      }
    });

    expect(onPopoverClick).toHaveBeenCalledTimes(500);
    expect(onTriggerAncestorClick).not.toHaveBeenCalled();

    const popoverAction = Array.from(
      popover?.querySelectorAll("button") ?? []
    ).find((button) => button.textContent === "Popover action");
    expect(popoverAction).toBeDefined();
    act(() => popoverAction?.click());

    expect(onContentClick).toHaveBeenCalledOnce();
    expect(onPopoverClick).toHaveBeenCalledTimes(501);
    expect(onTriggerAncestorClick).not.toHaveBeenCalled();
  });

  it("stacks in the portaled-overlay band by default", () => {
    act(() => {
      root.render(
        <DialogTrigger defaultOpen>
          <Button>Open popover</Button>
          <Popover>
            <span>content</span>
          </Popover>
        </DialogTrigger>
      );
    });

    const popover = document.querySelector<HTMLElement>(".popover");
    expect(popover?.style.zIndex).toBe(
      "var(--global-z-index-app-portaled-overlay)"
    );
  });

  it("stacks in the app-floating band when requested", () => {
    act(() => {
      root.render(
        <DialogTrigger defaultOpen>
          <Button>Open popover</Button>
          <Popover stacking="app-floating">
            <span>content</span>
          </Popover>
        </DialogTrigger>
      );
    });

    const popover = document.querySelector<HTMLElement>(".popover");
    expect(popover?.style.zIndex).toBe("var(--global-z-index-app-floating)");
  });

  // The band tests render non-modal popovers: modality is orthogonal to the
  // stacking they assert, and jsdom's partial focus emulation cannot reliably
  // keep a defaultOpen popover nested inside a MODAL popover mounted (the
  // child self-closes on a focus bounce — reproducible with raw React Aria).
  it("clamps a nested popover to at least its parent's band", () => {
    act(() => {
      root.render(
        <DialogTrigger defaultOpen>
          <Button>Open parent</Button>
          <Popover isNonModal data-testid="parent">
            <DialogTrigger defaultOpen>
              <Button>Open child</Button>
              <Popover isNonModal data-testid="child" stacking="app-floating">
                <span>child content</span>
              </Popover>
            </DialogTrigger>
          </Popover>
        </DialogTrigger>
      );
    });

    const child = document.querySelector<HTMLElement>(
      '.popover[data-testid="child"]'
    );
    expect(child).not.toBeNull();
    // The parent occupies the portaled-overlay band, so the child's requested
    // app-floating band would paint beneath the overlay that spawned it.
    expect(child?.style.zIndex).toBe(
      "var(--global-z-index-app-portaled-overlay)"
    );
  });

  it("consumes the outside press that dismisses a closeOnInteractOutside popover", async () => {
    const outsideButton = document.createElement("button");
    const onOutsidePointerDown = vi.fn();
    const onOutsideClick = vi.fn();
    outsideButton.textContent = "Outside action";
    outsideButton.addEventListener("pointerdown", onOutsidePointerDown);
    outsideButton.addEventListener("click", onOutsideClick);
    document.body.appendChild(outsideButton);
    const user = userEvent.setup();

    act(() => {
      root.render(
        <DialogTrigger defaultOpen>
          <Button>Open popover</Button>
          <Popover isNonModal closeOnInteractOutside>
            <span>content</span>
          </Popover>
        </DialogTrigger>
      );
    });
    expect(document.querySelector(".popover")).not.toBeNull();

    await act(async () => user.click(outsideButton));

    expect(document.querySelector(".popover")).toBeNull();
    expect(onOutsidePointerDown).not.toHaveBeenCalled();
    expect(onOutsideClick).not.toHaveBeenCalled();

    await act(async () => user.click(outsideButton));
    expect(onOutsideClick).toHaveBeenCalledOnce();

    outsideButton.remove();
  });

  it("closes from its own trigger press without reopening", async () => {
    const user = userEvent.setup();

    act(() => {
      root.render(
        <DialogTrigger defaultOpen>
          <Button>Open popover</Button>
          <Popover isNonModal closeOnInteractOutside>
            <span>content</span>
          </Popover>
        </DialogTrigger>
      );
    });
    expect(document.querySelector(".popover")).not.toBeNull();

    const trigger = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Open popover"
    )!;

    // The trigger press is consumed and closes (modal-parity toggle); it must
    // not close-then-immediately-reopen. The next press reopens normally.
    await act(async () => user.click(trigger));
    expect(document.querySelector(".popover")).toBeNull();

    await act(async () => user.click(trigger));
    expect(document.querySelector(".popover")).not.toBeNull();
  });

  it("does not consume presses inside a descendant popover", async () => {
    const onNestedActionClick = vi.fn();
    const user = userEvent.setup();

    act(() => {
      root.render(
        <DialogTrigger defaultOpen>
          <Button>Open parent</Button>
          <Popover isNonModal closeOnInteractOutside data-testid="parent">
            <DialogTrigger defaultOpen>
              <Button>Open child</Button>
              <Popover isNonModal data-testid="child">
                <button onClick={onNestedActionClick}>Nested action</button>
              </Popover>
            </DialogTrigger>
          </Popover>
        </DialogTrigger>
      );
    });

    const nestedAction = Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent === "Nested action"
    )!;

    // The child portals outside the parent's DOM, but the parent recognizes
    // it through the overlay tree and must neither consume the press nor
    // close itself.
    await act(async () => user.click(nestedAction));

    expect(onNestedActionClick).toHaveBeenCalledOnce();
    expect(
      document.querySelector('.popover[data-testid="parent"]')
    ).not.toBeNull();
  });

  it("keeps a nested popover's band when it already meets the parent's", () => {
    act(() => {
      root.render(
        <DialogTrigger defaultOpen>
          <Button>Open parent</Button>
          <Popover isNonModal data-testid="parent" stacking="app-floating">
            <DialogTrigger defaultOpen>
              <Button>Open child</Button>
              <Popover isNonModal data-testid="child">
                <span>child content</span>
              </Popover>
            </DialogTrigger>
          </Popover>
        </DialogTrigger>
      );
    });

    const child = document.querySelector<HTMLElement>(
      '.popover[data-testid="child"]'
    );
    expect(child).not.toBeNull();
    expect(child?.style.zIndex).toBe(
      "var(--global-z-index-app-portaled-overlay)"
    );
  });
});
