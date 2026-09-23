#!/usr/bin/env tsx
/**
 * Lints the Phoenix Storybook story set against the taxonomy.
 *
 * Stories have no other automated verification — Chromatic was removed in
 * PR #14321, no workflow builds Storybook, and although `@storybook/addon-vitest`
 * is a dependency, no vitest project runs stories. So this is the only
 * mechanical guard on the story set and it carries more weight than a lint
 * rule normally would.
 *
 * Run: `pnpm lint:stories`
 *
 * @see app/stories/_meta/taxonomy.ts
 * @see app/stories/_meta/tags.ts
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import {
  ALL_PHOENIX_TAGS,
  completeness,
  provenance,
  review,
  STORYBOOK_BUILTIN_TAGS,
} from "../stories/_meta/tags";
import {
  STORYBOOK_PAGES,
  allowedSecondSegments,
  DESIGN_SYSTEM_SUBJECTS,
  DOMAIN_SURFACES,
  expectedDirForTitle,
  leafOfTitle,
  nameKey,
  ROOTS,
} from "../stories/_meta/taxonomy";
import {
  THUMBNAIL_REQUIRED_TAGS,
  THUMBNAIL_STORY_NAME,
  THUMBNAIL_THEMES,
  pngSize,
  thumbnailPixelSize,
} from "../stories/_meta/thumbnail";

const STORIES_DIR = "stories";
const PREVIEW_FILE = join(".storybook", "preview.tsx");
const HEALTH_FILE = join(STORIES_DIR, "_meta", "health.generated.json");

type StoryFile = {
  /** Path relative to `stories/`. */
  rel: string;
  dir: string;
  base: string;
  title: string | null;
  /** An MDX page's `<Meta name>`, which Storybook uses as its entry name. */
  metaName: string | null;
  /** True for MDX attached to a CSF file via `<Meta of={...} />`. */
  attachedMdx: boolean;
  tags: string[];
  /** True for a file sitting directly in `stories/`, outside the taxonomy. */
  isFlat: boolean;
};

const problems: string[] = [];
const fail = (file: string, message: string) =>
  problems.push(`${file}: ${message}`);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (/\.stories\.[jt]sx?$/.test(entry) || entry.endsWith(".mdx")) {
      out.push(full);
    }
  }
  return out;
}

function parseTitle(src: string, isMdx: boolean): string | null {
  if (isMdx) {
    const m = src.match(/<Meta[^>]*\stitle=["']([^"']+)["']/);
    return m ? m[1] : null;
  }
  const m = src.match(/^\s{0,2}title:\s*["'`]([^"'`]+)["'`]/m);
  return m ? m[1] : null;
}

function parseMetaName(src: string): string | null {
  const m = src.match(/<Meta[^>]*\sname=["']([^"']+)["']/);
  return m ? m[1] : null;
}

function parseTags(src: string): string[] {
  const m = src.match(/^\s{0,2}tags:\s*\[([^\]]*)\]/m);
  if (!m) return [];
  return [...m[1].matchAll(/["'`]([^"'`]+)["'`]/g)].map((x) => x[1]);
}

function collect(): StoryFile[] {
  return walk(STORIES_DIR).map((full) => {
    const rel = relative(STORIES_DIR, full);
    const src = readFileSync(full, "utf8");
    const isMdx = full.endsWith(".mdx");
    const segments = rel.split("/");
    const base = segments[segments.length - 1];
    return {
      rel,
      dir: segments.slice(0, -1).join("/"),
      base,
      title: parseTitle(src, isMdx),
      metaName: isMdx ? parseMetaName(src) : null,
      attachedMdx: isMdx && /<Meta[^>]*\sof=\{/.test(src),
      tags: parseTags(src),
      isFlat: segments.length === 1,
    };
  });
}

/**
 * The names mentioned in `options.storySort.order` in `.storybook/preview.tsx`.
 *
 * Read by parsing the file rather than importing the value, because Storybook
 * requires `storySort` to be an inline literal — it statically parses
 * preview.tsx and rejects an imported identifier with
 * "Unexpected '<identifier>'". Parsing here means a hand-edit to preview.tsx
 * that disagrees with the taxonomy is caught, which importing a shared
 * constant could never do.
 */
function sortOrderNames(): Set<string> {
  const src = readFileSync(PREVIEW_FILE, "utf8");
  const start = src.indexOf("storySort:");
  if (start === -1) {
    fail(PREVIEW_FILE, "no `storySort:` found — the sidebar order is missing");
    return new Set();
  }
  const open = src.indexOf("[", start);
  let depth = 0;
  let end = open;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === "[") depth += 1;
    if (src[i] === "]") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = src.slice(open, end + 1);
  return new Set([...body.matchAll(/["']([^"']+)["']/g)].map((m) => m[1]));
}

/** Every section the taxonomy defines must appear in the sidebar order. */
function checkSortOrderCoversTaxonomy(ordered: Set<string>) {
  const required = [
    ...ROOTS,
    ...STORYBOOK_PAGES,
    ...DESIGN_SYSTEM_SUBJECTS,
    ...DOMAIN_SURFACES,
  ];
  for (const name of required) {
    if (!ordered.has(name)) {
      fail(
        PREVIEW_FILE,
        `"${name}" is defined in stories/_meta/taxonomy.ts but missing from options.storySort.order`
      );
    }
  }
}

function checkPathAndTitle(file: StoryFile) {
  if (!file.title) {
    if (!file.attachedMdx) {
      fail(
        file.rel,
        "no `title` found, and it is not MDX attached with `of={}`"
      );
    }
    return;
  }
  const segments = file.title.split("/").map((s) => s.trim());
  const root = segments[0];
  if (!ROOTS.includes(root as never)) {
    fail(file.rel, `title root "${root}" is not one of ${ROOTS.join(", ")}`);
    return;
  }
  const allowed = allowedSecondSegments(root);
  if (allowed && segments.length > 1 && !allowed.includes(segments[1])) {
    fail(
      file.rel,
      `"${segments[1]}" is not a known ${root} section. Add it to taxonomy.ts, or move the story`
    );
  }
  const expectedDir = expectedDirForTitle(file.title);
  if (file.dir !== expectedDir) {
    fail(
      file.rel,
      `title "${file.title}" expects directory "${expectedDir}", found "${file.dir || "(root)"}"`
    );
  }
  const expectedName = nameKey(leafOfTitle(file.title));
  const actualName = nameKey(
    file.base.replace(/\.(stories\.[jt]sx?|mdx)$/, "")
  );
  if (expectedName !== actualName) {
    fail(
      file.rel,
      `title ends in "${leafOfTitle(file.title)}" but the file is named "${file.base}"`
    );
  }
}

/**
 * A subject's `Overview` page must be named after its subject. Without a
 * name Storybook calls it "Docs", which is what search lists it as, and the
 * sidebar's Overview folders (`.storybook/sidebar/subjectOverviews.ts`) derive
 * the page's id from the folder name.
 */
function checkOverviewName(file: StoryFile) {
  if (file.base !== "Overview.mdx" || !file.title) return;
  const segments = file.title.split("/").map((s) => s.trim());
  const subject = segments[segments.length - 2];
  if (file.metaName !== subject) {
    fail(
      file.rel,
      `an Overview page must be named after its subject: add name="${subject}" to its <Meta>`
    );
  }
}

function checkTags(file: StoryFile) {
  const known = new Set<string>([
    ...ALL_PHOENIX_TAGS,
    ...STORYBOOK_BUILTIN_TAGS,
  ]);
  for (const tag of file.tags) {
    if (!known.has(tag)) {
      fail(
        file.rel,
        `unknown tag "${tag}". Phoenix tags live in stories/_meta/tags.ts; fixture data belongs in component props, not Storybook tags`
      );
    }
  }
  if (file.tags.includes("autodocs")) {
    fail(
      file.rel,
      "`autodocs` is already set globally in .storybook/preview.tsx; remove it here"
    );
  }

  const axis = (values: readonly string[]) =>
    file.tags.filter((t) => values.includes(t));

  const prov = axis(Object.values(provenance));
  const rev = axis(Object.values(review));
  const comp = axis(Object.values(completeness));

  if (prov.length !== 1) {
    fail(
      file.rel,
      prov.length === 0
        ? `missing a provenance tag (one of ${Object.values(provenance).join(" | ")})`
        : `provenance is contradictory: ${prov.join(" and ")}`
    );
  }
  if (rev.length !== 1) {
    fail(
      file.rel,
      rev.length === 0
        ? `missing a review tag (one of ${Object.values(review).join(" | ")})`
        : `review is contradictory: ${rev.join(" and ")}`
    );
  }
  if (comp.length > 1) {
    fail(file.rel, `completeness is contradictory: ${comp.join(" and ")}`);
  }
  // `incomplete` asserts someone compared the stories against the component,
  // so it is required only where that comparison has happened.
  if (prov[0] === provenance.updated && comp.length === 0) {
    fail(
      file.rel,
      `updated stories must declare completeness (${Object.values(completeness).join(" | ")})`
    );
  }
}

/**
 * The tags of a file's `Thumbnail` story, or null if it has none. Reads both
 * CSF styles in use: `tags` inside the story object, or `Thumbnail.tags = […]`
 * after a `StoryFn`.
 */
function thumbnailStoryTags(src: string): string[] | null {
  const name = THUMBNAIL_STORY_NAME;
  if (!new RegExp(`^export const ${name}\\b`, "m").test(src)) return null;
  const list =
    src.match(
      new RegExp(
        `^export const ${name}\\b[^=]*=\\s*\\{[\\s\\S]*?^\\s*tags:\\s*\\[([^\\]]*)\\][\\s\\S]*?^\\};`,
        "m"
      )
    )?.[1] ??
    src.match(new RegExp(`^${name}\\.tags\\s*=\\s*\\[([^\\]]*)\\]`, "m"))?.[1];
  return list
    ? [...list.matchAll(/["'`]([^"'`]+)["'`]/g)].map((x) => x[1])
    : [];
}

/**
 * Thumbnails are photographs of a `Thumbnail` story, written beside its file
 * as `<Name>.thumbnail.<theme>.png`, one per docs theme, and found by that
 * shared base name. So each image needs the story it is regenerated from,
 * and each such story must stay out of the sidebar and the docs page.
 *
 * @see app/stories/_meta/thumbnail.ts
 */
function checkThumbnails(files: StoryFile[]) {
  const thumbnailStories = new Set<string>();
  for (const file of files) {
    if (!/\.stories\.[jt]sx?$/.test(file.base)) continue;
    const tags = thumbnailStoryTags(
      readFileSync(join(STORIES_DIR, file.rel), "utf8")
    );
    if (tags === null) continue;
    thumbnailStories.add(file.rel.replace(/\.stories\.[jt]sx?$/, ""));
    const missing = THUMBNAIL_REQUIRED_TAGS.filter((t) => !tags.includes(t));
    if (missing.length > 0) {
      fail(
        file.rel,
        `the ${THUMBNAIL_STORY_NAME} story must be tagged ${missing.map((t) => `"${t}"`).join(" and ")}; it is photographed, not browsed`
      );
    }
  }

  const walkAll = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      return statSync(full).isDirectory() ? walkAll(full) : [full];
    });
  const images = walkAll(STORIES_DIR)
    .map((f) => relative(STORIES_DIR, f))
    .filter((f) => f.includes(".thumbnail."));
  const imageSet = new Set(images);
  for (const rel of images) {
    const m = rel.match(/^(.+)\.thumbnail\.(light|dark)\.png$/);
    if (!m) {
      fail(rel, "thumbnails are named `<Name>.thumbnail.<light|dark>.png`");
      continue;
    }
    const [, base, theme] = m;
    if (!thumbnailStories.has(base)) {
      fail(
        rel,
        `no ${THUMBNAIL_STORY_NAME} story in a story file beside it shares its name; it cannot be regenerated`
      );
    }
    const size = pngSize(readFileSync(join(STORIES_DIR, rel)));
    const want = thumbnailPixelSize();
    if (size.width !== want.width || size.height !== want.height) {
      fail(
        rel,
        `is ${size.width}×${size.height}, not ${want.width}×${want.height}; regenerate with \`pnpm storybook:thumbnails\``
      );
    }
    const other = THUMBNAIL_THEMES.find((t) => t !== theme);
    if (!imageSet.has(`${base}.thumbnail.${other}.png`)) {
      fail(
        rel,
        `missing its ${other} counterpart; regenerate with \`pnpm storybook:thumbnails\``
      );
    }
  }
}

function main() {
  const files = collect();

  for (const file of files.filter((f) => f.isFlat)) {
    fail(
      file.rel,
      "story files must live in a taxonomy directory under stories/, not flat in stories/"
    );
  }

  const managed = files.filter((f) => !f.isFlat);
  for (const file of managed) {
    checkPathAndTitle(file);
    checkOverviewName(file);
    // Tags are a CSF concept. An MDX docs page cannot declare them through
    // `<Meta>`, and it carries no per-story axis state, so it is not tagged.
    if (!file.rel.endsWith(".mdx")) {
      checkTags(file);
    }
  }

  // Duplicate titles are checked across the whole set, flat files included: two
  // files claiming one title is a defect wherever it happens.
  const byTitle = new Map<string, string[]>();
  for (const file of files) {
    if (!file.title) continue;
    byTitle.set(file.title, [...(byTitle.get(file.title) ?? []), file.rel]);
  }
  for (const [title, owners] of byTitle) {
    if (owners.length > 1) {
      fail(owners.join(" + "), `duplicate title "${title}"`);
    }
  }

  // Every section a managed story uses must be in the sidebar order, or it
  // sorts alphabetically by accident.
  const ordered = sortOrderNames();
  checkSortOrderCoversTaxonomy(ordered);
  for (const file of managed) {
    if (!file.title) continue;
    const segments = file.title.split("/").map((s) => s.trim());
    const toCheck = [segments[0]];
    // Only roots that define a fixed section list have a second level that is
    // itself a section. Under `Storybook`, the second segment is a page name.
    if (allowedSecondSegments(segments[0]) && segments[1]) {
      toCheck.push(segments[1]);
    }
    for (const segment of toCheck) {
      if (!ordered.has(segment)) {
        fail(
          file.rel,
          `"${segment}" is missing from options.storySort.order in .storybook/preview.tsx`
        );
      }
    }
  }

  checkThumbnails(managed);

  writeHealth(files);

  if (problems.length > 0) {
    process.stderr.write(`\nlint:stories — ${problems.length} problem(s):\n\n`);
    for (const p of problems) process.stderr.write(`  ${p}\n`);
    process.stderr.write(
      `\nConventions: ~/dotfiles/agents/skills/phoenix-storybook/SKILL.md\n\n`
    );
    process.exit(1);
  }
  process.stdout.write(
    `lint:stories — ok. ${managed.length} file(s) in the taxonomy.
`
  );
}

/**
 * Writes the data behind `Storybook/Storybook health`.
 *
 * Generated rather than hand-maintained: the linter already parses every story
 * file, so the page cannot drift from the tree. Documentation coverage is
 * derived here rather than tagged, because "has an adjacent .mdx" is
 * computable and a derivable tag invites the tag and the facts to disagree.
 */
function writeHealth(files: StoryFile[]) {
  // A subject's `Overview` page is navigation generated from the index, not
  // documentation or a story, so it counts toward neither.
  const content = files.filter((f) => f.base !== "Overview.mdx");
  const stories = content.filter((f) => !f.attachedMdx);
  const docs = new Set(
    content.filter((f) => f.rel.endsWith(".mdx")).map((f) => f.dir)
  );
  const count = (tag: string) =>
    stories.filter((f) => f.tags.includes(tag)).length;

  const bySection: Record<string, number> = {};
  for (const file of stories) {
    if (!file.title) continue;
    const section = file.title.split("/").slice(0, 2).join("/");
    bySection[section] = (bySection[section] ?? 0) + 1;
  }

  writeFileSync(
    HEALTH_FILE,
    `${JSON.stringify(
      {
        generatedBy: "pnpm lint:stories",
        totals: {
          files: stories.length,
        },
        tags: {
          legacy: count(provenance.legacy),
          updated: count(provenance.updated),
          complete: count(completeness.complete),
          incomplete: count(completeness.incomplete),
          reviewed: count(review.reviewed),
          unreviewed: count(review.unreviewed),
        },
        sectionsWithDocsPage: [...docs].filter(Boolean).sort(),
        storiesBySection: Object.fromEntries(
          Object.entries(bySection).sort(([a], [b]) => a.localeCompare(b))
        ),
        taxonomy: {
          roots: ROOTS,
          designSystemSubjects: DESIGN_SYSTEM_SUBJECTS,
          domainSurfaces: DOMAIN_SURFACES,
        },
      },
      null,
      2
    )}\n`
  );
}

main();
