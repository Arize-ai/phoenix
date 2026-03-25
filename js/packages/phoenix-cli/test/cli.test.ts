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
    expect(program.helpInformation()).toContain("project");
    expect(program.helpInformation()).not.toContain("projects [options]");
  });

  it("should register project list as the primary project listing command", () => {
    const program = createProgram();
    const projectCommand = program.commands.find(
      (command) => command.name() === "project"
    );

    expect(projectCommand).toBeDefined();
    expect(projectCommand?.commands.map((command) => command.name())).toContain(
      "list"
    );
    expect(
      program.commands.find((command) => command.name() === "projects")
    ).toBeUndefined();
  });
});
