#!/usr/bin/env node

import { Command } from "commander";

// Phoenix CLI Main Logic
// This file contains the main CLI functionality

export function main() {
  const program = new Command();

  program
    .name("px")
    .description("A command-line interface for Phoenix")
    .version("1.0.0");

  program.parse();
}

// Run CLI if this file is executed directly
if (require.main === module) {
  main();
}
