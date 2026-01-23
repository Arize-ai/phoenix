import { resolveConfig } from "../config";
import { writeError, writeOutput } from "../io";

import { Command } from "commander";

interface AuthStatusOptions {
  endpoint?: string;
  apiKey?: string;
}

/**
 * Obscure an API key for display using asterisks.
 * Shows a fixed number of asterisks regardless of key length for security.
 */
export function obscureApiKey(apiKey: string): string {
  if (!apiKey) {
    return "";
  }
  return "************************************";
}

/**
 * Auth status command handler
 */
async function authStatusHandler(options: AuthStatusOptions): Promise<void> {
  // Resolve configuration
  const config = resolveConfig({
    cliOptions: {
      endpoint: options.endpoint,
      apiKey: options.apiKey,
    },
  });

  // Check if endpoint is configured
  if (!config.endpoint) {
    writeError({
      message: "Configuration Error:\n  - Phoenix endpoint not configured",
    });
    process.exit(1);
  }

  const lines: string[] = [];

  // Display endpoint
  lines.push(config.endpoint);

  // Display API key status
  if (config.apiKey) {
    lines.push("  ✓ Logged in to Phoenix");
    lines.push(`  - API Key: ${obscureApiKey(config.apiKey)}`);
  } else {
    lines.push("  - No API key configured (anonymous access)");
  }

  writeOutput({ message: lines.join("\n") });
}

/**
 * Create the auth status subcommand
 */
function createAuthStatusCommand(): Command {
  const command = new Command("status");

  command
    .description("Show current Phoenix authentication status")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .action(authStatusHandler);

  return command;
}

/**
 * Create the auth command with subcommands
 */
export function createAuthCommand(): Command {
  const command = new Command("auth");

  command.description("Manage Phoenix authentication");

  // Add subcommands
  command.addCommand(createAuthStatusCommand());

  return command;
}
