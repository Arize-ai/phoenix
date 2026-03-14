import { loadConfigFromEnvironment } from "./config";
import { writeOutput } from "./io";

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
    `  Server:  ${serverUrl}`,
    `  Project: ${project}`,
    ...(config.apiKey ? [`  API Key: set`] : []),
  ];

  const output = LOGO_LINES.map((logo, index) => {
    const info = infoLines[index];
    return info ? `${logo}${info}` : logo;
  });

  writeOutput({ message: output.join("\n") });
  writeOutput({ message: "" });
}
