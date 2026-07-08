#!/usr/bin/env node

// Phoenix CLI Entry Point
import { main } from "./cli";
import { writeError } from "./io";

// Run CLI when executed directly
void main().catch((error) => {
  writeError({
    message: `Error: ${error instanceof Error ? error.message : String(error)}`,
  });
  process.exit(1);
});
