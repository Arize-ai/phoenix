/**
 * Client-side parser for server-issued `RedactedString` values.
 *
 * Server wire format (see `src/phoenix/server/redaction.py`):
 *   <DELIM>REDACTED<DELIM><preview><DELIM><fernet-token>
 * where `<DELIM>` is U+E000 (Private Use Area) and `<preview>` is the last
 * few plaintext characters (or empty if the plaintext was too short).
 *
 * If the wire format changes on the server, update this file too.
 */

const DELIM = "\ue000";
const MARKER = "REDACTED";
const WIRE_PREFIX = `${DELIM}${MARKER}${DELIM}`;

/** True if `value` is a server-issued redacted token. */
export function isRedacted(value: string | null | undefined): value is string {
  return typeof value === "string" && value.startsWith(WIRE_PREFIX);
}

/**
 * Extract the preview (trailing chars of the plaintext) from a redacted token.
 * Returns null if `value` is not redacted or carries no preview.
 */
export function previewOf(value: string | null | undefined): string | null {
  if (!isRedacted(value)) return null;
  const rest = value.slice(WIRE_PREFIX.length);
  const i = rest.indexOf(DELIM);
  if (i < 0) return null;
  const preview = rest.slice(0, i);
  return preview || null;
}

/**
 * Human-readable mask like `••••xyz9` for use in UI hints. Returns null when
 * the value is not a redacted token.
 */
export function redactedPreviewText(
  value: string | null | undefined
): string | null {
  if (!isRedacted(value)) return null;
  const preview = previewOf(value);
  return preview ? `••••${preview}` : "••••••••";
}
