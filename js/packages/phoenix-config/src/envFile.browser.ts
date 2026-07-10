/** Browser-safe no-op implementation of Node-only credential-file discovery. */

export {
  ENV_PHOENIX_DISCOVER_CONFIG,
  parseEnvFile,
  PHOENIX_ENV_FILE_NAME,
} from "./envFileParser";

export function findEnvFile(): undefined {
  return undefined;
}

export function readEnvFileValue(): undefined {
  return undefined;
}

export function clearEnvFileCache(): void {}
