import * as childProcess from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";

import { ExitCode, getExitCodeForError } from "../exitCodes";
import { writeError, writeOutput } from "../io";
import {
  CLI_VERSION,
  compareSemanticVersions,
  fetchLatestPublishedCliVersion,
} from "../version";

const SUPPORTED_PACKAGE_MANAGERS = ["npm", "pnpm"] as const;
const PACKAGE_MANAGER_PNPM_STORE_DIR = ".pnpm";
const CLI_PACKAGE_NAME = "@arizeai/phoenix-cli";
const CLI_PACKAGE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

type SupportedPackageManager = (typeof SUPPORTED_PACKAGE_MANAGERS)[number];

interface SelfUpdateOptions {
  check?: boolean;
}

export interface UpdateCommand {
  command: string;
  args: string[];
  displayCommand: string;
}

interface PackageManagerRoots {
  npmGlobalRoot?: string | null;
  pnpmGlobalRoot?: string | null;
}

function getPackageManagerExecutable(
  packageManager: SupportedPackageManager
): string {
  return process.platform === "win32" ? `${packageManager}.cmd` : packageManager;
}

/**
 * Returns true when the candidate path is the same as or nested under
 * the provided root path.
 */
function isPathInside(rootPath: string, candidatePath: string): boolean {
  const relativePath = path.relative(rootPath, candidatePath);
  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  );
}

/**
 * Determine which supported package manager owns the current installation.
 */
export function detectInstallPackageManager({
  packageRoot,
  npmGlobalRoot,
  pnpmGlobalRoot,
}: {
  packageRoot: string;
} & PackageManagerRoots): SupportedPackageManager | null {
  if (pnpmGlobalRoot) {
    const pnpmStoreRoot = path.resolve(
      pnpmGlobalRoot,
      "..",
      PACKAGE_MANAGER_PNPM_STORE_DIR
    );
    if (
      isPathInside(pnpmGlobalRoot, packageRoot) ||
      isPathInside(pnpmStoreRoot, packageRoot)
    ) {
      return "pnpm";
    }
  }

  if (npmGlobalRoot && isPathInside(npmGlobalRoot, packageRoot)) {
    return "npm";
  }

  return null;
}

function getGlobalRoot(
  packageManager: SupportedPackageManager
): string | null {
  try {
    return childProcess
      .execFileSync(getPackageManagerExecutable(packageManager), ["root", "-g"], {
        encoding: "utf8",
      })
      .trim();
  } catch {
    return null;
  }
}

/**
 * Build the exact package-manager command that will install the requested
 * version globally.
 */
export function buildUpdateCommand({
  packageManager,
  packageName,
  version,
}: {
  packageManager: SupportedPackageManager;
  packageName: string;
  version: string;
}): UpdateCommand {
  const packageSpecifier = `${packageName}@${version}`;
  const command = getPackageManagerExecutable(packageManager);
  const args =
    packageManager === "pnpm"
      ? ["add", "--global", packageSpecifier]
      : ["install", "--global", packageSpecifier];

  return {
    command,
    args,
    displayCommand: [packageManager, ...args].join(" "),
  };
}

function runUpdateCommand(updateCommand: UpdateCommand): number {
  const result = childProcess.spawnSync(updateCommand.command, updateCommand.args, {
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  return result.status ?? ExitCode.FAILURE;
}

function getCurrentInstallPackageManager({
  packageRoot,
}: {
  packageRoot: string;
}): SupportedPackageManager | null {
  return detectInstallPackageManager({
    packageRoot,
    npmGlobalRoot: getGlobalRoot("npm"),
    pnpmGlobalRoot: getGlobalRoot("pnpm"),
  });
}

function formatVersionStatus({
  currentVersion,
  latestVersion,
}: {
  currentVersion: string;
  latestVersion: string;
}): string {
  return [
    `Current version: ${currentVersion}`,
    `Latest version: ${latestVersion}`,
  ].join("\n");
}

async function selfUpdateHandler(options: SelfUpdateOptions): Promise<void> {
  try {
    const latestVersion = await fetchLatestPublishedCliVersion();
    if (!latestVersion) {
      throw new TypeError("Unable to fetch latest CLI version from npm");
    }
    const versionComparison = compareSemanticVersions({
      leftVersion: latestVersion,
      rightVersion: CLI_VERSION,
    });
    if (versionComparison === null) {
      throw new Error(`Invalid published CLI version: ${latestVersion}`);
    }

    writeOutput({
      message: formatVersionStatus({
        currentVersion: CLI_VERSION,
        latestVersion,
      }),
    });

    if (versionComparison <= 0) {
      writeOutput({ message: "px is up to date." });
      return;
    }

    if (options.check) {
      writeOutput({
        message: "Update available. Run `px self update` to install it.",
      });
      return;
    }

    const packageManager = getCurrentInstallPackageManager({
      packageRoot: CLI_PACKAGE_ROOT,
    });

    if (!packageManager) {
      writeError({
        message:
          "Error: Automatic updates are only supported for global npm or pnpm installs of @arizeai/phoenix-cli.",
      });
      process.exit(ExitCode.FAILURE);
    }

    const updateCommand = buildUpdateCommand({
      packageManager,
      packageName: CLI_PACKAGE_NAME,
      version: latestVersion,
    });

    writeOutput({
      message: `Updating via ${updateCommand.displayCommand}`,
    });

    const exitCode = runUpdateCommand(updateCommand);
    if (exitCode !== ExitCode.SUCCESS) {
      process.exit(exitCode);
    }

    writeOutput({
      message: `Updated px to ${latestVersion}.`,
    });
  } catch (error) {
    writeError({
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
    process.exit(getExitCodeForError(error));
  }
}

function createSelfUpdateCommand(): Command {
  const command = new Command("update");

  command
    .description("Update the installed Phoenix CLI to the latest npm version")
    .option("--check", "Only check whether a newer version is available")
    .action(selfUpdateHandler);

  return command;
}

export function createSelfCommand(): Command {
  const command = new Command("self");

  command.description("Manage the installed Phoenix CLI");
  command.addCommand(createSelfUpdateCommand());

  return command;
}
