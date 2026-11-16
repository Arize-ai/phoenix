import { vi } from "vitest";

import "vitest-canvas-mock";

// relay-test-utils' createMockEnvironment wraps the environment's methods in
// `jest.fn()`; Vitest's `vi.fn` is API-compatible for that use
(globalThis as typeof globalThis & { jest: { fn: typeof vi.fn } }).jest = {
  fn: vi.fn,
};

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock;

// jsdom has neither IntersectionObserver nor layout, so the mock reports
// every observed element as intersecting synchronously on observe —
// deferred content (e.g. chart panels) simply mounts.
class IntersectionObserverMock {
  root = null;
  rootMargin = "";
  thresholds = [];
  #callback: IntersectionObserverCallback;
  constructor(callback: IntersectionObserverCallback) {
    this.#callback = callback;
  }
  observe(target: Element) {
    this.#callback(
      [{ isIntersecting: true, target } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    );
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
globalThis.IntersectionObserver =
  IntersectionObserverMock as unknown as typeof IntersectionObserver;

// jsdom does not implement the Web Animations API, which react-aria's
// SelectionIndicator uses to settle its slide transition
if (typeof Element.prototype.getAnimations !== "function") {
  Element.prototype.getAnimations = () => [];
}

// jsdom does not expose CSS.escape, which react-aria uses to build selectors
// for virtually focused collection items
if (typeof globalThis.CSS === "undefined") {
  globalThis.CSS = {
    escape: (value: string) =>
      String(value).replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`),
  } as typeof CSS;
}

export const baseWindowConfig = {
  authenticationEnabled: true,
  basename: "/",
  platformVersion: "1.0.0",
  passwordResetEmailEnabled: false,
  allowExternalResources: true,
  agentAssistantDisabled: false,
  agentBashDisabled: false,
  mcpServerEnabled: true,
  mcpCodeModeEnabled: true,
  authErrorMessages: {},
};
Object.defineProperty(window, "Config", {
  value: baseWindowConfig,
  writable: true,
});
