import { formatTable } from "./formatTable";

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

  const rows = projects.map((p) => ({
    name: p.name,
    id: p.id,
    description: p.description ?? "",
  }));

  return formatTable(rows);
}
