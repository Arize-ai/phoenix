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

export const baseWindowConfig = {
  authenticationEnabled: true,
  basename: "/",
  platformVersion: "1.0.0",
  agentAssistantDisabled: false,
  authErrorMessages: {},
};
Object.defineProperty(window, "Config", {
  value: baseWindowConfig,
  writable: true,
});
