import { loadConfigFromEnvironment } from "./config";
import { writeOutput } from "./io";
import { getCliVersionStatus } from "./version";

const LOGO_LINES = [
  "░█▀█░█░█░█▀█░█▀▀░█▀█░▀█▀░█░█",
  "░█▀▀░█▀█░█░█░█▀▀░█░█░░█░░▄▀▄",
  "░▀░░░▀░▀░▀▀▀░▀▀▀░▀░▀░▀▀▀░▀░▀",
];

/**
 * Text shown to the right of the Phoenix logo.
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
 * Build the informational text displayed next to the Phoenix logo.
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
    `  Server:  ${serverUrl}`,
    `  Project: ${project}`,
    ...(hasApiKey ? [`  API Key: set`] : []),
    `  CLI:     v${currentVersion}`,
    ...(latestVersion
      ? [
          hasUpdate
            ? `  Update:  v${latestVersion} available. Run npm install -g @arizeai/phoenix-cli`
            : "  Update:  up to date",
        ]
      : []),
  ];
}

/**
 * Render the full banner, allowing info lines to extend past the logo height.
 */
export function renderBanner({ infoLines }: { infoLines: string[] }): string {
  const logoWidth = LOGO_LINES[0]?.length ?? 0;
  const paddedLogo = " ".repeat(logoWidth);
  const lineCount = Math.max(LOGO_LINES.length, infoLines.length);

  const output = Array.from({ length: lineCount }, (_, index) => {
    const logo = LOGO_LINES[index] ?? paddedLogo;
    const info = infoLines[index];
    return info ? `${logo}${info}` : logo;
  });

  return output.join("\n");
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
