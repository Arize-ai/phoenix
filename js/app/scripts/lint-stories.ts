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
import { loadCsf } from "storybook/internal/csf-tools";

import {
  ALL_PHOENIX_TAGS,
  completeness,
  provenance,
  review,
  STORYBOOK_BUILTIN_TAGS,
  usage,
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
const SRC_DIR = "src";
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

/** Production source, read once: every `.ts`/`.tsx` under `src/` except tests and generated code. */
let productionSources: { path: string; lines: string[] }[] | null = null;
function productionSource() {
  if (productionSources) return productionSources;
  const out: { path: string; lines: string[] }[] = [];
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry !== "__generated__" && entry !== "__tests__") visit(full);
      } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
        out.push({ path: full, lines: readFileSync(full, "utf8").split("\n") });
      }
    }
  };
  visit(SRC_DIR);
  productionSources = out;
  return out;
}

/**
 * Whether production code refers to `name` anywhere other than where it is
 * declared, imported or re-exported. Includes the declaring file, so a
 * component rendered only by its own module's parent (`ExperimentRunOutputs`
 * inside `ExperimentCompareDetails.tsx`) still counts as used.
 */
function hasProductionCallers(name: string): boolean {
  const word = new RegExp(`\\b${name}\\b`);
  const declaration = new RegExp(
    `\\b(function|const|let|class)\\s+${name}\\b|\\b${name}\\.displayName\\b`
  );
  return productionSource().some(({ lines }) =>
    lines.some((line) => {
      const l = line.trim();
      return (
        word.test(l) &&
        !declaration.test(l) &&
        !/^(import|export|\/\/|\*|\/\*|\} from)/.test(l) &&
        // A bare identifier list is the inside of a multi-line import/export.
        !/^[\w\s,{}]+$/.test(l)
      );
    })
  );
}

/**
 * `unused` must match the code. For every file whose `meta.component` is a
 * production component imported through `@phoenix/…`, the flag is derived
 * from `src/`: present exactly when nothing in production renders it. Files
 * whose subject is not one resolvable component (palettes, reference pages,
 * story-local compositions) are not checked, and carry the flag by hand.
 */
function checkUsage(files: StoryFile[]) {
  for (const file of files) {
    if (!/\.stories\.[jt]sx?$/.test(file.base)) continue;
    const src = readFileSync(join(STORIES_DIR, file.rel), "utf8");
    const component = src.match(
      /^\s{0,2}component:\s*([A-Za-z_]\w*)\s*,/m
    )?.[1];
    if (!component) continue;
    const imported = new RegExp(
      `import\\s*\\{[^}]*\\b${component}\\b[^}]*\\}\\s*from\\s*["']@phoenix/`
    ).test(src);
    if (!imported) continue;
    const tagged = file.tags.includes(usage.unused);
    const used = hasProductionCallers(component);
    if (used && tagged) {
      fail(
        file.rel,
        `tagged "${usage.unused}" but production code renders ${component}; remove the tag`
      );
    } else if (!used && !tagged) {
      fail(
        file.rel,
        `nothing in src/ renders ${component}; tag the file "${usage.unused}"`
      );
    }
  }
}

/**
 * States that apply to a component whatever its content or presentation.
 * Each must be crossed with the other options, never offered as one of them.
 */
const CROSS_CUTTING_STATES = new Set([
  "isDisabled",
  "isInvalid",
  "isReadOnly",
  "isRequired",
  "isPending",
  "isHovered",
]);

/** What a state entry may set besides the state: the data that makes it show. */
const STATE_DATA = new Set([
  "value",
  "defaultValue",
  "defaultSelected",
  "defaultSelectedKey",
  "error",
  "errorMessage",
  "placeholder",
]);

const AXIS_LABEL_KEYS = new Set(["label", "code", "children"]);

type BabelNode = { type: string; [key: string]: unknown };

function propertyName(key: unknown): string | null {
  const node = key as BabelNode | undefined;
  if (node?.type === "Identifier") return node.name as string;
  if (node?.type === "StringLiteral") return node.value as string;
  return null;
}

/** An axis entry's option keys, looking inside `props`, `groupProps`, etc. */
function axisEntryKeys(entry: BabelNode, out: string[]) {
  for (const property of entry.properties as BabelNode[]) {
    if (property.type !== "ObjectProperty") continue;
    const name = propertyName(property.key);
    if (!name || AXIS_LABEL_KEYS.has(name)) continue;
    const value = property.value as BabelNode;
    if (/props$/i.test(name) && value.type === "ObjectExpression") {
      axisEntryKeys(value, out);
    } else {
      out.push(name);
    }
  }
}

function walkAst(node: unknown, visit: (node: BabelNode) => void) {
  if (!node || typeof (node as BabelNode).type !== "string") return;
  visit(node as BabelNode);
  for (const [key, child] of Object.entries(node as BabelNode)) {
    if (key === "loc" || key.endsWith("Comments")) continue;
    if (Array.isArray(child)) child.forEach((c) => walkAst(c, visit));
    else if (child && typeof child === "object") walkAst(child, visit);
  }
}

/** Strips `as const`, `satisfies` and other type-only wrappers. */
function unwrapExpression(node: BabelNode | undefined): BabelNode | undefined {
  while (
    node &&
    (node.type === "TSAsExpression" ||
      node.type === "TSSatisfiesExpression" ||
      node.type === "TSNonNullExpression" ||
      node.type === "ParenthesizedExpression")
  ) {
    node = node.expression as BabelNode;
  }
  return node;
}

/**
 * An array literal's elements with every `...NAME` spread of a `const` array
 * literal in the same file expanded in place, or `null` when a spread cannot
 * be resolved that way.
 */
function expandedElements(
  node: BabelNode,
  arrays: Map<string, BabelNode>,
  seen: Set<string> = new Set()
): BabelNode[] | null {
  const out: BabelNode[] = [];
  for (const element of node.elements as (BabelNode | null)[]) {
    if (element?.type !== "SpreadElement") {
      if (element) out.push(element);
      continue;
    }
    const argument = element.argument as BabelNode;
    const name =
      argument.type === "Identifier" ? (argument.name as string) : "";
    const array = arrays.get(name);
    if (!array || seen.has(name)) return null;
    const inner = expandedElements(array, arrays, new Set([...seen, name]));
    if (!inner) return null;
    out.push(...inner);
  }
  return out;
}

/**
 * An option grid's axis — any array literal of object literals — that sets a
 * cross-cutting state such as `isDisabled` may set nothing else but the data
 * that state needs. A `Disabled` column beside `Leading visual` and
 * `Icon only` columns shows disabled only on plain content, so a disabled
 * button with a trailing shortcut is never rendered. States go on their own
 * axis and are crossed with the others (`flatMap` two literal axes).
 *
 * An axis assembled from another with a spread (`[...SIZES, Disabled]`) is
 * checked with the spread array's entries in place.
 */
function checkStatesCrossOtherOptions(files: StoryFile[]) {
  for (const file of files) {
    if (!/\.stories\.[jt]sx?$/.test(file.base)) continue;
    const csf = loadCsf(readFileSync(join(STORIES_DIR, file.rel), "utf8"), {
      fileName: file.rel,
      makeTitle: (title) => title ?? file.rel,
    }).parse();
    const arrays = new Map<string, BabelNode>();
    walkAst(csf._ast.program, (node) => {
      if (node.type !== "VariableDeclaration" || node.kind !== "const") return;
      for (const declarator of node.declarations as BabelNode[]) {
        const id = declarator.id as BabelNode;
        const init = unwrapExpression(declarator.init as BabelNode | undefined);
        if (id.type === "Identifier" && init?.type === "ArrayExpression") {
          arrays.set(id.name as string, init);
        }
      }
    });
    walkAst(csf._ast.program, (node) => {
      if (node.type !== "ArrayExpression") return;
      const elements = expandedElements(node, arrays);
      if (!elements || elements.length < 2) return;
      if (!elements.every((e) => e.type === "ObjectExpression")) return;
      const keys: string[] = [];
      for (const element of elements) axisEntryKeys(element, keys);
      const states = [
        ...new Set(keys.filter((k) => CROSS_CUTTING_STATES.has(k))),
      ];
      const others = [
        ...new Set(
          keys.filter((k) => !CROSS_CUTTING_STATES.has(k) && !STATE_DATA.has(k))
        ),
      ];
      if (states.length === 0 || others.length === 0) return;
      const line = (node.loc as { start: { line: number } }).start.line;
      fail(
        `${file.rel}:${line}`,
        `this axis sets ${states.join(", ")} beside ${others.join(", ")}; put states on their own axis and cross them with the other options`
      );
    });
  }
}

/**
 * Every `<Canvas of={X.Story} />` or `<Meta of={X} />` in MDX must name a story
 * that exists. Storybook reports a missing one only when the page is opened
 * (`SB_BLOCKS_0001 … of={undefined}`), so renaming or removing a story export
 * would otherwise break a docs page silently.
 */
function checkMdxStoryReferences(files: StoryFile[]) {
  for (const file of files) {
    if (!file.base.endsWith(".mdx")) continue;
    const src = readFileSync(join(STORIES_DIR, file.rel), "utf8");
    const modules = new Map<string, string>();
    for (const m of src.matchAll(
      /^import \* as (\w+) from ["'](\.[^"']+\.stories\.[jt]sx?)["'];?$/gm
    )) {
      modules.set(m[1], m[2]);
    }
    const exportsOf = new Map<string, Set<string>>();
    for (const m of src.matchAll(/\bof=\{(\w+)(?:\.(\w+))?\}/g)) {
      const [, namespace, story] = m;
      const path = modules.get(namespace);
      if (!path) {
        fail(
          file.rel,
          `of={${m[0].slice(4, -1)}} does not refer to an imported story file`
        );
        continue;
      }
      if (!story) continue;
      if (!exportsOf.has(namespace)) {
        const target = join(STORIES_DIR, file.dir, path);
        const csf = loadCsf(readFileSync(target, "utf8"), {
          fileName: target,
          makeTitle: (title) => title ?? target,
        }).parse();
        exportsOf.set(namespace, new Set(Object.keys(csf._stories)));
      }
      if (!exportsOf.get(namespace)!.has(story)) {
        fail(
          file.rel,
          `of={${namespace}.${story}}: ${path} has no story export "${story}"`
        );
      }
    }
  }
}

/**
 * Every sidebar entry must show something no other entry shows.
 *
 * Autodocs gives each file a Docs page that renders all of its stories, so a
 * file with exactly one story in the sidebar shows that story twice: as the
 * story and as the Docs page. Such a file must hide its lone story with
 * `!dev`, leaving the Docs page as its only entry (Storybook then draws it as
 * a single leaf). A file with two or more visible stories is fine: the Docs
 * page is their one-scroll overview and each story is an isolated canvas.
 *
 * Stories are read with Storybook's own CSF parser, not a regex, because
 * story files also export fixtures and helpers.
 */
function checkSingleSidebarEntry(files: StoryFile[]) {
  for (const file of files) {
    if (!/\.stories\.[jt]sx?$/.test(file.base)) continue;
    const csf = loadCsf(readFileSync(join(STORIES_DIR, file.rel), "utf8"), {
      fileName: file.rel,
      makeTitle: (title) => title ?? file.rel,
    }).parse();
    const metaTags = csf.meta.tags ?? [];
    if (metaTags.includes("!autodocs")) continue;
    const visible = csf.stories.filter(
      (story) => !metaTags.includes("!dev") && !story.tags?.includes("!dev")
    );
    if (visible.length === 1) {
      fail(
        file.rel,
        `"${visible[0].name}" is the only story in the sidebar, so it repeats the Docs page; tag it "!dev" so the Docs page is this file's one entry`
      );
    }
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
  checkSingleSidebarEntry(managed);
  checkUsage(managed);
  checkMdxStoryReferences(managed);
  checkStatesCrossOtherOptions(managed);

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
          unused: count(usage.unused),
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
