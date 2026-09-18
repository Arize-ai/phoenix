/**
 * Copies the guidance this plugin cites from the repo's agent skills into
 * `<package>/skills` so the published package is self-contained (symlinks do
 * not survive `npm pack`). Writes a manifest with the source commit so a
 * finding can always be traced back to the exact skill text it was judged
 * against.
 */
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const repoRoot = path.resolve(pkgRoot, "..", "..", "..");
const target = path.join(pkgRoot, "skills");

/** skill directory -> file globs (relative to the skill) to bundle */
const BUNDLE = {
  "phoenix-tracing": [
    /^SKILL\.md$/,
    /^references\/.*-typescript\.md$/,
    /^references\/span-.*\.md$/,
    /^references\/fundamentals-.*\.md$/,
  ],
};

function walk(dir, prefix = "") {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(path.join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out;
}

rmSync(target, { recursive: true, force: true });
const copied = [];
for (const [skill, patterns] of Object.entries(BUNDLE)) {
  const sourceDir = path.join(repoRoot, ".agents", "skills", skill);
  if (!existsSync(sourceDir)) {
    throw new Error(
      `copy-skills: ${sourceDir} not found; build must run inside the Phoenix repo`
    );
  }
  for (const rel of walk(sourceDir)) {
    if (!patterns.some((p) => p.test(rel))) continue;
    const dest = path.join(target, skill, rel);
    mkdirSync(path.dirname(dest), { recursive: true });
    copyFileSync(path.join(sourceDir, rel), dest);
    copied.push(`${skill}/${rel}`);
  }
}

let commit = "unknown";
try {
  commit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
} catch {}

writeFileSync(
  path.join(target, "manifest.json"),
  JSON.stringify(
    {
      sourceCommit: commit,
      copiedAt: new Date().toISOString(),
      files: copied.sort(),
    },
    null,
    2
  )
);
console.log(
  `copy-skills: bundled ${copied.length} file(s) from ${commit.slice(0, 10)}`
);
