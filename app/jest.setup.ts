vi.mock("@phoenix/config");

Object.defineProperty(window, "Config", {
  value: {
    authenticationEnabled: true,
    basename: "/",
    platformVersion: "1.0.0",
  },
});
