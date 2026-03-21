import { describe, expect, it } from "vitest";

import { CLI_VERSION } from "../src/__generated__/version";
import { createProgram, main } from "../src/cli";

describe("Phoenix CLI", () => {
  it("should have a main function", () => {
    expect(main).toBeDefined();
    expect(typeof main).toBe("function");
  });

  it("should register the embedded CLI version", () => {
    const program = createProgram();

    expect(program.version()).toBe(CLI_VERSION);
    expect(program.helpInformation()).toContain("-V, --version");
  });
});
