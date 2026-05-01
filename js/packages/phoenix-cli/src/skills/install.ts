import * as fs from "node:fs";
import * as path from "node:path";

import { ExitCode } from "../exitCodes";
import { getBundledSkillsDir, resolveRepoRootForInstall } from "./manifest";

export type InstallTarget = "agents" | "claude" | "cursor" | "codex";

const TARGET_DIRS: Record<InstallTarget, string> = {
  agents: ".agents/skills",
  claude: ".claude/skills",
  cursor: ".cursor/skills",
  codex: ".codex/skills",
};

export interface InstallResult {
  name: string;
  installedPath: string;
  installedFiles: string[];
}

function collectFiles(directory: string, baseDirectory: string): string[] {
  const result: string[] = [];
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectFiles(fullPath, baseDirectory));
    } else {
      result.push(path.relative(baseDirectory, fullPath));
    }
  }
  return result;
}

export function installSkill(
  name: string,
  target: InstallTarget = "agents"
): InstallResult {
  const bundledSkillsDir = getBundledSkillsDir();
  const sourceDir = path.join(bundledSkillsDir, name);

  if (!fs.existsSync(sourceDir)) {
    const error = new Error(`Bundled skill source not found: ${sourceDir}`);
    (error as NodeJS.ErrnoException).code = String(ExitCode.FAILURE);
    throw error;
  }

  const repoRoot = resolveRepoRootForInstall();
  const targetDir = TARGET_DIRS[target];
  const destinationSkillDir = path.join(repoRoot, targetDir, name);

  const relativeFiles = collectFiles(sourceDir, sourceDir);
  const conflicts: string[] = [];

  for (const relativeFile of relativeFiles) {
    const destinationFile = path.join(destinationSkillDir, relativeFile);
    if (fs.existsSync(destinationFile)) {
      const sourceContent = fs.readFileSync(
        path.join(sourceDir, relativeFile)
      );
      const destinationContent = fs.readFileSync(destinationFile);
      if (!sourceContent.equals(destinationContent)) {
        conflicts.push(relativeFile);
      }
    }
  }

  if (conflicts.length > 0) {
    const error = new Error(
      `Install would overwrite existing files with different content:\n${conflicts.map((f) => `  ${path.join(destinationSkillDir, f)}`).join("\n")}\nRemove them first or edit manually.`
    );
    (error as NodeJS.ErrnoException).code = String(ExitCode.FAILURE);
    throw error;
  }

  fs.mkdirSync(destinationSkillDir, { recursive: true });

  const installedFiles: string[] = [];
  for (const relativeFile of relativeFiles) {
    const sourceFile = path.join(sourceDir, relativeFile);
    const destinationFile = path.join(destinationSkillDir, relativeFile);

    fs.mkdirSync(path.dirname(destinationFile), { recursive: true });
    fs.copyFileSync(sourceFile, destinationFile);
    installedFiles.push(destinationFile);
  }

  const installedSkillMd = path.join(destinationSkillDir, "SKILL.md");

  return {
    name,
    installedPath: installedSkillMd,
    installedFiles,
  };
}
