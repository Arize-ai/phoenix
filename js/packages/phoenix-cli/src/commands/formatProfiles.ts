import { formatTable } from "./formatTable";

export type OutputFormat = "pretty" | "json" | "raw";

/**
 * Fixed-length mask used in JSON / raw output wherever a CLI command
 * surfaces the presence of an API key. Matches the masking used by
 * `auth status` so machine-readable output is consistent across commands.
 */
export const API_KEY_MASK = "************************************";

/**
 * Compact presence marker used in the `auth` column of the pretty table.
 * The full 36-char mask would dominate the row width; a short marker is
 * enough to answer "is this profile authenticated?" at a glance.
 */
const AUTH_PRESENT_MARKER = "***";

export type ProfileListEntry = {
  name: string;
  endpoint?: string;
  project?: string;
  /**
   * Whether this profile has an API key configured. The actual key is never
   * surfaced through CLI output — only the on-disk settings file (mode 0600)
   * stores the raw value.
   */
  hasApiKey?: boolean;
  /**
   * Custom HTTP headers configured on this profile. Passed through to
   * `--format json|raw` output verbatim because headers are user
   * configuration (e.g. `X-Tenant`, `X-Region`), not credentials. If you
   * use a header to carry an auth token, it will appear unmasked here —
   * the recommended way to set a Phoenix API key is `--api-key`, which is
   * masked everywhere.
   */
  headers?: Record<string, string>;
  active: boolean;
};

export interface FormatProfilesOutputOptions {
  /**
   * Profiles to format. Pass a single entry for `show`; pass an array for `list`.
   */
  profiles: ProfileListEntry | ProfileListEntry[];
  /**
   * Output format. Defaults to `"pretty"`.
   */
  format?: OutputFormat;
}

interface JsonProfileEntry {
  name: string;
  endpoint?: string;
  project?: string;
  apiKey?: string;
  headers?: Record<string, string>;
  active: boolean;
}

function toJsonEntry(entry: ProfileListEntry): JsonProfileEntry {
  const out: JsonProfileEntry = { name: entry.name, active: entry.active };
  if (entry.endpoint !== undefined) out.endpoint = entry.endpoint;
  if (entry.project !== undefined) out.project = entry.project;
  if (entry.hasApiKey) out.apiKey = API_KEY_MASK;
  if (entry.headers !== undefined && Object.keys(entry.headers).length > 0) {
    out.headers = entry.headers;
  }
  return out;
}

export function formatProfilesOutput({
  profiles,
  format,
}: FormatProfilesOutputOptions): string {
  const list = Array.isArray(profiles) ? profiles : [profiles];
  const selected = format || "pretty";
  if (selected === "raw") {
    return list.map((p) => JSON.stringify(toJsonEntry(p))).join("\n");
  }
  if (selected === "json") {
    return Array.isArray(profiles)
      ? JSON.stringify({ profiles: list.map(toJsonEntry) }, null, 2)
      : JSON.stringify(toJsonEntry(list[0]), null, 2);
  }
  return formatProfilesPretty(list);
}

function formatProfilesPretty(profiles: ProfileListEntry[]): string {
  if (profiles.length === 0) {
    return "No profiles found";
  }

  const rows = profiles.map((p) => ({
    current: p.active ? "*" : "",
    name: p.name,
    endpoint: p.endpoint ?? "",
    project: p.project ?? "",
    auth: p.hasApiKey ? AUTH_PRESENT_MARKER : "",
  }));

  return formatTable(rows);
}
