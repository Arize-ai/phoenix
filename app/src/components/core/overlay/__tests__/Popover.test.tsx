import { act } from "react";
import { DialogTrigger } from "react-aria-components";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";

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

  it("clamps a nested popover to at least its parent's band", () => {
    act(() => {
      root.render(
        <DialogTrigger defaultOpen>
          <Button>Open parent</Button>
          <Popover data-testid="parent">
            <DialogTrigger defaultOpen>
              <Button>Open child</Button>
              <Popover data-testid="child" stacking="app-floating">
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

  it("keeps a nested popover's band when it already meets the parent's", () => {
    act(() => {
      root.render(
        <DialogTrigger defaultOpen>
          <Button>Open parent</Button>
          <Popover data-testid="parent" stacking="app-floating">
            <DialogTrigger defaultOpen>
              <Button>Open child</Button>
              <Popover data-testid="child">
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
