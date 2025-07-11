import { describe, it, expect } from "vitest";
import { main } from "../src/cli";

describe("Phoenix CLI", () => {
  it("should have a main function", () => {
    expect(main).toBeDefined();
    expect(typeof main).toBe("function");
  });

  // TODO: Add more tests once CLI functionality is implemented
});
