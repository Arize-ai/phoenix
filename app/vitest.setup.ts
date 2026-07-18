import "vitest-canvas-mock";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock;

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
