import { formatModelTypes } from "../modelTypeUtils";

describe("formatModelTypes", () => {
  it("lists chat and decision in a fixed order", () => {
    expect(formatModelTypes(["DECISION", "CHAT"])).toBe("Chat, Decision");
  });

  it("lists a single model type", () => {
    expect(formatModelTypes(["DECISION"])).toBe("Decision");
  });

  it("shows an em dash when no known model type is served", () => {
    expect(formatModelTypes([])).toBe("—");
    expect(formatModelTypes(["%future added value"])).toBe("—");
  });
});
