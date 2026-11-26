import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HotkeysEnabledProvider } from "@phoenix/contexts/HotkeysEnabledContext";

import { useScopedHotkeys } from "../useScopedHotkeys";

function pressKey(code: string): KeyboardEvent {
  const keyboardEvent = new KeyboardEvent("keydown", {
    code,
    key: code.replace("Key", "").toLowerCase(),
    bubbles: true,
    cancelable: true,
  });
  document.body.dispatchEvent(keyboardEvent);
  return keyboardEvent;
}

let container: HTMLDivElement;
let root: Root;

function ScopedHotkey({ onHotkey }: { onHotkey: () => void }) {
  useScopedHotkeys("j", onHotkey, { preventDefault: true });
  return null;
}

function renderScopedHotkey({
  isScopeEnabled,
  isParentScopeEnabled = true,
}: {
  isScopeEnabled: boolean;
  isParentScopeEnabled?: boolean;
}) {
  const onHotkey = vi.fn();
  act(() => {
    root.render(
      <HotkeysEnabledProvider isEnabled={isParentScopeEnabled}>
        <HotkeysEnabledProvider isEnabled={isScopeEnabled}>
          <ScopedHotkey onHotkey={onHotkey} />
        </HotkeysEnabledProvider>
      </HotkeysEnabledProvider>
    );
  });
  return onHotkey;
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe("useScopedHotkeys", () => {
  it("runs the shortcut and takes the key while its scope is enabled", () => {
    const onHotkey = renderScopedHotkey({ isScopeEnabled: true });
    const keyboardEvent = pressKey("KeyJ");
    expect(onHotkey).toHaveBeenCalledTimes(1);
    expect(keyboardEvent.defaultPrevented).toBe(true);
  });

  it("leaves the key press to the rest of the page while its scope is disabled", () => {
    const onHotkey = renderScopedHotkey({ isScopeEnabled: false });
    const onDocumentKeyDown = vi.fn();
    window.addEventListener("keydown", onDocumentKeyDown);
    const keyboardEvent = pressKey("KeyJ");
    window.removeEventListener("keydown", onDocumentKeyDown);
    expect(onHotkey).not.toHaveBeenCalled();
    expect(keyboardEvent.defaultPrevented).toBe(false);
    expect(onDocumentKeyDown).toHaveBeenCalledTimes(1);
  });

  it("stays disabled inside a disabled scope", () => {
    const onHotkey = renderScopedHotkey({
      isScopeEnabled: true,
      isParentScopeEnabled: false,
    });
    pressKey("KeyJ");
    expect(onHotkey).not.toHaveBeenCalled();
  });
});
