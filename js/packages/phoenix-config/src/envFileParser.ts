const ENV_FILE_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Parses dotenv-formatted text, retaining only non-empty `PHOENIX_` settings.
 * Supports comments, an optional `export ` prefix, and quoted values.
 */
export function parseEnvFile(
  contents: string
): Partial<Record<string, string>> {
  const values: Partial<Record<string, string>> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    if (line.startsWith("export ")) {
      line = line.slice("export ".length).trimStart();
    }
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    if (!key.startsWith("PHOENIX_") || !ENV_FILE_KEY_PATTERN.test(key)) {
      continue;
    }
    let value = line.slice(separatorIndex + 1).trim();
    const isQuoted =
      value.length >= 2 &&
      value[0] === value[value.length - 1] &&
      (value[0] === '"' || value[0] === "'");
    if (isQuoted) {
      value = value.slice(1, -1);
    }
    if (value) {
      values[key] = value;
    }
  }
  return values;
}
