import { isAttributeMessage } from "../types";

describe("isAttributeMessage", () => {
  it("should return false if the message does not conform to a reasonable shape", () => {
    expect(isAttributeMessage("")).toBe(false);
    expect(isAttributeMessage(null)).toBe(false);
  });
});
