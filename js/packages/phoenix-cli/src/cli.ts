#!/usr/bin/env node

import { Command, CommanderError } from "commander";

import { printBanner } from "./banner";
import {
  createAnnotationConfigCommand,
  createApiCommand,
  createAuthCommand,
  createDatasetCommand,
  createDocsCommand,
  createExperimentCommand,
  createProfileCommand,
  createProjectCommand,
  createPromptCommand,
  createSessionAnnotationsCommand,
  createSessionCommand,
  createSelfCommand,
  createSetupCommand,
  createSpanAnnotationsCommand,
  createSpanCommand,
  createTraceAnnotationsCommand,
  createTraceCommand,
} from "./commands";
import { formatVersionStatus } from "./commands/self";
import { writeError } from "./io";
import {
  CLI_VERSION,
  getCliVersionStatus,
  type FetchLatestPublishedCliVersionOptions,
} from "./version";

export function createProgram(): Command {
  const program = new Command();

  program.name("px");
  program.enablePositionalOptions();
  program.version(CLI_VERSION);
  program.exitOverride();

  // Register commands
  program.addCommand(createAnnotationConfigCommand());
  program.addCommand(createAuthCommand());
  program.addCommand(createProfileCommand());
  program.addCommand(createProjectCommand());
  program.addCommand(createTraceCommand());
  program.addCommand(createTraceAnnotationsCommand());
  program.addCommand(createSpanCommand());
  program.addCommand(createSpanAnnotationsCommand());
  program.addCommand(createDatasetCommand());
  program.addCommand(createSessionCommand());
  program.addCommand(createSessionAnnotationsCommand());
  program.addCommand(createExperimentCommand());
  program.addCommand(createPromptCommand());
  program.addCommand(createApiCommand());
  program.addCommand(createDocsCommand());
  program.addCommand(createSelfCommand());
  program.addCommand(createSetupCommand());

  return program;
}

/**
 * Build the extra guidance shown after an "unknown command" error, comparing
 * the installed version against the latest published one:
 * - behind: show the version pair and point at `px self update`
 * - up to date: point at `px --help` (the command is likely a typo)
 * - version lookup failed: return null (fall back to the plain error)
 */
export async function buildUnknownCommandDiagnosis({
  fetchFn,
  timeoutMs,
}: FetchLatestPublishedCliVersionOptions = {}): Promise<string | null> {
  const status = await getCliVersionStatus({ fetchFn, timeoutMs });

  if (status.latestVersion && status.hasUpdate) {
    return [
      formatVersionStatus({
        currentVersion: status.currentVersion,
        latestVersion: status.latestVersion,
      }),
      "",
      "This command may not exist in your installed version.",
      "Run `px self update` to upgrade.",
    ].join("\n");
  }

  if (status.latestVersion) {
    return `px is up to date (${status.currentVersion}). Run \`px --help\` for available commands.`;
  }

  return null;
}

// Phoenix CLI Main Logic
export async function main({
  argv = process.argv,
  fetchFn,
}: {
  argv?: string[];
  fetchFn?: typeof fetch;
} = {}): Promise<void> {
  const program = createProgram();

  // Show banner and help if no command provided
  if (argv.length === 2) {
    await printBanner();
    program.outputHelp();
    return;
  }

  try {
    await program.parseAsync(argv);
  } catch (error) {
    if (error instanceof CommanderError) {
      if (error.code === "commander.unknownCommand" && process.stdout.isTTY) {
        const diagnosis = await buildUnknownCommandDiagnosis({ fetchFn });
        if (diagnosis) {
          writeError({ message: `\n${diagnosis}` });
        }
      }
      process.exit(error.exitCode);
    }
    throw error;
  }
}
