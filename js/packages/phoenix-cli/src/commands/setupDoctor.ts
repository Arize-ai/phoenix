/**
 * `px setup doctor` — diagnose why `px` cannot work with a Phoenix server.
 *
 * The checks run in dependency order — config, connectivity, version, auth —
 * and the ones that need a reachable server are skipped once it isn't, so the
 * first failed check is the one to fix.
 */

import { formatVersion } from "@arizeai/phoenix-client";
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
import { createPhoenixClientFactory } from "../setup/deps/phoenixClient";
import { probeEndpoint } from "../setup/steps/chooseEndpoint";
import { ENDPOINT_REQUIREMENT, isEndpointUrl } from "../validation/endpoint";
import { fetchViewerForStatus } from "./auth";
import {
  type DoctorCheck,
  type DoctorCheckName,
  type OutputFormat,
  formatDoctorOutput,
} from "./formatSetup";
import type { ConnectionOptions } from "./options";

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

/** The exit code for each check when it is the first to fail. */
const DOCTOR_FAILURE_EXIT_CODES: Record<DoctorCheckName, ExitCode> = {
  config: ExitCode.INVALID_ARGUMENT,
  connectivity: ExitCode.NETWORK_ERROR,
  version: ExitCode.FAILURE,
  auth: ExitCode.AUTH_REQUIRED,
};

function skipCheck({
  name,
  reason,
}: {
  name: DoctorCheckName;
  reason: string;
}): DoctorCheck {
  return { name, status: "skip", message: `Skipped: ${reason}` };
}

/**
 * Validate the settings file, resolve the selected profile, and check the
 * resolved endpoint. Returns the config only when every step succeeded.
 */
function checkConfig({ options }: { options: SetupDoctorOptions }): {
  check: DoctorCheck;
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
    config: { ...config, endpoint },
  };
}

async function checkConnectivity({
  endpoint,
}: {
  endpoint: string;
}): Promise<DoctorCheck> {
  const outcome = await probeEndpoint(
    { createClient: createPhoenixClientFactory() },
    endpoint
  );
  switch (outcome.kind) {
    case "authOff":
    case "authOn":
      return {
        name: "connectivity",
        status: "pass",
        message: `Reached ${endpoint}`,
      };
    case "unreachable":
      return {
        name: "connectivity",
        status: "fail",
        message: `Could not reach ${endpoint}: ${outcome.detail}`,
        fix: "Start the Phoenix server, or point px at it with --endpoint or PHOENIX_ENDPOINT",
      };
    case "notPhoenix":
      return {
        name: "connectivity",
        status: "fail",
        message: `${endpoint} responded, but not as a Phoenix server (${outcome.detail})`,
        fix: "Use the Phoenix server's base URL as the endpoint",
      };
    default:
      return assertUnreachable(outcome);
  }
}

async function checkVersion({
  config,
}: {
  config: PhoenixConfig;
}): Promise<DoctorCheck> {
  try {
    const version = await createPhoenixClient({ config }).getServerVersion();
    return {
      name: "version",
      status: "pass",
      message: `Phoenix server ${formatVersion(version)}`,
    };
  } catch (error) {
    // getServerVersion documents a plain Error as its only failure.
    if (!(error instanceof Error)) {
      throw error;
    }
    return {
      name: "version",
      status: "fail",
      message: "The server did not report a Phoenix version",
      fix: "Use the Phoenix server's base URL as the endpoint",
    };
  }
}

async function checkAuth({
  config,
}: {
  config: PhoenixConfig;
}): Promise<DoctorCheck> {
  const result = await fetchViewerForStatus(config);
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
      return skipCheck({
        name: "auth",
        reason: "this server version cannot verify credentials",
      });
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

async function runDoctorChecks({
  options,
}: {
  options: SetupDoctorOptions;
}): Promise<DoctorCheck[]> {
  const { check: configCheck, config } = checkConfig({ options });
  if (!config) {
    return [
      configCheck,
      skipCheck({ name: "connectivity", reason: "config check failed" }),
      skipCheck({ name: "version", reason: "config check failed" }),
      skipCheck({ name: "auth", reason: "config check failed" }),
    ];
  }

  const connectivityCheck = await checkConnectivity({
    endpoint: config.endpoint,
  });
  if (connectivityCheck.status === "fail") {
    return [
      configCheck,
      connectivityCheck,
      skipCheck({ name: "version", reason: "connectivity check failed" }),
      skipCheck({ name: "auth", reason: "connectivity check failed" }),
    ];
  }

  return [
    configCheck,
    connectivityCheck,
    await checkVersion({ config }),
    await checkAuth({ config }),
  ];
}

async function setupDoctorHandler(options: SetupDoctorOptions): Promise<void> {
  const checks = await runDoctorChecks({ options });
  writeOutput({
    message: formatDoctorOutput({
      output: { checks },
      format: options.format,
    }),
  });

  const firstFailedCheck = checks.find((check) => check.status === "fail");
  if (firstFailedCheck) {
    process.exit(DOCTOR_FAILURE_EXIT_CODES[firstFailedCheck.name]);
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
      'Output format: pretty, json, or raw (default: "pretty")'
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
  1  version: the server did not report a Phoenix version
  3  config: invalid settings file, unknown --profile, or invalid endpoint
  4  auth: credentials were rejected or could not be verified
  5  connectivity: the server could not be reached, or is not Phoenix
`
    );
}
