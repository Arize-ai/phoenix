import { formatTable } from "./formatTable";

export type OutputFormat = "pretty" | "json" | "raw";

export type ProfileListEntry = {
  name: string;
  endpoint?: string;
  project?: string;
  active: boolean;
};

export interface FormatProfilesOutputOptions {
  /**
   * Profiles to format. Pass a single entry for mutating commands (create,
   * edit, use, delete) and show; pass an array for list.
   */
  profiles: ProfileListEntry | ProfileListEntry[];
  /**
   * Output format. Defaults to `"pretty"`.
   */
  format?: OutputFormat;
}

export function formatProfilesOutput({
  profiles,
  format,
}: FormatProfilesOutputOptions): string {
  const list = Array.isArray(profiles) ? profiles : [profiles];
  const selected = format || "pretty";
  if (selected === "raw") {
    return list.map((p) => JSON.stringify(p)).join("\n");
  }
  if (selected === "json") {
    return Array.isArray(profiles)
      ? JSON.stringify({ profiles: list }, null, 2)
      : JSON.stringify(list[0], null, 2);
  }
  return formatProfilesPretty(list);
}

function formatProfilesPretty(profiles: ProfileListEntry[]): string {
  if (profiles.length === 0) {
    return "No profiles found";
  }

  const rows = profiles.map((p) => ({
    " ": p.active ? "*" : "",
    name: p.name,
    endpoint: p.endpoint ?? "",
    project: p.project ?? "",
  }));

  return formatTable(rows);
}
