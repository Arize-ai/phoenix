import { type componentsV1, HttpError } from "@arizeai/phoenix-client";
import { Command } from "commander";

import { createPhoenixClient } from "../client";
import { type PhoenixConfig, resolveConfig } from "../config";
import {
  AuthRequiredError,
  ExitCode,
  NetworkError,
  getExitCodeForError,
} from "../exitCodes";
import { writeError, writeOutput } from "../io";
import {
  OAUTH_UNSUPPORTED_MESSAGE,
  discoverOAuthAuthorizationServer,
  resolveTargetProfileName,
  revokeOAuthToken,
  runBrowserLoginFlow,
  tokenResponseToOAuthTokens,
  withSettingsLock,
} from "../oauth";
import {
  type OAuthTokens,
  type SettingsFile,
  ProfileResolutionError,
  getProfileByName,
  getSettingsPath,
  getStoredActiveProfile,
  loadSettings,
  saveSettings,
} from "../settings";
import type { OutputFormat } from "./formatProfiles";
import type { ConnectionOptions } from "./options";

type ViewerUser = componentsV1["schemas"]["GetViewerResponseBody"]["data"];

/**
 * Options for `px auth status`.
 */
interface AuthStatusOptions extends ConnectionOptions {
  /**
   * `--profile <name>`: Named profile to resolve the connection and identity
   * from, overriding the stored active profile. Also determines the profile
   * name shown in the output; an invalid name here throws before any output
   * is produced.
   *
   * @example "staging"
   */
  profile?: string;
  format?: OutputFormat;
}

interface AuthLoginOptions extends AuthStatusOptions {
  browser?: boolean;
  input?: boolean;
}

type AuthLogoutOptions = AuthStatusOptions;

interface AuthOutput {
  endpoint: string;
  profile?: string;
  credentialSource: NonNullable<PhoenixConfig["credentialSource"]>;
  expiresAt?: string;
  user?: ViewerUser;
  status: "authenticated" | "anonymous" | "unverified" | "logged_out";
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
 * Fetch the authenticated viewer from the Phoenix server.
 * Gracefully handles network errors, auth failures, and missing endpoints.
 */
async function fetchViewer(config: PhoenixConfig): Promise<FetchViewerResult> {
  try {
    const client = createPhoenixClient({ config });
    const response = await client.GET("/v1/user");
    return { status: "success", user: response.data!.data };
  } catch (error: unknown) {
    if (error instanceof TypeError) {
      return { status: "network_error", message: error.message };
    }
    if (error instanceof AuthRequiredError) {
      return { status: "auth_error", message: error.message };
    }
    if (error instanceof HttpError) {
      if (error.status === 401 || error.status === 403) {
        return { status: "auth_error", message: error.message };
      }
      if (error.status === 404) {
        return { status: "not_found", message: error.message };
      }
    }
    if (error instanceof Error) {
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
  profileName?: string,
  credentialSource: PhoenixConfig["credentialSource"] = apiKey
    ? "profile-key"
    : "none",
  oauthTokens?: OAuthTokens,
  format: OutputFormat = "pretty"
): string {
  const source = credentialSource ?? "none";
  const structured = buildAuthOutput({
    endpoint,
    result,
    profileName,
    credentialSource: source,
    oauthTokens,
  });
  if (format === "raw") {
    return JSON.stringify(structured);
  }
  if (format === "json") {
    return JSON.stringify(structured, null, 2);
  }

  const lines: string[] = [endpoint];

  if (profileName) {
    lines.push(`  - Profile: ${profileName}`);
  }

  if (result.status === "success") {
    const user = result.user;
    if (user.auth_method === "ANONYMOUS") {
      lines.push("  \u2713 Authentication not required (anonymous)");
    } else {
      lines.push(
        `  \u2713 Logged in as ${user.username} (${formatCredentialSource(source)})`
      );
      lines.push(`  - Role: ${user.role}`);
    }
  } else if (result.status === "auth_error") {
    lines.push("  \u2717 Authentication failed (invalid or expired token)");
  } else if (result.status === "not_found") {
    lines.push(
      "  - Could not verify token (server does not support user endpoint)"
    );
  } else if (apiKey || oauthTokens) {
    lines.push(
      "  \u2717 Token configured but could not verify (server unreachable)"
    );
  } else {
    lines.push("  \u2717 Could not connect to server");
  }

  if (apiKey) {
    lines.push(`  - Token: ${obscureApiKey(apiKey)}`);
  }
  if (oauthTokens) {
    lines.push(`  - Expires: ${oauthTokens.expiresAt}`);
  }

  return lines.join("\n");
}

function buildAuthOutput({
  endpoint,
  result,
  profileName,
  credentialSource,
  oauthTokens,
}: {
  endpoint: string;
  result: FetchViewerResult;
  profileName?: string;
  credentialSource: NonNullable<PhoenixConfig["credentialSource"]>;
  oauthTokens?: OAuthTokens;
}): AuthOutput {
  const base = {
    endpoint,
    ...(profileName ? { profile: profileName } : {}),
    credentialSource,
    ...(oauthTokens
      ? {
          expiresAt: oauthTokens.expiresAt,
        }
      : {}),
  };

  if (result.status === "success") {
    return {
      ...base,
      status:
        result.user.auth_method === "ANONYMOUS" ? "anonymous" : "authenticated",
      user: result.user,
    };
  }
  return { ...base, status: "unverified" };
}

function formatCredentialSource(
  source: NonNullable<PhoenixConfig["credentialSource"]>
): string {
  switch (source) {
    case "flag":
      return "flag";
    case "env":
      return "env";
    case "profile-key":
      return "profile api key";
    case "oauth":
      return "oauth";
    case "none":
      return "none";
    default:
      return assertNever(source);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}

function formatAuthOutput(
  output: AuthOutput,
  format: OutputFormat = "pretty"
): string {
  if (format === "raw") {
    return JSON.stringify(output);
  }
  if (format === "json") {
    return JSON.stringify(output, null, 2);
  }

  const lines = [output.endpoint];
  if (output.profile) {
    lines.push(`  - Profile: ${output.profile}`);
  }
  if (output.status === "logged_out") {
    lines.push("  \u2713 Logged out");
  } else if (output.user?.auth_method === "ANONYMOUS") {
    lines.push("  \u2713 Authentication not required (anonymous)");
  } else if (output.user?.username) {
    lines.push(
      `  \u2713 Logged in as ${output.user.username} (${formatCredentialSource(output.credentialSource)})`
    );
    if ("role" in output.user && output.user.role) {
      lines.push(`  - Role: ${output.user.role}`);
    }
  }
  if (output.expiresAt) {
    lines.push(`  - Expires: ${output.expiresAt}`);
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
    default:
      return assertNever(result);
  }
}

async function verifyViewerOrExit(config: PhoenixConfig): Promise<ViewerUser> {
  const result = await fetchViewer(config);
  if (result.status === "success") {
    return result.user;
  }
  if (result.status === "auth_error") {
    writeError({ message: "Authentication failed." });
    process.exit(ExitCode.AUTH_REQUIRED);
  }
  if (result.status === "network_error") {
    writeError({ message: `Network error: ${result.message}` });
    process.exit(ExitCode.NETWORK_ERROR);
  }
  writeError({ message: `Could not verify login: ${result.message}` });
  return process.exit(ExitCode.FAILURE);
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

  // Resolve the profile name for display purposes. Safe to call after
  // resolveConfig — any invalid explicit profile would have thrown.
  const settingsFile = loadSettings();
  const activeProfileName =
    options.profile !== undefined
      ? getProfileByName(settingsFile, options.profile)?.name
      : getStoredActiveProfile(settingsFile)?.name;

  const result = await fetchViewer(config);
  const oauthTokens = loadCurrentOAuthTokens({
    config,
    profileName: activeProfileName,
  });
  const output = formatAuthStatus(
    config.endpoint,
    result,
    config.apiKey,
    activeProfileName,
    config.credentialSource,
    oauthTokens,
    options.format
  );
  writeOutput({ message: output });

  const code = exitCodeForResult(result);
  if (code !== ExitCode.SUCCESS) {
    process.exit(code);
  }
}

function loadCurrentOAuthTokens({
  config,
  profileName,
}: {
  config: PhoenixConfig;
  profileName?: string;
}): OAuthTokens | undefined {
  if (config.credentialSource !== "oauth" || !profileName) {
    return config.oauthTokens;
  }
  return getProfileByName(loadSettings(), profileName)?.entry.oauthTokens;
}

async function authLoginHandler(options: AuthLoginOptions): Promise<void> {
  try {
    const config = resolveConfig({
      cliOptions: {
        endpoint: options.endpoint,
        apiKey: options.apiKey,
      },
      profileName: options.profile,
    });
    const endpoint = config.endpoint;
    if (!endpoint) {
      writeError({
        message: "Configuration Error:\n  - Phoenix endpoint not configured",
      });
      process.exit(ExitCode.INVALID_ARGUMENT);
    }

    // Pre-flight before binding a callback port or opening a browser: bail
    // cleanly when the server is down or does not run the OAuth authorization
    // server, instead of sending the user through a consent flow that can
    // only fail at the token exchange.
    const discovery = await discoverOAuthAuthorizationServer({ endpoint });
    if (discovery.status === "unreachable") {
      throw new NetworkError(
        `Could not reach the Phoenix server at ${endpoint}: ${discovery.detail}. ` +
          "Check that the server is running and the endpoint is correct."
      );
    }
    if (discovery.status === "unsupported") {
      throw new AuthRequiredError(OAUTH_UNSUPPORTED_MESSAGE);
    }

    const settingsAtLogin = loadSettings({ strict: true });
    const targetProfileName = resolveTargetProfileName(
      settingsAtLogin,
      options.profile
    );
    const profileHasApiKey = Boolean(
      settingsAtLogin.profiles[targetProfileName]?.apiKey
    );
    const loginResult = await runBrowserLoginFlow({
      endpoint,
      onAuthorizationUrl: (url) =>
        writeError({ message: `Open this URL to log in:\n${url}` }),
      openBrowserWindow: options.browser !== false,
      onBrowserOpenFailed: (error) =>
        writeError({
          message: `Could not open a browser automatically: ${
            error instanceof Error ? error.message : String(error)
          }`,
        }),
      allowPastedRedirect: options.input !== false,
    });

    if (loginResult.status === "cancelled") {
      writeError({ message: "OAuth login cancelled." });
      process.exit(ExitCode.CANCELLED);
    }
    if (loginResult.status === "invalid") {
      writeError({ message: loginResult.message });
      process.exit(ExitCode.FAILURE);
    }

    const oauthTokens = tokenResponseToOAuthTokens({
      response: loginResult.tokens,
    });
    // Re-read and write under the settings lock so a token rotation running
    // in another px process cannot be clobbered by this stale snapshot.
    await withSettingsLock(getSettingsPath(), async () => {
      saveSettings(
        persistOAuthTokens({
          settingsFile: loadSettings({ strict: true }),
          profileName: targetProfileName,
          endpoint,
          oauthTokens,
        })
      );
    });

    const user = await verifyViewerOrExit({
      ...config,
      endpoint,
      oauthTokens,
      profileName: targetProfileName,
      apiKey: undefined,
      credentialSource: "oauth",
    });
    if (profileHasApiKey) {
      writeError({
        message:
          `Note: profile "${targetProfileName}" also has an API key, which takes precedence over the OAuth session. ` +
          "Remove the API key from the profile to use OAuth credentials.",
      });
    }
    writeOutput({
      message: formatAuthOutput(
        {
          endpoint,
          profile: targetProfileName,
          credentialSource: "oauth",
          expiresAt: oauthTokens.expiresAt,
          user,
          status:
            user.auth_method === "ANONYMOUS" ? "anonymous" : "authenticated",
        },
        options.format
      ),
    });
  } catch (error) {
    if (
      error instanceof AuthRequiredError ||
      error instanceof NetworkError ||
      error instanceof ProfileResolutionError
    ) {
      writeError({ message: error.message });
      process.exit(getExitCodeForError(error));
    }
    throw error;
  }
}

async function authLogoutHandler(options: AuthLogoutOptions): Promise<void> {
  let config: PhoenixConfig;
  try {
    config = resolveConfig({
      cliOptions: {
        endpoint: options.endpoint,
        apiKey: options.apiKey,
      },
      profileName: options.profile,
    });
  } catch (error) {
    if (error instanceof ProfileResolutionError) {
      writeError({ message: error.message });
      process.exit(getExitCodeForError(error));
    }
    throw error;
  }

  const settingsFile = loadSettings({ strict: true });
  const targetProfileName = resolveTargetProfileName(
    settingsFile,
    options.profile
  );
  const profile = getProfileByName(settingsFile, targetProfileName);
  const refreshToken = profile?.entry.oauthTokens?.refreshToken;
  // Revoke against the endpoint stored on the profile — the server that
  // issued the tokens — never a --endpoint/PHOENIX_HOST override, which would
  // leak the refresh token to a host that never issued it.
  const issuingEndpoint = profile?.entry.endpoint;
  if (refreshToken && issuingEndpoint) {
    try {
      await revokeOAuthToken({ endpoint: issuingEndpoint, refreshToken });
    } catch (error) {
      writeError({
        message: `Warning: Could not revoke OAuth token: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }

  if (profile) {
    // Re-read and write under the settings lock so a token rotation running
    // in another px process is not clobbered by the pre-revoke snapshot.
    await withSettingsLock(getSettingsPath(), async () => {
      const latestSettings = loadSettings({ strict: true });
      const latestProfile = getProfileByName(latestSettings, targetProfileName);
      if (!latestProfile) {
        return;
      }
      const { oauthTokens: _oauthTokens, ...entryWithoutOAuth } =
        latestProfile.entry;
      saveSettings({
        ...latestSettings,
        profiles: {
          ...latestSettings.profiles,
          [targetProfileName]: entryWithoutOAuth,
        },
      });
    });
  }

  writeOutput({
    message: formatAuthOutput(
      {
        endpoint: config.endpoint ?? "",
        profile: targetProfileName,
        credentialSource: config.apiKey
          ? (config.credentialSource ?? "profile-key")
          : "none",
        status: "logged_out",
      },
      options.format
    ),
  });
}

function persistOAuthTokens({
  settingsFile,
  profileName,
  endpoint,
  oauthTokens,
}: {
  settingsFile: SettingsFile;
  profileName: string;
  endpoint: string;
  oauthTokens: OAuthTokens;
}): SettingsFile {
  const existingProfile = settingsFile.profiles[profileName] ?? {};
  return {
    ...settingsFile,
    activeProfile: settingsFile.activeProfile ?? profileName,
    profiles: {
      ...settingsFile.profiles,
      [profileName]: {
        ...existingProfile,
        endpoint,
        oauthTokens,
      },
    },
  };
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
    .option("--profile <name>", "Profile to use")
    .option(
      "--format <format>",
      'Output format: pretty, json, or raw (default: "pretty")'
    )
    .addHelpText(
      "after",
      `
Examples:
  px auth status
  px auth status --profile staging
  px auth status --format raw
`
    )
    .action(authStatusHandler);

  return command;
}

function createAuthLoginCommand(): Command {
  return new Command("login")
    .description("Log in to Phoenix with browser-based OAuth.")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option("--profile <name>", "Profile to store OAuth tokens in")
    .option("--no-browser", "Print the login URL without opening a browser")
    .option("--no-input", "Do not prompt for a pasted redirect URL")
    .option(
      "--format <format>",
      'Output format: pretty, json, or raw (default: "pretty")'
    )
    .addHelpText(
      "after",
      `
Examples:
  px auth login
  px auth login --no-browser
  px auth login --profile staging --format raw
`
    )
    .action(authLoginHandler);
}

function createAuthLogoutCommand(): Command {
  return new Command("logout")
    .description("Log out of the current Phoenix OAuth session")
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option("--profile <name>", "Profile to clear OAuth tokens from")
    .option(
      "--format <format>",
      'Output format: pretty, json, or raw (default: "pretty")'
    )
    .addHelpText(
      "after",
      `
Examples:
  px auth logout
  px auth logout --profile staging
  px auth logout --format raw
`
    )
    .action(authLogoutHandler);
}

/**
 * Create the auth command with subcommands
 */
export function createAuthCommand(): Command {
  const command = new Command("auth");

  command.description("Manage Phoenix authentication");

  // Add subcommands
  command.addCommand(createAuthLoginCommand());
  command.addCommand(createAuthLogoutCommand());
  command.addCommand(createAuthStatusCommand());

  return command;
}
