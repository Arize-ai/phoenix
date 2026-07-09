/** Browser-safe no-op implementation of Node-only credential-file discovery. */

export { parseEnvFile } from "./envFileParser";

export const PHOENIX_ENV_FILE_NAME = ".env.phoenix";
export const ENV_PHOENIX_DISCOVER_CONFIG = "PHOENIX_DISCOVER_CONFIG";

export function findEnvFile(): undefined {
  return undefined;
}

export function readEnvFileValue(): undefined {
  return undefined;
}

export function resetEnvFilePermissionWarningsForTesting(): void {}
