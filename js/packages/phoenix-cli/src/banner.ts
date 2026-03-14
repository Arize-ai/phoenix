import { loadConfigFromEnvironment } from "./config";

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
  const serverUrl = config.endpoint ?? "http://localhost:6006";
  const project = config.project ?? "not set";

  const infoLines = [`  Server: ${serverUrl}`, `  Project: ${project}`, ""];

  const output = LOGO_LINES.map(
    (logo, index) => `${logo}${infoLines[index] ?? ""}`
  );

  console.log(output.join("\n"));
  console.log();
}
