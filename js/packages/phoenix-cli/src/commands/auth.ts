import type { componentsV1 } from "@arizeai/phoenix-client";
import { getStrFromEnvironment } from "@arizeai/phoenix-config";
import { Command } from "commander";

import { createPhoenixClient } from "../client";
import {
  ENV_PHOENIX_PROFILE,
  type PhoenixConfig,
  resolveConfig,
} from "../config";
import { ExitCode, getExitCodeForError } from "../exitCodes";
import { writeError, writeOutput } from "../io";
import {
  ProfileResolutionError,
  getActiveProfile,
  loadSettings,
} from "../settings";

type ViewerUser = componentsV1["schemas"]["GetViewerResponseBody"]["data"];

interface AuthStatusOptions {
  endpoint?: string;
  apiKey?: string;
  profile?: string;
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

interface FetchViewerSuccess {
  status: "success";
  user: ViewerUser;
}

interface FetchViewerError {
  status: "network_error" | "auth_error" | "not_found" | "unknown_error";
  message: string;
}

export type FetchViewerResult = FetchViewerSuccess | FetchViewerError;

/**
 * Extract an HTTP status code from the phoenix-client middleware error message.
 * The middleware throws errors like: "https://example.org/api/v1/user: 401 Unauthorized"
 */
function parseStatusCode(error: Error): number | null {
  const match = error.message.match(/:\s*(\d{3})\s/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Fetch the authenticated viewer from the Phoenix server.
 * Gracefully handles network errors, auth failures, and missing endpoints.
 */
async function fetchViewer(config: PhoenixConfig): Promise<FetchViewerResult> {
  try {
    const client = createPhoenixClient({ config });
    const response = await client.GET("/v1/user");
    return { status: "success", user: response.data!.data };
  } catch (error: unknown) {
    // TypeError is thrown by the Fetch API for network-level failures
    if (error instanceof TypeError) {
      return { status: "network_error", message: error.message };
    }
    if (error instanceof Error) {
      const statusCode = parseStatusCode(error);
      if (statusCode === 401 || statusCode === 403) {
        return { status: "auth_error", message: error.message };
      }
      if (statusCode === 404) {
        return { status: "not_found", message: error.message };
      }
      return { status: "unknown_error", message: error.message };
    }
    return { status: "unknown_error", message: String(error) };
  }
}

/**
 * Format auth status output in gh-style format.
 */
export function formatAuthStatus(
  endpoint: string,
  result: FetchViewerResult,
  apiKey?: string,
  profileName?: string
): string {
  const lines: string[] = [endpoint];

  if (profileName) {
    lines.push(`  - Profile: ${profileName}`);
  }

  if (result.status === "success") {
    const user = result.user;
    if (user.auth_method === "ANONYMOUS") {
      lines.push("  \u2713 Authentication not required (anonymous)");
    } else {
      lines.push(`  \u2713 Logged in as ${user.username} (api key)`);
      lines.push(`  - Role: ${user.role}`);
    }
  } else if (result.status === "auth_error") {
    lines.push("  \u2717 Authentication failed (invalid or expired token)");
  } else if (result.status === "not_found") {
    lines.push(
      "  - Could not verify token (server does not support user endpoint)"
    );
  } else {
    // network_error or unknown_error
    if (apiKey) {
      lines.push(
        "  \u2717 Token configured but could not verify (server unreachable)"
      );
    } else {
      lines.push("  \u2717 Could not connect to server");
    }
  }

  if (apiKey) {
    lines.push(`  - Token: ${obscureApiKey(apiKey)}`);
  }

  return lines.join("\n");
}

function exitCodeForResult(result: FetchViewerResult): ExitCode {
  switch (result.status) {
    case "success":
    // 404 means the server is an older version without /v1/user — the token
    // may still be valid, we just can't verify it. Not a failure.
    case "not_found":
      return ExitCode.SUCCESS;
    case "auth_error":
      return ExitCode.AUTH_REQUIRED;
    case "network_error":
      return ExitCode.NETWORK_ERROR;
    case "unknown_error":
      return ExitCode.FAILURE;
  }
}

/**
 * Auth status command handler
 */
async function authStatusHandler(options: AuthStatusOptions): Promise<void> {
  let config: PhoenixConfig;
  try {
    config = resolveConfig({
      cliOptions: {
        endpoint: options.endpoint,
        apiKey: options.apiKey,
      },
      profileName: options.profile,
    });
  } catch (err) {
    if (err instanceof ProfileResolutionError) {
      writeError({ message: err.message });
      process.exit(getExitCodeForError(err));
    }
    throw err;
  }

  if (!config.endpoint) {
    writeError({
      message: "Configuration Error:\n  - Phoenix endpoint not configured",
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }

  // Resolve the active profile name for display purposes. Safe to call
  // after resolveConfig — any invalid explicit profile would have thrown.
  const settingsFile = loadSettings();
  const envProfileName = getStrFromEnvironment(ENV_PHOENIX_PROFILE);
  const activeProfileName = getActiveProfile(
    settingsFile,
    options.profile ?? envProfileName
  )?.name;

  const result = await fetchViewer(config);
  const output = formatAuthStatus(
    config.endpoint,
    result,
    config.apiKey,
    activeProfileName
  );
  writeOutput({ message: output });

  const code = exitCodeForResult(result);
  if (code !== ExitCode.SUCCESS) {
    process.exit(code);
  }
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
    .option("--profile <name>", "Auth profile to use")
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
