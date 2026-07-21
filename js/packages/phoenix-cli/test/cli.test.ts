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
    expect(program.helpInformation()).toContain("prompt");
    expect(program.helpInformation()).toContain("dataset");
    expect(program.helpInformation()).toContain("experiment");
    expect(program.helpInformation()).toContain("project");
    expect(program.helpInformation()).toContain("prompt");
    expect(program.helpInformation()).toContain("session");
    expect(program.helpInformation()).toContain("span");
    expect(program.helpInformation()).toContain("trace");
    expect(program.helpInformation()).not.toContain("datasets [options]");
    expect(program.helpInformation()).not.toContain("experiments [options]");
    expect(program.helpInformation()).not.toContain("projects [options]");
    expect(program.helpInformation()).not.toContain("prompts [options]");
    expect(program.helpInformation()).not.toContain("sessions [options]");
    expect(program.helpInformation()).not.toContain("spans [options]");
    expect(program.helpInformation()).not.toContain("traces [options]");
  });

  it("should register project list as the primary project listing command", () => {
    const program = createProgram();
    const projectCommand = program.commands.find(
      (command) => command.name() === "project"
    );

    expect(projectCommand).toBeDefined();
    expect(projectCommand?.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(["list", "get"])
    );
    expect(
      program.commands.find((command) => command.name() === "projects")
    ).toBeUndefined();
  });

  it("should register trace list and trace get as the primary trace commands", () => {
    const program = createProgram();
    const traceCommand = program.commands.find(
      (command) => command.name() === "trace"
    );

    expect(traceCommand).toBeDefined();
    expect(traceCommand?.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(["list", "get", "annotate", "add-note"])
    );
    expect(
      traceCommand?.commands.map((command) => command.name())
    ).not.toContain("delete-annotations");
    expect(
      program.commands.find((command) => command.name() === "traces")
    ).toBeUndefined();
  });

  it("should register span list as the primary span command", () => {
    const program = createProgram();
    const spanCommand = program.commands.find(
      (command) => command.name() === "span"
    );

    expect(spanCommand).toBeDefined();
    expect(spanCommand?.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(["list", "annotate", "add-note"])
    );
    expect(
      spanCommand?.commands.map((command) => command.name())
    ).not.toContain("delete-annotations");
    expect(
      program.commands.find((command) => command.name() === "spans")
    ).toBeUndefined();
  });

  it("should register dataset list and dataset get as the primary dataset commands", () => {
    const program = createProgram();
    const datasetCommand = program.commands.find(
      (command) => command.name() === "dataset"
    );

    expect(datasetCommand).toBeDefined();
    expect(datasetCommand?.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(["list", "get"])
    );
    expect(
      program.commands.find((command) => command.name() === "datasets")
    ).toBeUndefined();
  });

  it("should register session commands", () => {
    const program = createProgram();
    const sessionCommand = program.commands.find(
      (command) => command.name() === "session"
    );

    expect(sessionCommand).toBeDefined();
    expect(sessionCommand?.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(["list", "get", "annotate", "add-note"])
    );
    expect(
      sessionCommand?.commands.map((command) => command.name())
    ).not.toContain("delete-annotations");
    const listCommand = sessionCommand?.commands.find(
      (command) => command.name() === "list"
    );
    expect(listCommand?.helpInformation()).toContain("--include-annotations");
    expect(listCommand?.helpInformation()).toContain("--include-notes");
    expect(
      program.commands.find((command) => command.name() === "sessions")
    ).toBeUndefined();
  });

  it("should register experiment list and experiment get as the primary experiment commands", () => {
    const program = createProgram();
    const experimentCommand = program.commands.find(
      (command) => command.name() === "experiment"
    );

    expect(experimentCommand).toBeDefined();
    expect(
      experimentCommand?.commands.map((command) => command.name())
    ).toEqual(expect.arrayContaining(["list", "get"]));
    expect(
      program.commands.find((command) => command.name() === "experiments")
    ).toBeUndefined();
  });

  it("should register prompt list and prompt get as the primary prompt commands", () => {
    const program = createProgram();
    const promptCommand = program.commands.find(
      (command) => command.name() === "prompt"
    );

    expect(promptCommand).toBeDefined();
    expect(promptCommand?.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(["list", "get"])
    );
    expect(
      program.commands.find((command) => command.name() === "prompts")
    ).toBeUndefined();
  });

  it("should register delete subcommand for dataset", () => {
    const program = createProgram();
    const datasetCommand = program.commands.find(
      (command) => command.name() === "dataset"
    );

    expect(datasetCommand).toBeDefined();
    expect(datasetCommand?.commands.map((command) => command.name())).toContain(
      "delete"
    );
  });

  it("should register delete subcommand for project", () => {
    const program = createProgram();
    const projectCommand = program.commands.find(
      (command) => command.name() === "project"
    );

    expect(projectCommand).toBeDefined();
    expect(projectCommand?.commands.map((command) => command.name())).toContain(
      "delete"
    );
  });

  it("should register delete subcommand for trace", () => {
    const program = createProgram();
    const traceCommand = program.commands.find(
      (command) => command.name() === "trace"
    );

    expect(traceCommand).toBeDefined();
    expect(traceCommand?.commands.map((command) => command.name())).toContain(
      "delete"
    );
  });

  it("should register delete subcommand for experiment", () => {
    const program = createProgram();
    const experimentCommand = program.commands.find(
      (command) => command.name() === "experiment"
    );

    expect(experimentCommand).toBeDefined();
    expect(
      experimentCommand?.commands.map((command) => command.name())
    ).toContain("delete");
  });

  it("should register delete subcommand for session", () => {
    const program = createProgram();
    const sessionCommand = program.commands.find(
      (command) => command.name() === "session"
    );

    expect(sessionCommand).toBeDefined();
    expect(sessionCommand?.commands.map((command) => command.name())).toContain(
      "delete"
    );
  });

  it("should register delete subcommand for annotation-config", () => {
    const program = createProgram();
    const annotationConfigCommand = program.commands.find(
      (command) => command.name() === "annotation-config"
    );

    expect(annotationConfigCommand).toBeDefined();
    expect(
      annotationConfigCommand?.commands.map((command) => command.name())
    ).toContain("delete");
  });

  it("should register delete subcommand for prompt", () => {
    const program = createProgram();
    const promptCommand = program.commands.find(
      (command) => command.name() === "prompt"
    );

    expect(promptCommand).toBeDefined();
    expect(promptCommand?.commands.map((command) => command.name())).toContain(
      "delete"
    );
  });

  it("should register delete subcommand for span", () => {
    const program = createProgram();
    const spanCommand = program.commands.find(
      (command) => command.name() === "span"
    );

    expect(spanCommand).toBeDefined();
    expect(spanCommand?.commands.map((command) => command.name())).toContain(
      "delete"
    );
  });

  it("should register auth command with login, logout, and status subcommands", () => {
    const program = createProgram();
    const authCommand = program.commands.find(
      (command) => command.name() === "auth"
    );

    expect(authCommand).toBeDefined();
    const subcommandNames = authCommand?.commands.map((c) => c.name());
    expect(subcommandNames).toContain("login");
    expect(subcommandNames).toContain("logout");
    expect(subcommandNames).toContain("status");
    expect(subcommandNames).not.toContain("profile");
    expect(subcommandNames).not.toContain("switch");
  });

  it("should register top-level profile command with list, create, delete, use, edit, show subcommands", () => {
    const program = createProgram();
    const profileCommand = program.commands.find(
      (command) => command.name() === "profile"
    );

    expect(profileCommand).toBeDefined();
    const subcommandNames = profileCommand?.commands.map((c) => c.name());
    expect(subcommandNames).toEqual(
      expect.arrayContaining([
        "list",
        "create",
        "delete",
        "use",
        "edit",
        "show",
      ])
    );
  });

  it("should include auth in the top-level help output", () => {
    const program = createProgram();
    expect(program.helpInformation()).toContain("auth");
  });

  it("should register span-annotations as a top-level command with a delete subcommand", () => {
    const program = createProgram();
    const spanAnnotationsCommand = program.commands.find(
      (command) => command.name() === "span-annotations"
    );

    expect(spanAnnotationsCommand).toBeDefined();
    expect(
      spanAnnotationsCommand?.commands.map((command) => command.name())
    ).toEqual(expect.arrayContaining(["delete"]));
  });

  it("should register trace-annotations as a top-level command with a delete subcommand", () => {
    const program = createProgram();
    const traceAnnotationsCommand = program.commands.find(
      (command) => command.name() === "trace-annotations"
    );

    expect(traceAnnotationsCommand).toBeDefined();
    expect(
      traceAnnotationsCommand?.commands.map((command) => command.name())
    ).toEqual(expect.arrayContaining(["delete"]));
  });

  it("should register session-annotations as a top-level command with a delete subcommand", () => {
    const program = createProgram();
    const sessionAnnotationsCommand = program.commands.find(
      (command) => command.name() === "session-annotations"
    );

    expect(sessionAnnotationsCommand).toBeDefined();
    expect(
      sessionAnnotationsCommand?.commands.map((command) => command.name())
    ).toEqual(expect.arrayContaining(["delete"]));
  });
});
