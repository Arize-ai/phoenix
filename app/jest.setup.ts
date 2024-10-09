import "jest-canvas-mock";
jest.mock("@phoenix/config");

Object.defineProperty(window, "Config", {
  value: {
    authenticationEnabled: true,
    basename: "/",
    platformVersion: "1.0.0",
  },
});
