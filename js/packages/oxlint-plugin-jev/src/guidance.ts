/**
 * Loads guidance text from the agent skills bundled into `<package>/skills`
 * at build time (see `scripts/copy-skills.mjs`). Guidance goes into jev's
 * `state` verbatim, so the model judges against what Phoenix actually ships
 * rather than against whatever it learned in training.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface GuidanceRef {
  /** Skill directory name, e.g. `phoenix-tracing`. */
  skill: string;
  /** Path inside the skill, e.g. `references/setup-typescript.md`. */
  file: string;
  /** `##` heading to slice out. Omit for the whole file. */
  section?: string;
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
function skillsRoot(): string {
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

const fileCache = new Map<string, string>();

function readSkillFile(ref: GuidanceRef): string {
  const file = path.join(skillsRoot(), ref.skill, ref.file);
  let text = fileCache.get(file);
  if (text === undefined) {
    text = readFileSync(file, "utf8");
    fileCache.set(file, text);
  }
  return text;
}

/** Slice a `## Heading` section (inclusive of heading, up to the next `## `). */
export function sliceSection(
  markdown: string,
  heading: string
): string | undefined {
  const lines = markdown.split("\n");
  const start = lines.findIndex(
    (l) => /^##\s+/.test(l) && l.replace(/^##\s+/, "").trim() === heading
  );
  if (start === -1) return undefined;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i] ?? "")) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n").trim();
}

export interface LoadedGuidance {
  /** Stable citation shown in lint messages, e.g. `phoenix-tracing/references/setup-typescript.md#Flushing Spans Before Exit`. */
  source: string;
  text: string;
}

export function loadGuidance(ref: GuidanceRef): LoadedGuidance {
  const markdown = readSkillFile(ref);
  const source = `${ref.skill}/${ref.file}${ref.section ? `#${ref.section}` : ""}`;
  if (!ref.section) return { source, text: markdown.trim() };
  const text = sliceSection(markdown, ref.section);
  if (text === undefined) {
    throw new Error(
      `oxlint-plugin-jev: section "${ref.section}" not found in ${source}`
    );
  }
  return { source, text };
}

/** First paragraph after the H1 — used to build compact Choice criteria. */
export function loadSummary(ref: GuidanceRef): LoadedGuidance {
  const markdown = readSkillFile(ref);
  const body = markdown.replace(/^#\s[^\n]*\n/, "").trim();
  const firstParagraph = body.split(/\n\s*\n/)[0] ?? body;
  return { source: `${ref.skill}/${ref.file}`, text: firstParagraph.trim() };
}
