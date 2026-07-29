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
});
