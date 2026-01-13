export type OutputFormat = "pretty" | "json" | "raw";

type ProjectLike = {
  id: string;
  name: string;
  description?: string | null;
};

export interface FormatProjectsOutputOptions {
  /**
   * Projects to format.
   */
  projects: ProjectLike[];
  /**
   * Output format. Defaults to `"pretty"`.
   */
  format?: OutputFormat;
}

export function formatProjectsOutput({
  projects,
  format,
}: FormatProjectsOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    return JSON.stringify(projects);
  }
  if (selected === "json") {
    return JSON.stringify(projects, null, 2);
  }

  const lines: string[] = [];
  lines.push("Projects:");
  for (const p of projects) {
    const desc =
      p.description === null ||
      p.description === undefined ||
      p.description === ""
        ? ""
        : ` — ${p.description}`;
    lines.push(`- ${p.name} (${p.id})${desc}`);
  }
  return lines.join("\n");
}
