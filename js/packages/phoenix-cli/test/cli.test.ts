import { main } from "../src/cli";

import { describe, expect, it } from "vitest";

describe("Phoenix CLI", () => {
  it("should have a main function", () => {
    expect(main).toBeDefined();
    expect(typeof main).toBe("function");
  });

  // TODO: Add more tests once CLI functionality is implemented
});
