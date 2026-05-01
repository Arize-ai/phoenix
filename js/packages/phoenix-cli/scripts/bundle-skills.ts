import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(packageRoot, "..", "..", "..");
const sourceSkillsDir = path.join(repoRoot, ".agents", "skills");
const outputSkillsDir = path.join(packageRoot, "skills");
const manifestOutputPath = path.join(outputSkillsDir, "manifest.json");

interface SkillFrontmatter {
  name: string;
  audience: string;
  description?: string;
  version?: string;
}

interface ManifestEntry {
  name: string;
  version: string;
  description: string;
  audience: "user";
  sourceDir: string;
}

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    return {};
  }
  const result: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    const rawValue = line.slice(colonIndex + 1).trim();
    if (key && rawValue && !rawValue.startsWith(">")) {
      result[key] = rawValue.replace(/^["']|["']$/g, "");
    }
  }
  return result;
}

function extractVersion(frontmatter: Record<string, string>): string {
  const version = frontmatter["version"] ?? frontmatter["  version"];
  return version ? version.replace(/^["']|["']$/g, "") : "0.0.0";
}

function extractDescription(frontmatter: Record<string, string>): string {
  return frontmatter["description"] ?? "";
}

function copyDirectoryRecursive(source: string, destination: string): void {
  fs.mkdirSync(destination, { recursive: true });
  const entries = fs.readdirSync(source, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryRecursive(sourcePath, destinationPath);
    } else {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
}

function bundleSkills(): void {
  const skillDirs = fs
    .readdirSync(sourceSkillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("phoenix-"))
    .map((entry) => entry.name);

  const errors: string[] = [];
  const userSkills: Array<{ name: string; frontmatter: Record<string, string> }> = [];
  const skippedCount: { value: number } = { value: 0 };

  for (const skillName of skillDirs) {
    const skillMdPath = path.join(sourceSkillsDir, skillName, "SKILL.md");
    if (!fs.existsSync(skillMdPath)) {
      errors.push(`${skillMdPath}: SKILL.md not found`);
      continue;
    }

    const content = fs.readFileSync(skillMdPath, "utf-8");
    const frontmatter = parseFrontmatter(content);
    const audience = frontmatter["audience"];

    if (!audience) {
      errors.push(`${skillMdPath}: missing 'audience' field in frontmatter`);
      continue;
    }

    if (audience !== "user" && audience !== "maintainer") {
      errors.push(
        `${skillMdPath}: invalid 'audience' value '${audience}' — must be 'user' or 'maintainer'`
      );
      continue;
    }

    if (audience === "maintainer") {
      process.stdout.write(`[bundle-skills] skipping maintainer skill: ${skillName}\n`);
      skippedCount.value++;
      continue;
    }

    userSkills.push({ name: skillName, frontmatter });
  }

  if (errors.length > 0) {
    process.stderr.write(
      `[bundle-skills] ERROR: ${errors.length} skill(s) have missing or invalid 'audience' field:\n`
    );
    for (const error of errors) {
      process.stderr.write(`  ${error}\n`);
    }
    process.exit(1);
  }

  // Clear and recreate output skills directory
  if (fs.existsSync(outputSkillsDir)) {
    fs.rmSync(outputSkillsDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outputSkillsDir, { recursive: true });

  const manifest: ManifestEntry[] = [];

  for (const { name: skillName, frontmatter } of userSkills) {
    const sourceDir = path.join(sourceSkillsDir, skillName);
    const destDir = path.join(outputSkillsDir, skillName);

    copyDirectoryRecursive(sourceDir, destDir);
    process.stdout.write(`[bundle-skills] bundled user skill: ${skillName}\n`);

    manifest.push({
      name: skillName,
      version: extractVersion(frontmatter),
      description: extractDescription(frontmatter),
      audience: "user",
      sourceDir: skillName,
    });
  }

  fs.writeFileSync(manifestOutputPath, JSON.stringify(manifest, null, 2) + "\n");
  process.stdout.write(
    `[bundle-skills] wrote manifest.json with ${manifest.length} skill(s) (skipped ${skippedCount.value} maintainer skill(s))\n`
  );
}

bundleSkills();
