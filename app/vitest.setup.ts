import "vitest-canvas-mock";

Object.defineProperty(window, "Config", {
  value: {
    authenticationEnabled: true,
    basename: "/",
    platformVersion: "1.0.0",
  },
});
