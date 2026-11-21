/**
 * `px setup doctor` — diagnose why `px` cannot work with a Phoenix server.
 *
 * The checks run in dependency order — config, connectivity, version, auth —
 * and each failure skips the checks after it, so the first failed check is the
 * one to fix.
 */

import {
  HttpError,
  type SemanticVersion,
  formatVersion,
  parseSemanticVersion,
} from "@arizeai/phoenix-client";
import { assertUnreachable } from "@arizeai/phoenix-client/utils/assertUnreachable";
import { Command } from "commander";

import { createPhoenixClient } from "../client";
import {
  DEFAULT_PHOENIX_ENDPOINT,
  type PhoenixConfig,
  resolveConfig,
} from "../config";
import { ExitCode } from "../exitCodes";
import { writeOutput } from "../io";
import {
  ProfileResolutionError,
  SettingsFileError,
  getSettingsPath,
  loadSettings,
} from "../settings";
import { redactForDisplay } from "../setup/util/redact";
import { ENDPOINT_REQUIREMENT, isEndpointUrl } from "../validation/endpoint";
import {
  type FetchViewerResult,
  exitCodeForResult,
  fetchViewerForStatus,
} from "./auth";
import {
  type DoctorCheck,
  type DoctorCheckName,
  type OutputFormat,
  formatDoctorOutput,
} from "./formatSetup";
import type { ConnectionOptions } from "./options";
import { exitWithError } from "./setupErrors";

/** The typed mirror of the flags `px setup doctor` registers. */
interface SetupDoctorOptions extends ConnectionOptions {
  /**
   * `--profile <name>`: Named profile to diagnose instead of the stored active
   * profile.
   *
   * @example "staging"
   */
  profile?: string;
  /**
   * `--format <format>`: `pretty` (default) prints a checklist; `json` and
   * `raw` print `{ checks: [{ name, status, message, fix }] }`.
   *
   * @example "raw"
   */
  format?: OutputFormat;
}

/**
 * A check's printed result, plus the exit code it implies. The exit code is
 * kept out of {@link DoctorCheck} so it never appears in the JSON output.
 */
interface DoctorCheckOutcome {
  check: DoctorCheck;
  /** `ExitCode.SUCCESS` unless the check failed. */
  exitCode: ExitCode;
}

function skipCheck({
  name,
  reason,
}: {
  name: DoctorCheckName;
  reason: string;
}): DoctorCheckOutcome {
  return {
    check: { name, status: "skip", message: `Skipped: ${reason}` },
    exitCode: ExitCode.SUCCESS,
  };
}

/**
 * Validate the settings file, resolve the selected profile, and check the
 * resolved endpoint. Returns the config only when every step succeeded.
 */
function checkConfig({
  options,
}: {
  options: SetupDoctorOptions;
}): DoctorCheckOutcome & {
  config?: PhoenixConfig & { endpoint: string };
} {
  try {
    loadSettings({ strict: true });
  } catch (error) {
    if (error instanceof SettingsFileError) {
      return {
        check: {
          name: "config",
          status: "fail",
          message: error.message,
          fix: `Correct ${getSettingsPath()}, or move it aside to start from empty settings`,
        },
        exitCode: ExitCode.INVALID_ARGUMENT,
      };
    }
    throw error;
  }

  let config: PhoenixConfig;
  try {
    config = resolveConfig({
      cliOptions: { endpoint: options.endpoint, apiKey: options.apiKey },
      profileName: options.profile,
    });
  } catch (error) {
    if (error instanceof ProfileResolutionError) {
      return {
        check: {
          name: "config",
          status: "fail",
          message: error.message,
          fix: "Pass a profile listed by `px profile list` to --profile",
        },
        exitCode: ExitCode.INVALID_ARGUMENT,
      };
    }
    throw error;
  }

  const endpoint = config.endpoint ?? DEFAULT_PHOENIX_ENDPOINT;
  if (!isEndpointUrl(endpoint)) {
    return {
      check: {
        name: "config",
        status: "fail",
        message: `Endpoint "${endpoint}" ${ENDPOINT_REQUIREMENT}`,
        fix: "Set a valid endpoint with --endpoint, PHOENIX_ENDPOINT, or the profile",
      },
      exitCode: ExitCode.INVALID_ARGUMENT,
    };
  }

  const profileSuffix = config.profileName
    ? ` (profile: ${config.profileName})`
    : "";
  return {
    check: {
      name: "config",
      status: "pass",
      message: `Using ${endpoint}${profileSuffix}`,
    },
    exitCode: ExitCode.SUCCESS,
    config: { ...config, endpoint },
  };
}

const PROBE_TIMEOUT_MS = 10_000;

type ServerProbe =
  | { kind: "unreachable"; detail: string }
  | { kind: "httpError"; status: number }
  | { kind: "unexpectedBody" }
  | { kind: "phoenix"; version: SemanticVersion };

/**
 * Fetch the server version without credentials: Phoenix serves this route to
 * anonymous callers, so only a failing or non-Phoenix server rejects it. The
 * configured headers are still sent, since a proxy in front of Phoenix may
 * require them.
 */
async function probeServer({
  config,
}: {
  config: PhoenixConfig & { endpoint: string };
}): Promise<ServerProbe> {
  const client = createPhoenixClient({
    config: { endpoint: config.endpoint, headers: config.headers },
  });
  try {
    const { data } = await client.GET("/arize_phoenix_version", {
      parseAs: "text",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    const version = parseSemanticVersion(data ?? "");
    return version ? { kind: "phoenix", version } : { kind: "unexpectedBody" };
  } catch (error) {
    if (error instanceof HttpError) {
      return { kind: "httpError", status: error.status };
    }
    return { kind: "unreachable", detail: redactForDisplay(String(error)) };
  }
}

function checkConnectivity({
  probe,
  endpoint,
}: {
  probe: ServerProbe;
  endpoint: string;
}): DoctorCheckOutcome {
  if (probe.kind === "unreachable") {
    return {
      check: {
        name: "connectivity",
        status: "fail",
        message: `Could not reach ${endpoint}: ${probe.detail}`,
        fix: "Start the Phoenix server, or point px at it with --endpoint or PHOENIX_ENDPOINT",
      },
      exitCode: ExitCode.NETWORK_ERROR,
    };
  }
  return {
    check: {
      name: "connectivity",
      status: "pass",
      message: `Reached ${endpoint}`,
    },
    exitCode: ExitCode.SUCCESS,
  };
}

function checkVersion({
  probe,
}: {
  probe: Exclude<ServerProbe, { kind: "unreachable" }>;
}): DoctorCheckOutcome {
  switch (probe.kind) {
    case "phoenix":
      return {
        check: {
          name: "version",
          status: "pass",
          message: `Phoenix server ${formatVersion(probe.version)}`,
        },
        exitCode: ExitCode.SUCCESS,
      };
    case "httpError":
      if (probe.status === 429 || probe.status >= 500) {
        return {
          check: {
            name: "version",
            status: "fail",
            message: `The server returned HTTP ${probe.status}`,
            fix: "Check the Phoenix server's logs and health, then retry",
          },
          exitCode: ExitCode.FAILURE,
        };
      }
      return failNotPhoenix({ detail: `HTTP ${probe.status}` });
    case "unexpectedBody":
      return failNotPhoenix({ detail: "unexpected response body" });
    default:
      return assertUnreachable(probe);
  }
}

function failNotPhoenix({ detail }: { detail: string }): DoctorCheckOutcome {
  return {
    check: {
      name: "version",
      status: "fail",
      message: `The server did not answer as Phoenix (${detail})`,
      fix: "Use the Phoenix server's base URL as the endpoint, and set any headers a proxy needs with PHOENIX_CLIENT_HEADERS",
    },
    exitCode: ExitCode.NETWORK_ERROR,
  };
}

function describeAuthResult({
  result,
  config,
}: {
  result: FetchViewerResult;
  config: PhoenixConfig;
}): DoctorCheck {
  switch (result.status) {
    case "success":
      return {
        name: "auth",
        status: "pass",
        message:
          result.user.auth_method === "ANONYMOUS"
            ? "Authentication not required (anonymous access)"
            : `Authenticated as ${result.user.username}`,
      };
    case "auth_error":
      return {
        name: "auth",
        status: "fail",
        message:
          config.credentialSource === "none"
            ? "The server requires authentication, and no credentials are configured"
            : "The server rejected the credentials",
        fix: "Run `px auth login`, or pass a valid API key with --api-key or PHOENIX_API_KEY",
      };
    case "not_found":
      return {
        name: "auth",
        status: "skip",
        message: "Skipped: this server version cannot verify credentials",
      };
    case "network_error":
    case "unknown_error":
      return {
        name: "auth",
        status: "fail",
        message: `Could not verify credentials: ${result.message}`,
      };
    default:
      return assertUnreachable(result);
  }
}

async function checkAuth({
  config,
}: {
  config: PhoenixConfig;
}): Promise<DoctorCheckOutcome> {
  const result = await fetchViewerForStatus(config);
  return {
    check: describeAuthResult({ result, config }),
    exitCode: exitCodeForResult(result),
  };
}

async function runDoctorChecks({
  options,
}: {
  options: SetupDoctorOptions;
}): Promise<DoctorCheckOutcome[]> {
  const configOutcome = checkConfig({ options });
  const { config } = configOutcome;
  if (!config) {
    return [
      configOutcome,
      skipCheck({ name: "connectivity", reason: "config check failed" }),
      skipCheck({ name: "version", reason: "config check failed" }),
      skipCheck({ name: "auth", reason: "config check failed" }),
    ];
  }

  const probe = await probeServer({ config });
  const connectivityOutcome = checkConnectivity({
    probe,
    endpoint: config.endpoint,
  });
  if (probe.kind === "unreachable") {
    return [
      configOutcome,
      connectivityOutcome,
      skipCheck({ name: "version", reason: "connectivity check failed" }),
      skipCheck({ name: "auth", reason: "connectivity check failed" }),
    ];
  }

  const versionOutcome = checkVersion({ probe });
  if (probe.kind !== "phoenix") {
    return [
      configOutcome,
      connectivityOutcome,
      versionOutcome,
      skipCheck({ name: "auth", reason: "version check failed" }),
    ];
  }

  return [
    configOutcome,
    connectivityOutcome,
    versionOutcome,
    await checkAuth({ config }),
  ];
}

async function setupDoctorHandler(options: SetupDoctorOptions): Promise<void> {
  const format = options.format ?? "pretty";
  let outcomes: DoctorCheckOutcome[];
  try {
    outcomes = await runDoctorChecks({ options });
  } catch (error) {
    exitWithError(error, format);
  }
  writeOutput({
    message: formatDoctorOutput({
      output: { checks: outcomes.map((outcome) => outcome.check) },
      format,
    }),
  });

  const firstFailedOutcome = outcomes.find(
    (outcome) => outcome.exitCode !== ExitCode.SUCCESS
  );
  if (firstFailedOutcome) {
    process.exit(firstFailedOutcome.exitCode);
  }
}

export function createSetupDoctorCommand(): Command {
  return new Command("doctor")
    .description(
      "Check config, server connectivity, server version, and authentication"
    )
    .option("--endpoint <url>", "Phoenix API endpoint")
    .option("--api-key <key>", "Phoenix API key for authentication")
    .option("--profile <name>", "Profile to check")
    .option(
      "--format <format>",
      "Output format: pretty, json, or raw",
      "pretty"
    )
    .action(setupDoctorHandler)
    .addHelpText(
      "after",
      `
Examples:
  px setup doctor
  px setup doctor --profile staging
  px setup doctor --format raw

Exit codes (from the first failed check):
  0  Every check passed or was skipped
  1  A server error (HTTP 5xx or 429), including while verifying credentials
  3  Invalid settings file, unknown --profile, or invalid endpoint
  4  Credentials are missing or were rejected
  5  The server could not be reached, or did not answer as Phoenix
`
    );
}
