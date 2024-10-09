import { isAttributeMessage } from "../types";

describe("isAttributeMessage", () => {
  it("should return true if the message conforms to an object with a role", () => {
    expect(isAttributeMessage({ role: "system " })).toBe(true);
  });

  it("should return false if the message does not conform to a reasonable shape", () => {
    expect(isAttributeMessage({})).toBe(false);
    expect(isAttributeMessage("")).toBe(false);
    expect(isAttributeMessage(null)).toBe(false);
  });
});
