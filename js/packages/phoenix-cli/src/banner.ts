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

  const infoLines = [
    `  v${VERSION}`,
    `  Server: ${serverUrl}`,
    `  Project: ${project}`,
  ];

  const output = LOGO_LINES.map(
    (logo, index) => `${logo}${infoLines[index] ?? ""}`
  );

  console.log(output.join("\n"));
  console.log();
}
