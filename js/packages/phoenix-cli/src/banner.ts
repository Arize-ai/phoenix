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

  // Align left columns to the same width so the │ separator lines up
  const leftCol = [
    `Server: ${serverUrl}`,
    `API Key: ${apiKey}`,
  ];
  const leftWidth = Math.max(...leftCol.map((line) => line.length));

  const infoLines = [
    `  ${leftCol[0]!.padEnd(leftWidth)}  │  Project: ${project}`,
    `  ${leftCol[1]!.padEnd(leftWidth)}  │  Version: v${VERSION}`,
  ];

  const output = LOGO_LINES.map((logo, index) => {
    const info = infoLines[index - 1];
    return info ? `${logo}${info}` : logo;
  });

  console.log(output.join("\n"));
  console.log();
}
