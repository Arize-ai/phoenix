/** Browser-safe no-op implementation of Node-only credential-file discovery. */

export {
  ENV_PHOENIX_DISCOVER_CONFIG,
  parseEnvFile,
  PHOENIX_ENV_FILE_NAME,
} from "./envFileParser";

export interface EnvFileValue {
  filePath: string;
  value: string;
}

export function findEnvFile(
  _options: { startDir?: string } = {}
): string | undefined {
  return undefined;
}

export function readEnvFileValue(_envKey: string): string | undefined {
  return undefined;
}

export function readEnvFileValueWithPath(
  _envKey: string
): EnvFileValue | undefined {
  return undefined;
}

export function clearEnvFileCache(): void {}
