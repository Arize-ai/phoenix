import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

export type SkillStatus = "installed" | "available" | "missing-source";

export interface Skill {
  name: string;
  version: string;
  description: string;
  audience: "user";
  sourceDir: string;
}

export interface SkillRecord {
  name: string;
  version: string;
  description: string;
  status: SkillStatus;
  installedPath: string | null;
  bundledPath: string | null;
  installCommand: string;
}

const HARNESS_SKILL_DIRS = [
  ".agents/skills",
  ".claude/skills",
  ".cursor/skills",
  ".codex/skills",
] as const;

const PACKAGE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

const BUNDLED_SKILLS_DIR = path.join(PACKAGE_ROOT, "skills");
const MANIFEST_PATH = path.join(BUNDLED_SKILLS_DIR, "manifest.json");

function resolveRepoRoot(): string {
  const home = os.homedir();
  let current = process.cwd();

  while (true) {
    if (
      fs.existsSync(path.join(current, ".git")) ||
      fs.existsSync(path.join(current, "package.json"))
    ) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current || current === home) {
      return process.cwd();
    }
    current = parent;
  }
}

function findInstalledSkill(
  skillName: string,
  repoRoot: string
): string | null {
  for (const harnessDir of HARNESS_SKILL_DIRS) {
    const candidate = path.join(repoRoot, harnessDir, skillName, "SKILL.md");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function readManifest(): SkillRecord[] {
  if (!fs.existsSync(MANIFEST_PATH)) {
    return [];
  }

  let skills: Skill[];
  try {
    const raw = fs.readFileSync(MANIFEST_PATH, "utf-8");
    skills = JSON.parse(raw) as Skill[];
  } catch {
    return [];
  }

  const repoRoot = resolveRepoRoot();

  return skills.map((skill): SkillRecord => {
    const bundledSkillDir = path.join(BUNDLED_SKILLS_DIR, skill.sourceDir);
    const bundledSkillMd = path.join(bundledSkillDir, "SKILL.md");
    const bundledPath = fs.existsSync(bundledSkillMd) ? bundledSkillMd : null;

    const installedPath = findInstalledSkill(skill.name, repoRoot);

    let status: SkillStatus;
    if (bundledPath === null) {
      status = "missing-source";
    } else if (installedPath !== null) {
      status = "installed";
    } else {
      status = "available";
    }

    return {
      name: skill.name,
      version: skill.version,
      description: skill.description,
      status,
      installedPath,
      bundledPath,
      installCommand: `px skill install ${skill.name}`,
    };
  });
}

export function getBundledSkillsDir(): string {
  return BUNDLED_SKILLS_DIR;
}

export function resolveRepoRootForInstall(): string {
  return resolveRepoRoot();
}
