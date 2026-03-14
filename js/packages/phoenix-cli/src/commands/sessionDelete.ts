import * as readline from "readline";
import { Command } from "commander";

import { createPhoenixClient } from "../client";
import { getConfigErrorMessage, resolveConfig } from "../config";
import { ExitCode, getExitCodeForError } from "../exitCodes";
import { writeError, writeOutput, writeProgress } from "../io";

interface SessionDeleteOptions {
  endpoint?: string;
  apiKey?: string;
  progress?: boolean;
  yes?: boolean;
}

/**
 * Prompt the user for confirmation via stdin.
 * Returns true if the user types "y" or "yes" (case-insensitive).
 */
function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });
  return new Promise((resolve) => {
    rl.question(`${message} [y/N] `, (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

/**
 * Session delete command handler
 */
async function sessionDeleteHandler(
  sessionIdentifier: string,
  options: SessionDeleteOptions,
): Promise<void> {
  try {
    const config = resolveConfig({
      cliOptions: {
        endpoint: options.endpoint,
        apiKey: options.apiKey,
      },
    });

    if (!config.endpoint) {
      const errors = [
        "Phoenix endpoint not configured. Set PHOENIX_HOST environment variable or use --endpoint flag.",
      ];
      writeError({ message: getConfigErrorMessage({ errors }) });
      process.exit(ExitCode.INVALID_ARGUMENT);
    }

    if (!options.yes) {
      const confirmed = await confirm(
        `Delete session "${sessionIdentifier}" and all associated traces? This cannot be undone.`,
      );
      if (!confirmed) {
        writeOutput({ message: "Cancelled." });
        process.exit(ExitCode.CANCELLED);
      }
    }

    const client = createPhoenixClient({ config });

    writeProgress({
      message: `Deleting session ${sessionIdentifier}...`,
      noProgress: !options.progress,
    });

    const response = await client.DELETE(
      "/v1/sessions/{session_identifier}",
      {
        params: {
          path: {
            session_identifier: sessionIdentifier,
          },
        },
      },
    );

    if (response.error) {
      throw new Error(
        `Failed to delete session: ${JSON.stringify(response.error)}`,
      );
    }

    writeOutput({ message: `Session "${sessionIdentifier}" deleted.` });
  } catch (error) {
    writeError({
      message: `Error deleting session: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

/**
 * Create the session-delete command
 */
export function createSessionDeleteCommand(): Command {
  const command = new Command("session-delete");

  command
    .description("Delete a session and its associated traces")
    .argument(
      "<session-identifier>",
      "Session identifier (GlobalID or user-provided session_id)",
    )
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option("--no-progress", "Disable progress indicators")
    .option("--yes", "Skip confirmation prompt")
    .action(sessionDeleteHandler);

  return command;
}
