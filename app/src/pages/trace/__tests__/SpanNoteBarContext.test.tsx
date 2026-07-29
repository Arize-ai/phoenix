import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MODAL_OVERLAY_CLASS_NAME } from "@phoenix/components/core/overlay/constants";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";

import {
  SpanNoteBarProvider,
  useSpanNoteBarOpenRequest,
} from "../SpanNoteBarContext";

function OpenRequestState() {
  const openRequest = useSpanNoteBarOpenRequest();
  return <output data-testid="open-request">{openRequest ?? "none"}</output>;
}

describe("SpanNoteBarProvider", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.querySelectorAll(".react-aria-Popover").forEach((element) => {
      element.remove();
    });
    document
      .querySelectorAll(`.${MODAL_OVERLAY_CLASS_NAME}`)
      .forEach((element) => element.remove());
  });

  function renderProvider({ isHotkeyEnabled }: { isHotkeyEnabled: boolean }) {
    act(() => {
      root.render(
        <PreferencesProvider isTakingSpanNotes={false}>
          <SpanNoteBarProvider isHotkeyEnabled={isHotkeyEnabled}>
            <input data-testid="editable" />
            <OpenRequestState />
          </SpanNoteBarProvider>
        </PreferencesProvider>
      );
    });
  }

  function getOpenRequest() {
    return container.querySelector('[data-testid="open-request"]')?.textContent;
  }

  function pressN({
    isComposing = false,
    repeat = false,
    target = document,
  }: {
    isComposing?: boolean;
    repeat?: boolean;
    target?: Document | Element;
  } = {}) {
    const keyDownEvent = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      code: "KeyN",
      isComposing,
      key: "n",
      repeat,
    });
    act(() => {
      target.dispatchEvent(keyDownEvent);
    });
    act(() => {
      target.dispatchEvent(
        new KeyboardEvent("keyup", {
          bubbles: true,
          cancelable: true,
          code: "KeyN",
          key: "n",
        })
      );
    });
    return keyDownEvent;
  }

  it("routes N only from the active details interaction scope", () => {
    renderProvider({ isHotkeyEnabled: false });
    const inactiveEvent = pressN();
    expect(getOpenRequest()).toBe("none");
    expect(inactiveEvent.defaultPrevented).toBe(false);

    renderProvider({ isHotkeyEnabled: true });
    const activeEvent = pressN();
    expect(getOpenRequest()).toBe("1");
    expect(activeEvent.defaultPrevented).toBe(true);
  });

  it("leaves editable controls, composition, and repeats alone", () => {
    renderProvider({ isHotkeyEnabled: true });
    const editable = container.querySelector('[data-testid="editable"]');
    if (!editable) throw new Error("Expected editable control");

    expect(pressN({ target: editable }).defaultPrevented).toBe(false);
    expect(pressN({ isComposing: true }).defaultPrevented).toBe(false);
    expect(pressN({ repeat: true }).defaultPrevented).toBe(false);
    expect(getOpenRequest()).toBe("none");
  });

  it("suspends the shortcut while a higher overlay is open", () => {
    renderProvider({ isHotkeyEnabled: true });
    const popover = document.createElement("div");
    popover.className = "react-aria-Popover";
    document.body.appendChild(popover);

    expect(pressN().defaultPrevented).toBe(false);
    expect(getOpenRequest()).toBe("none");

    popover.remove();
    const modal = document.createElement("div");
    modal.className = MODAL_OVERLAY_CLASS_NAME;
    document.body.appendChild(modal);

    expect(pressN().defaultPrevented).toBe(false);
    expect(getOpenRequest()).toBe("none");
  });
});
