import * as fs from "node:fs";

import { Command } from "commander";

import { confirmAction } from "../confirm";
import { ExitCode } from "../exitCodes";
import { writeError, writeOutput, writeProgress } from "../io";
import { type InstallTarget, installSkill } from "../skills/install";
import { readManifest } from "../skills/manifest";
import {
  type OutputFormat,
  formatSkillInstall,
  formatSkillList,
  formatSkillShow,
} from "./formatSkill";

interface StructuredError {
  error: string;
  code: string;
  hint?: string;
}

function writeStructuredError(
  structuredError: StructuredError,
  format: OutputFormat
): void {
  if (format === "raw" || format === "json") {
    writeError({ message: JSON.stringify(structuredError) });
  } else {
    writeError({ message: `Error: ${structuredError.error}` });
    if (structuredError.hint) {
      writeError({ message: `  Hint: ${structuredError.hint}` });
    }
  }
}

function createSkillListCommand(): Command {
  const command = new Command("list");

  command
    .description("List available and installed Phoenix skills")
    .option(
      "--format <format>",
      "Output format (pretty|json|raw)",
      "pretty"
    )
    .option("--all", "Show all bundled skills, not just installed ones", false)
    .option("--no-progress", "Suppress progress indicators")
    .action(
      async (options: {
        format: OutputFormat;
        all: boolean;
        progress: boolean;
      }) => {
        writeProgress({
          message: "Reading skill manifest...",
          noProgress: !options.progress,
        });

        const skills = readManifest();

        if (skills.length === 0 && options.format === "pretty") {
          writeOutput({ message: "No bundled skills found." });
          return;
        }

        const output = formatSkillList({
          skills,
          format: options.format,
          all: options.all,
        });

        writeOutput({ message: output });
      }
    );

  command.addHelpText(
    "after",
    `
Examples:
  px skill list
  px skill list --all
  px skill list --format raw --no-progress
  px skill list --all --format json`
  );

  return command;
}

function createSkillShowCommand(): Command {
  const command = new Command("show");

  command
    .description("Show the bundled SKILL.md content for a skill (advisory)")
    .argument("<name>", "Skill name (e.g. phoenix-tracing)")
    .option(
      "--format <format>",
      "Output format (pretty|json|raw)",
      "pretty"
    )
    .option("--no-progress", "Suppress progress indicators")
    .action(
      async (
        name: string,
        options: { format: OutputFormat; progress: boolean }
      ) => {
        writeProgress({
          message: `Reading skill: ${name}`,
          noProgress: !options.progress,
        });

        const skills = readManifest();
        const skill = skills.find((s) => s.name === name);

        if (!skill) {
          writeStructuredError(
            {
              error: `Unknown skill: '${name}'`,
              code: "INVALID_ARGUMENT",
              hint: "px skill list --format raw",
            },
            options.format
          );
          process.exit(ExitCode.INVALID_ARGUMENT);
        }

        if (skill.status === "missing-source" || skill.bundledPath === null) {
          writeStructuredError(
            {
              error: `Bundled source for skill '${name}' is missing or unreadable`,
              code: "FAILURE",
            },
            options.format
          );
          process.exit(ExitCode.FAILURE);
        }

        let content: string;
        try {
          content = fs.readFileSync(skill.bundledPath, "utf-8");
        } catch {
          writeStructuredError(
            {
              error: `Failed to read bundled SKILL.md for '${name}'`,
              code: "FAILURE",
            },
            options.format
          );
          process.exit(ExitCode.FAILURE);
        }

        const output = formatSkillShow({
          skill,
          content,
          format: options.format,
        });

        writeOutput({ message: output });
      }
    );

  command.addHelpText(
    "after",
    `
Examples:
  px skill show phoenix-tracing
  px skill show phoenix-cli --format raw
  px skill show phoenix-evals --format json`
  );

  return command;
}

function createSkillInstallCommand(): Command {
  const command = new Command("install");

  command
    .description("Install a bundled skill into a harness-scanned directory")
    .argument("<name>", "Skill name to install (e.g. phoenix-tracing)")
    .option(
      "--format <format>",
      "Output format (pretty|json|raw)",
      "pretty"
    )
    .option(
      "--target <target>",
      "Target harness directory (agents|claude|cursor|codex)",
      "agents"
    )
    .option("--no-input", "Skip confirmation prompt and proceed")
    .option("--no-progress", "Suppress progress indicators")
    .action(
      async (
        name: string,
        options: {
          format: OutputFormat;
          target: string;
          noInput: boolean;
          progress: boolean;
        }
      ) => {
        const validTargets = ["agents", "claude", "cursor", "codex"];
        if (!validTargets.includes(options.target)) {
          writeStructuredError(
            {
              error: `Invalid target '${options.target}' — must be one of: ${validTargets.join(", ")}`,
              code: "INVALID_ARGUMENT",
            },
            options.format
          );
          process.exit(ExitCode.INVALID_ARGUMENT);
        }

        const target = options.target as InstallTarget;

        writeProgress({
          message: `Looking up skill: ${name}`,
          noProgress: !options.progress,
        });

        const skills = readManifest();
        const skill = skills.find((s) => s.name === name);

        if (!skill) {
          writeStructuredError(
            {
              error: `Unknown skill: '${name}'`,
              code: "INVALID_ARGUMENT",
              hint: "px skill list --format raw",
            },
            options.format
          );
          process.exit(ExitCode.INVALID_ARGUMENT);
        }

        if (skill.status === "missing-source" || skill.bundledPath === null) {
          writeStructuredError(
            {
              error: `Bundled source for skill '${name}' is missing or unreadable`,
              code: "FAILURE",
            },
            options.format
          );
          process.exit(ExitCode.FAILURE);
        }

        const targetDirName =
          target === "agents" ? ".agents/skills" : `.${target}/skills`;

        if (!options.noInput) {
          if (!process.stdin.isTTY) {
            writeError({
              message:
                "Error: stdin is not a TTY. Use --no-input to skip confirmation.",
            });
            process.exit(ExitCode.INVALID_ARGUMENT);
          }

          const confirmed = await confirmAction(
            `Install '${name}' into ${targetDirName}/${name}/?`
          );
          if (!confirmed) {
            process.exit(ExitCode.CANCELLED);
          }
        }

        writeProgress({
          message: `Installing ${name}...`,
          noProgress: !options.progress,
        });

        try {
          const result = installSkill(name, target);

          const output = formatSkillInstall({
            result,
            version: skill.version,
            format: options.format,
          });

          writeOutput({ message: output });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          writeStructuredError(
            {
              error: message,
              code: "FAILURE",
            },
            options.format
          );
          process.exit(ExitCode.FAILURE);
        }
      }
    );

  command.addHelpText(
    "after",
    `
Examples:
  px skill install phoenix-tracing
  px skill install phoenix-tracing --no-input --format raw
  px skill install phoenix-evals --target claude --no-input`
  );

  return command;
}

export function createSkillCommand(): Command {
  const command = new Command("skill");

  command.description("Discover and install Phoenix skills");
  command.addCommand(createSkillListCommand());
  command.addCommand(createSkillShowCommand());
  command.addCommand(createSkillInstallCommand());

  return command;
}
