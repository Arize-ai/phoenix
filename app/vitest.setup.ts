import "vitest-canvas-mock";

export const baseWindowConfig = {
  authenticationEnabled: true,
  basename: "/",
  platformVersion: "1.0.0",
  authErrorMessages: {},
};
Object.defineProperty(window, "Config", {
  value: baseWindowConfig,
  writable: true,
});
