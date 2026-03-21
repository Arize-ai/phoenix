import { loadConfigFromEnvironment } from "./config";
import { writeOutput } from "./io";
import { getCliVersionStatus } from "./version";

const LOGO_LINES = [
  "░█▀█░█░█░█▀█░█▀▀░█▀█░▀█▀░█░█",
  "░█▀▀░█▀█░█░█░█▀▀░█░█░░█░░▄▀▄",
  "░▀░░░▀░▀░▀▀▀░▀▀▀░▀░▀░▀▀▀░▀░▀",
];
const TAGLINE = "CLI for interacting with your phoenix server";

/**
 * Text shown below the Phoenix logo.
 */
export interface BannerInfoLinesOptions {
  serverUrl: string;
  project: string;
  hasApiKey: boolean;
  currentVersion: string;
  latestVersion?: string;
  hasUpdate?: boolean;
}

/**
 * Build the informational text displayed below the Phoenix logo.
 */
export function getBannerInfoLines({
  serverUrl,
  project,
  hasApiKey,
  currentVersion,
  latestVersion,
  hasUpdate,
}: BannerInfoLinesOptions): string[] {
  return [
    `Server:  ${serverUrl}`,
    `Project: ${project}`,
    ...(hasApiKey ? [`API Key: set`] : []),
    `Version: v${currentVersion}`,
    ...(hasUpdate && latestVersion
      ? [`Update:  v${latestVersion} available. Run px self update`]
      : []),
  ];
}

/**
 * Render the full banner with the logo first and metadata below it.
 */
export function renderBanner({ infoLines }: { infoLines: string[] }): string {
  return [...LOGO_LINES, "", TAGLINE, "", ...infoLines].join("\n");
}

/**
 * Print the Phoenix CLI banner with connection and update info aligned to the right of the logo.
 */
export async function printBanner(): Promise<void> {
  const config = loadConfigFromEnvironment();
  const versionStatus = await getCliVersionStatus();
  const infoLines = getBannerInfoLines({
    serverUrl: config.endpoint ?? "not set",
    project: config.project ?? "not set",
    hasApiKey: Boolean(config.apiKey),
    currentVersion: versionStatus.currentVersion,
    latestVersion: versionStatus.latestVersion,
    hasUpdate: versionStatus.hasUpdate,
  });

  writeOutput({ message: renderBanner({ infoLines }) });
  writeOutput({ message: "" });
}
