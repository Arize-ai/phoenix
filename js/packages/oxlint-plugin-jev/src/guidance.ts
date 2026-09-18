/**
 * Loads guidance text from the agent skills bundled into `<package>/skills`
 * at build time (see `scripts/copy-skills.mjs`). Guidance goes into jev's
 * `state` verbatim, so the model judges against what Phoenix actually ships
 * rather than against whatever it learned in training.
 *
 * Whole files only. The single coupling to the skills is the file path,
 * which `verifyGuidance` checks at build time; nothing inside the markdown
 * is parsed or interpreted by code.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface GuidanceRef {
  /** Skill directory name, e.g. `phoenix-tracing`. */
  skill: string;
  /** Path inside the skill, e.g. `references/setup-typescript.md`. */
  file: string;
}

const here = path.dirname(fileURLToPath(import.meta.url));

function candidateSkillRoots(): string[] {
  const roots: string[] = [];
  if (process.env.OXLINT_JEV_SKILLS_DIR)
    roots.push(process.env.OXLINT_JEV_SKILLS_DIR);
  // Built layout: <package>/dist/guidance.js -> <package>/skills
  roots.push(path.resolve(here, "..", "skills"));
  // Dev fallback inside the Phoenix monorepo: js/packages/<pkg> -> repo root
  roots.push(path.resolve(here, "..", "..", "..", "..", ".agents", "skills"));
  return roots;
}

let resolvedRoot: string | undefined;
export function skillsRoot(): string {
  if (resolvedRoot) return resolvedRoot;
  for (const root of candidateSkillRoots()) {
    if (existsSync(root)) {
      resolvedRoot = root;
      return root;
    }
  }
  throw new Error(
    `oxlint-plugin-jev: no bundled skills directory found (looked in ${candidateSkillRoots().join(", ")}). Run the package build.`
  );
}

export function guidancePath(ref: GuidanceRef): string {
  return path.join(skillsRoot(), ref.skill, ref.file);
}

/** Stable citation shown in lint messages, e.g. `phoenix-tracing/references/setup-typescript.md`. */
export function guidanceSource(ref: GuidanceRef): string {
  return `${ref.skill}/${ref.file}`;
}

export interface LoadedGuidance {
  source: string;
  text: string;
}

const fileCache = new Map<string, string>();

export function loadGuidance(ref: GuidanceRef): LoadedGuidance {
  const file = guidancePath(ref);
  let text = fileCache.get(file);
  if (text === undefined) {
    text = readFileSync(file, "utf8").trim();
    fileCache.set(file, text);
  }
  return { source: guidanceSource(ref), text };
}
