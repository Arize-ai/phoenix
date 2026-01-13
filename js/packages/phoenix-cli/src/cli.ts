#!/usr/bin/env node

import {
  createProjectsCommand,
  createTraceCommand,
  createTracesCommand,
} from "./commands";

import { Command } from "commander";

// Phoenix CLI Main Logic
export function main() {
  const program = new Command();

  program
    .name("px")
    .description("Phoenix CLI - AI observability from the command line")
    .version("0.0.4");

  // Register commands
  program.addCommand(createProjectsCommand());
  program.addCommand(createTracesCommand());
  program.addCommand(createTraceCommand());

  // Show help if no command provided
  if (process.argv.length === 2) {
    program.help();
  }

  program.parse();
}
