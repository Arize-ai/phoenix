import { loadConfigFromEnvironment } from "./config";
import { VERSION } from "./version";

const LOGO_LINES = [
  "░█▀█░█░█░█▀█░█▀▀░█▀█░▀█▀░█░█",
  "░█▀▀░█▀█░█░█░█▀▀░█░█░░█░░▄▀▄",
  "░▀░░░▀░▀░▀▀▀░▀▀▀░▀░▀░▀▀▀░▀░▀",
];

/**
 * Print the Phoenix CLI banner with connection info aligned to the right of the logo.
 */
export function printBanner(): void {
  const config = loadConfigFromEnvironment();
  const serverUrl = config.endpoint ?? "not set";
  const project = config.project ?? "not set";

  const apiKey = config.apiKey ? "set" : "not set";

  const infoLines = [
    `  v${VERSION}`,
    `  Server: ${serverUrl}`,
    `  Project: ${project}`,
    `  API Key: ${apiKey}`,
  ];

  const logoWidth = LOGO_LINES[0]!.length;
  const output = infoLines.map(
    (info, index) => `${(LOGO_LINES[index] ?? "").padEnd(logoWidth)}${info}`
  );

  console.log(output.join("\n"));
  console.log();
}
