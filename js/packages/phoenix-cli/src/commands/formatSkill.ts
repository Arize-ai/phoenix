import type { InstallResult } from "../skills/install";
import type { SkillRecord } from "../skills/manifest";
import { formatTable } from "./formatTable";

export type OutputFormat = "pretty" | "json" | "raw";

const ADVISORY_MARKER_TEMPLATE = (name: string) =>
  `<!-- advisory: this skill is not loaded; install with: px skill install ${name} -->`;

export interface FormatSkillListOptions {
  skills: SkillRecord[];
  format: OutputFormat;
  all: boolean;
}

export function formatSkillList({
  skills,
  format,
  all,
}: FormatSkillListOptions): string {
  if (format === "raw" || format === "json") {
    const output = JSON.stringify(skills);
    return format === "json" ? JSON.stringify(skills, null, 2) : output;
  }

  // pretty mode: show only installed by default; --all shows everything
  const visibleSkills = all
    ? skills
    : skills.filter((s) => s.status === "installed");

  const hiddenCount = skills.filter((s) => s.status !== "installed").length;

  if (visibleSkills.length === 0 && !all) {
    const footerLine =
      hiddenCount > 0
        ? `(${hiddenCount} available — px skill list --all)`
        : "No skills installed.";
    return footerLine;
  }

  const rows = visibleSkills.map((skill) => ({
    name: skill.name,
    version: skill.version,
    status: skill.status,
    description:
      skill.description.length > 60
        ? skill.description.slice(0, 57) + "..."
        : skill.description,
  }));

  const table = formatTable(rows);

  if (!all && hiddenCount > 0) {
    return table + `\n(${hiddenCount} more available — px skill list --all)`;
  }

  return table;
}

export interface FormatSkillShowOptions {
  skill: SkillRecord;
  content: string;
  format: OutputFormat;
}

export function formatSkillShow({
  skill,
  content,
  format,
}: FormatSkillShowOptions): string {
  const advisoryMarker = ADVISORY_MARKER_TEMPLATE(skill.name);
  const fullContent = `${advisoryMarker}\n\n${content}`;

  if (format === "pretty") {
    return fullContent;
  }

  const output = {
    name: skill.name,
    status: skill.status,
    advisory: true,
    advisoryMarker,
    content: fullContent,
  };

  return format === "json"
    ? JSON.stringify(output, null, 2)
    : JSON.stringify(output);
}

export interface FormatSkillInstallOptions {
  result: InstallResult;
  version: string;
  format: OutputFormat;
}

export function formatSkillInstall({
  result,
  version,
  format,
}: FormatSkillInstallOptions): string {
  if (format === "pretty") {
    return `Installed skill '${result.name}' to ${result.installedPath}`;
  }

  const output = {
    name: result.name,
    version,
    installedPath: result.installedPath,
    installedFiles: result.installedFiles,
  };

  return format === "json"
    ? JSON.stringify(output, null, 2)
    : JSON.stringify(output);
}
