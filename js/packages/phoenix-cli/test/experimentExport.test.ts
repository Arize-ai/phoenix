import { describe, expect, it } from "vitest";

import { createExperimentExportCommand } from "../src/commands/experimentExport";

describe("Experiment Export Command", () => {
  it("should create a command named 'export'", () => {
    const command = createExperimentExportCommand();
    expect(command.name()).toBe("export");
  });

  it("should have the correct description", () => {
    const command = createExperimentExportCommand();
    expect(command.description()).toBe(
      "Export experiment runs in CSV or JSON format"
    );
  });

  it("should accept experiment-id as a required argument", () => {
    const command = createExperimentExportCommand();
    const args = command.registeredArguments;
    expect(args).toHaveLength(1);
    expect(args[0].name()).toBe("experiment-id");
  });

  it("should have --format option defaulting to json", () => {
    const command = createExperimentExportCommand();
    const formatOption = command.options.find(
      (opt) => opt.long === "--format"
    );
    expect(formatOption).toBeDefined();
    expect(formatOption?.defaultValue).toBe("json");
  });

  it("should have --output option", () => {
    const command = createExperimentExportCommand();
    const outputOption = command.options.find(
      (opt) => opt.long === "--output"
    );
    expect(outputOption).toBeDefined();
  });

  it("should have --endpoint option", () => {
    const command = createExperimentExportCommand();
    const option = command.options.find((opt) => opt.long === "--endpoint");
    expect(option).toBeDefined();
  });

  it("should have --api-key option", () => {
    const command = createExperimentExportCommand();
    const option = command.options.find((opt) => opt.long === "--api-key");
    expect(option).toBeDefined();
  });

  it("should have --no-progress option", () => {
    const command = createExperimentExportCommand();
    const option = command.options.find(
      (opt) => opt.long === "--no-progress" || opt.long === "--progress"
    );
    expect(option).toBeDefined();
  });
});

describe("Experiment command has export subcommand", () => {
  it("should register export as a subcommand of experiment", async () => {
    const { createExperimentCommand } = await import(
      "../src/commands/experiment"
    );
    const command = createExperimentCommand();
    const subcommands = command.commands;
    const exportCmd = subcommands.find((cmd) => cmd.name() === "export");
    expect(exportCmd).toBeDefined();
  });
});
