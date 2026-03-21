import { describe, expect, it } from "vitest";

import { createProgram, main } from "../src/cli";
import { CLI_VERSION } from "../src/version";

describe("Phoenix CLI", () => {
  it("should have a main function", () => {
    expect(main).toBeDefined();
    expect(typeof main).toBe("function");
  });

  it("should register the CLI version", () => {
    const program = createProgram();

    expect(program.version()).toBe(CLI_VERSION);
    expect(program.helpInformation()).toContain("-V, --version");
    expect(program.helpInformation()).toContain(
      "prompt [options] <prompt-identifier>"
    );
  });
});
