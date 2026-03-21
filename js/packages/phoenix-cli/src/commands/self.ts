import * as childProcess from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";

import { ExitCode, getExitCodeForError } from "../exitCodes";
import { writeError, writeOutput } from "../io";

const PACKAGE_JSON_URL = new URL("../../package.json", import.meta.url);
const SUPPORTED_PACKAGE_MANAGERS = ["npm", "pnpm"] as const;
const PACKAGE_MANAGER_PNPM_STORE_DIR = ".pnpm";

type SupportedPackageManager = (typeof SUPPORTED_PACKAGE_MANAGERS)[number];

interface SelfUpdateOptions {
  check?: boolean;
}

export interface InstalledPackageMetadata {
  name: string;
  version: string;
  packageRoot: string;
}

interface NpmLatestMetadata {
  version: string;
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
 * Parse a semantic version into its core numeric identifiers and optional
 * prerelease identifiers. Build metadata is ignored for comparison.
 */
function parseVersion(version: string): {
  core: [number, number, number];
  prerelease: string[];
} {
  const [versionWithoutBuildMetadata] = version.split("+", 1);
  const prereleaseSeparatorIndex = versionWithoutBuildMetadata.indexOf("-");
  const coreVersion =
    prereleaseSeparatorIndex === -1
      ? versionWithoutBuildMetadata
      : versionWithoutBuildMetadata.slice(0, prereleaseSeparatorIndex);
  const prereleaseVersion =
    prereleaseSeparatorIndex === -1
      ? undefined
      : versionWithoutBuildMetadata.slice(prereleaseSeparatorIndex + 1);
  const coreIdentifiers = coreVersion.split(".");

  if (coreIdentifiers.length !== 3) {
    throw new Error(`Invalid semantic version: ${version}`);
  }

  const parsedCore = coreIdentifiers.map((identifier) => {
    if (!/^\d+$/.test(identifier)) {
      throw new Error(`Invalid semantic version: ${version}`);
    }
    return Number.parseInt(identifier, 10);
  }) as [number, number, number];

  const prereleaseIdentifiers = prereleaseVersion
    ? prereleaseVersion.split(".")
    : [];

  return {
    core: parsedCore,
    prerelease: prereleaseIdentifiers,
  };
}

function comparePrereleaseIdentifiers(left: string, right: string): number {
  const isLeftNumeric = /^\d+$/.test(left);
  const isRightNumeric = /^\d+$/.test(right);

  if (isLeftNumeric && isRightNumeric) {
    return Number.parseInt(left, 10) - Number.parseInt(right, 10);
  }

  if (isLeftNumeric) {
    return -1;
  }

  if (isRightNumeric) {
    return 1;
  }

  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}

/**
 * Compare two semantic versions using semver precedence rules.
 * Returns a negative number if left < right, zero if equal, or a positive
 * number if left > right.
 */
export function compareVersions({
  leftVersion,
  rightVersion,
}: {
  leftVersion: string;
  rightVersion: string;
}): number {
  const left = parseVersion(leftVersion);
  const right = parseVersion(rightVersion);

  for (let index = 0; index < left.core.length; index++) {
    const difference = left.core[index] - right.core[index];
    if (difference !== 0) {
      return difference;
    }
  }

  if (left.prerelease.length === 0 && right.prerelease.length === 0) {
    return 0;
  }

  if (left.prerelease.length === 0) {
    return 1;
  }

  if (right.prerelease.length === 0) {
    return -1;
  }

  const maxIdentifiers = Math.max(
    left.prerelease.length,
    right.prerelease.length
  );
  for (let index = 0; index < maxIdentifiers; index++) {
    const leftIdentifier = left.prerelease[index];
    const rightIdentifier = right.prerelease[index];

    if (leftIdentifier == null) {
      return -1;
    }

    if (rightIdentifier == null) {
      return 1;
    }

    const difference = comparePrereleaseIdentifiers(
      leftIdentifier,
      rightIdentifier
    );
    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

/**
 * Read the installed package metadata for the running CLI.
 */
export function getInstalledPackageMetadata(): InstalledPackageMetadata {
  const packageJsonPath = fileURLToPath(PACKAGE_JSON_URL);
  const packageJsonContent = fs.readFileSync(packageJsonPath, "utf8");
  const packageJson = JSON.parse(packageJsonContent) as Partial<{
    name: string;
    version: string;
  }>;

  if (typeof packageJson.name !== "string") {
    throw new Error("Invalid package metadata: missing package name");
  }

  if (typeof packageJson.version !== "string") {
    throw new Error("Invalid package metadata: missing package version");
  }

  return {
    name: packageJson.name,
    version: packageJson.version,
    packageRoot: path.dirname(packageJsonPath),
  };
}

/**
 * Fetch the latest published version from the npm registry.
 */
export async function getLatestPackageVersion({
  packageName,
}: {
  packageName: string;
}): Promise<string> {
  const response = await fetch(
    `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch latest version: HTTP ${response.status} ${response.statusText}`
    );
  }

  const metadata = (await response.json()) as Partial<NpmLatestMetadata>;
  if (typeof metadata.version !== "string") {
    throw new Error("npm registry response missing version");
  }

  return metadata.version;
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
    const installedPackage = getInstalledPackageMetadata();
    const latestVersion = await getLatestPackageVersion({
      packageName: installedPackage.name,
    });
    const isUpdateAvailable =
      compareVersions({
        leftVersion: installedPackage.version,
        rightVersion: latestVersion,
      }) < 0;

    writeOutput({
      message: formatVersionStatus({
        currentVersion: installedPackage.version,
        latestVersion,
      }),
    });

    if (!isUpdateAvailable) {
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
      packageRoot: installedPackage.packageRoot,
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
      packageName: installedPackage.name,
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
