/**
 * Input handling for `px secret`, kept free of Commander and network code so
 * every rule can be unit-tested in isolation.
 *
 * The overriding constraint is that a secret *value* must never appear in
 * argv, in anything the CLI prints, or in an error message. Values are
 * therefore only ever read from stdin, a file, a dotenv file, or the process
 * environment, and every message built here is phrased in terms of the key
 * name or the input position (argument index, line number) — never the
 * offending text itself, since a mistyped "key" is frequently a pasted value.
 */

import * as fs from "fs";

import { InvalidArgumentError } from "../exitCodes";

/**
 * Mirrors the server's `normalize_secret_key` rule
 * (`[A-Za-z_][A-Za-z0-9_]*` after trimming) so an invalid key is rejected
 * before any network call — and before its value is ever read.
 */
const SECRET_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const SECRET_KEY_RULE =
  "keys must start with a letter or underscore and contain only letters, digits, and underscores";

/** The string that stands in for a secret value wherever one might leak. */
export const REDACTED = "[REDACTED]";

/**
 * Sentinel path meaning "read from standard input", following the `-`
 * convention shared by `cat`, `tar`, `kubectl`, and most other CLIs.
 */
export const STDIN_PATH = "-";

/** One entry of a `PUT /v1/secrets` batch. `null` deletes the key. */
export interface SecretEntry {
  key: string;
  value: string | null;
}

/**
 * Validate a secret key and return it trimmed.
 *
 * `source` names where the key came from ("argument 1", "line 3 of
 * secrets.env") so the error is actionable without echoing the rejected text,
 * which may be a secret pasted into the wrong position.
 */
export function validateSecretKey(rawKey: string, source: string): string {
  const key = rawKey.trim();
  if (!key) {
    throw new InvalidArgumentError(`Secret key is empty (${source})`);
  }
  if (key.includes("=")) {
    // `px secret set OPENAI_API_KEY=sk-...` is the most likely way a value
    // ends up in argv. Name only the part before `=`; it is safe to print.
    const keyPart = key.slice(0, key.indexOf("=")).trim() || "<key>";
    throw new InvalidArgumentError(
      `Secret values must not be passed on the command line (${source} looks like '${keyPart}=...'). ` +
        `Pipe the value on stdin or use --value-file instead: ` +
        `printf '%s' "$VALUE" | px secret set ${keyPart}`
    );
  }
  if (!SECRET_KEY_PATTERN.test(key)) {
    throw new InvalidArgumentError(
      `Invalid secret key (${source}): ${SECRET_KEY_RULE}`
    );
  }
  return key;
}

/**
 * Strip exactly one trailing line break. Shells (`echo`), editors, and
 * `printf '%s\n'` all terminate a value with a newline that is not part of
 * the secret, while a value that genuinely ends in several newlines is
 * implausible. The server additionally trims surrounding whitespace.
 */
export function stripTrailingNewline(text: string): string {
  return text.replace(/\r?\n$/, "");
}

/**
 * Drain a readable stream (stdin or a file stream) to a UTF-8 string.
 */
export async function readStreamToString(
  stream: NodeJS.ReadableStream
): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Read a value source — a file path, or `-` for stdin — as text. Errors name
 * the path but never any content.
 */
export async function readValueSource({
  path,
  stdin,
}: {
  path: string;
  stdin: NodeJS.ReadableStream;
}): Promise<string> {
  if (path === STDIN_PATH) {
    return readStreamToString(stdin);
  }
  try {
    return fs.readFileSync(path, "utf8");
  } catch (error) {
    const code =
      error instanceof Error && "code" in error
        ? ` (${String((error as NodeJS.ErrnoException).code)})`
        : "";
    throw new InvalidArgumentError(`Could not read file '${path}'${code}`);
  }
}

/**
 * Parse a dotenv-style document into upsert entries.
 *
 * Supported: blank lines, `#` comments, an optional `export ` prefix, and
 * values wrapped in matching single or double quotes. Deliberately not
 * supported (so a value is stored exactly as written): variable
 * interpolation, escape sequences, and multi-line values.
 *
 * Every line that is not blank or a comment must be `KEY=value` with a valid
 * key and a non-empty value; anything else is an `INVALID_ARGUMENT` that
 * names the line number only.
 */
export function parseSecretEnvFile(
  contents: string,
  sourceName: string
): SecretEntry[] {
  const entries: SecretEntry[] = [];
  const lines = contents.split(/\r?\n/);
  for (const [index, rawLine] of lines.entries()) {
    const lineNumber = index + 1;
    const where = `line ${lineNumber} of ${sourceName}`;
    let line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    if (line.startsWith("export ")) {
      line = line.slice("export ".length).trimStart();
    }
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      throw new InvalidArgumentError(
        `Expected KEY=value on ${where} (values themselves are never shown)`
      );
    }
    const key = validateSecretKey(line.slice(0, separatorIndex), where);
    let value = line.slice(separatorIndex + 1).trim();
    const isQuoted =
      value.length >= 2 &&
      value[0] === value[value.length - 1] &&
      (value[0] === '"' || value[0] === "'");
    if (isQuoted) {
      value = value.slice(1, -1);
    }
    if (!value) {
      throw new InvalidArgumentError(
        `Secret value for ${key} is empty (${where}). To delete a secret use: px secret delete ${key}`
      );
    }
    entries.push({ key, value });
  }
  return entries;
}

/**
 * Collapse a batch so each key appears once, keeping the *last* occurrence —
 * the same rule the server applies — so the keys the CLI reports match the
 * keys the server acts on, in first-seen order.
 */
export function mergeSecretEntries(entries: SecretEntry[]): SecretEntry[] {
  const byKey = new Map<string, SecretEntry>();
  for (const entry of entries) {
    byKey.set(entry.key, entry);
  }
  return [...byKey.values()];
}

/**
 * Replace every occurrence of any submitted value in `text` with
 * {@link REDACTED}. This is the last line of defence for error text that
 * originates outside the CLI (a transport error, a stack, a server body a
 * future change might surface); the primary defence is never putting values
 * in messages in the first place. Longer values are replaced first so a
 * value that is a substring of another cannot leave a fragment behind.
 */
export function redactSecretValues(
  text: string,
  values: Iterable<string | null | undefined>
): string {
  const distinct = [...new Set(values)].filter(
    (value): value is string => typeof value === "string" && value.length > 0
  );
  distinct.sort((a, b) => b.length - a.length);
  let redacted = text;
  for (const value of distinct) {
    redacted = redacted.split(value).join(REDACTED);
  }
  return redacted;
}
