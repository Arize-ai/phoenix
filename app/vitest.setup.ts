import "vitest-canvas-mock";

export const baseWindowConfig = {
  authenticationEnabled: true,
  basename: "/",
  platformVersion: "1.0.0",
  allowExternalResources: true,
};
Object.defineProperty(window, "Config", {
  value: baseWindowConfig,
  writable: true,
});
