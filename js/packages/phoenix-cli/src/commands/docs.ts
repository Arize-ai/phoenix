import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import { Command } from "commander";

import { ExitCode, getExitCodeForError } from "../exitCodes";
import { writeError, writeOutput } from "../io";
import { collectString, parsePositiveIntOption } from "../optionParsers";

const LLMS_TXT_URL = "https://arize.com/docs/phoenix/llms.txt";
const PHOENIX_DOCS_PREFIX = "https://arize.com/docs/phoenix/";
export const DEFAULT_OUTPUT_DIR = ".px/docs";
export const DEFAULT_WORKERS = 10;
const ALL_WORKFLOWS = "all";

export interface DocEntry {
  title: string;
  url: string;
  description: string;
  section: string;
}

/**
 * Options for `px docs fetch` (and its `px docs` parent-command alias, which
 * shares the same options and handler). This talks to the public Phoenix
 * docs site, not a Phoenix server, so it does not extend the shared
 * connection/format option bases.
 */
interface DocsFetchOptions {
  /**
   * `--workflow <name>`: Filter by workflow category, repeatable. Valid
   * values are the keys of `WORKFLOW_SECTION_MAP` (`tracing`, `evaluation`,
   * `datasets`, `prompts`, `integrations`, `sdk`, `self-hosting`) plus `all`.
   * Commander's own default is `[]`; when empty, the handler falls back to
   * `DEFAULT_WORKFLOWS` (`tracing`, `evaluation`, `datasets`, `prompts`,
   * `integrations`).
   *
   * @example ["tracing", "evaluation"]
   */
  workflow?: string[];
  /**
   * `--output-dir <dir>`: Directory downloaded docs are written into.
   * Defaults to `.px/docs`.
   *
   * @example "./docs/phoenix"
   */
  outputDir: string;
  /**
   * `--dry-run`: Discover and print matching pages without downloading or
   * writing anything to disk. Defaults to `false`.
   *
   * @example true // px docs fetch --dry-run
   */
  dryRun?: boolean;
  /**
   * `--refresh`: Delete `outputDir` before downloading, so pages removed
   * from a previous fetch don't linger. Defaults to `false`.
   *
   * @example true // px docs fetch --refresh
   */
  refresh?: boolean;
  /**
   * `--strict`: Exit with `ExitCode.FAILURE` if any page fails to download.
   * Without it, failed downloads are printed to stderr but the command still
   * exits successfully. Defaults to `false`.
   *
   * @example true // px docs fetch --strict
   */
  strict?: boolean;
  /**
   * `--workers <n>`: Number of pages downloaded concurrently, in batches of
   * this size. Defaults to 10.
   *
   * @example 20
   */
  workers: number;
}

/**
 * Maps user-facing workflow names to the top-level `##` section headings
 * in the llms.txt index. Entries under `###` subsections inherit their
 * parent `##` section.
 */
const WORKFLOW_SECTION_MAP: Record<string, string[]> = {
  tracing: ["tracing"],
  evaluation: ["evaluation"],
  datasets: ["datasets & experiments"],
  prompts: ["prompt engineering"],
  integrations: ["integrations"],
  sdk: ["sdk & api reference"],
  "self-hosting": ["self-hosting"],
};

const VALID_WORKFLOWS = Object.keys(WORKFLOW_SECTION_MAP);

/** Shared by every command that takes `--workers`, so the rejection reads alike. */
export const WORKERS_REQUIREMENT = "--workers must be a positive integer.";

/**
 * Worded once, for every entry point that can be handed a bad `--workflow` —
 * `px docs fetch` and the setup prefetch both warn with this, so the same typo
 * does not read two different ways.
 */
export function unknownWorkflowWarning(name: string): string {
  return `Warning: unknown workflow "${name}". Valid values: ${VALID_WORKFLOWS.join(", ")}, all`;
}

/** The default set fetched when no --workflow is specified. */
const DEFAULT_WORKFLOWS = [
  "tracing",
  "evaluation",
  "datasets",
  "prompts",
  "integrations",
];

// ---------------------------------------------------------------------------
// Pure functions (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Parse an llms.txt file into doc entries.
 *
 * The Phoenix llms.txt follows the llmstxt.org standard format:
 *   ## Section           — top-level sections
 *   ### Subsection       — subsections (inherit parent ## section)
 *   - [Title](url): Description
 */
export function parseLlmsTxt(content: string): DocEntry[] {
  const entries: DocEntry[] = [];
  let currentSection = "";

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();

    // Track top-level ## section headings (subsections ### inherit the parent)
    const topSectionMatch = line.match(/^##\s+(?!#)(.+)/);
    if (topSectionMatch) {
      currentSection = topSectionMatch[1].trim();
      continue;
    }

    // Parse: - [Title](url): Description
    const entryMatch = line.match(
      /^-\s+\[([^\]]+)\]\((https?:\/\/[^)]+)\)(?::\s+(.*))?$/
    );
    if (entryMatch) {
      entries.push({
        title: entryMatch[1],
        url: entryMatch[2],
        description: entryMatch[3] ?? "",
        section: currentSection,
      });
    }
  }

  return entries;
}

/**
 * Filter doc entries by workflow categories. Returns all entries if
 * workflows is empty or contains ALL_WORKFLOWS.
 */
export function filterByWorkflows(
  entries: DocEntry[],
  workflows: string[]
): DocEntry[] {
  if (workflows.length === 0) {
    return entries;
  }

  const normalized = workflows.map((workflow) => workflow.toLowerCase());
  if (normalized.includes(ALL_WORKFLOWS)) {
    return entries;
  }

  const allowedSections = new Set<string>();
  for (const key of normalized) {
    const mapped = WORKFLOW_SECTION_MAP[key];
    if (mapped) {
      for (const section of mapped) {
        allowedSections.add(section);
      }
    }
  }

  return entries.filter((entry) =>
    allowedSections.has(entry.section.toLowerCase())
  );
}

/**
 * Convert a Phoenix docs URL to a local file path.
 * Strips the common prefix and appends `.md`.
 */
export function urlToFilePath(url: string, outputDir: string): string {
  let relative = url.startsWith(PHOENIX_DOCS_PREFIX)
    ? url.slice(PHOENIX_DOCS_PREFIX.length)
    : url;
  relative = relative.replace(/^\/+|\/+$/g, "");
  return path.join(outputDir, `${relative}.md`);
}

/**
 * Group doc entries by their section name (lowercased).
 */
export function groupBySection(entries: DocEntry[]): Map<string, DocEntry[]> {
  const groups = new Map<string, DocEntry[]>();
  for (const entry of entries) {
    const section = entry.section.toLowerCase();
    const group = groups.get(section);
    if (group) {
      group.push(entry);
    } else {
      groups.set(section, [entry]);
    }
  }
  return groups;
}

/**
 * Generate the content for the top-level README.md index file.
 */
export function generateReadme(
  entries: DocEntry[],
  grouped?: Map<string, DocEntry[]>
): string {
  const lines: string[] = [
    "# Phoenix Docs",
    "",
    "Generated by `px docs fetch`.",
    "",
  ];

  const sections = grouped ?? groupBySection(entries);
  for (const [section, sectionEntries] of sections) {
    lines.push(`## ${section}`);
    for (const entry of sectionEntries) {
      const filePath = urlToFilePath(entry.url, "").replace(/^\/+/, "");
      lines.push(`- [${entry.title}](${filePath})`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Generate the content for a section-level _index.md file.
 * Uses paths relative to the section directory (derived from the first
 * entry's file path) so that links work from the _index.md location.
 */
export function generateSectionIndex(
  section: string,
  entries: DocEntry[]
): string {
  const lines: string[] = [`# ${section} Docs`, ""];

  // Determine the section directory from the first entry
  const firstFilePath = urlToFilePath(entries[0].url, "").replace(/^\/+/, "");
  const sectionDir = firstFilePath.split(path.sep)[0];

  for (const entry of entries) {
    const filePath = urlToFilePath(entry.url, "").replace(/^\/+/, "");
    // Strip the section directory prefix to get a relative path
    const relativePath = filePath.startsWith(sectionDir + path.sep)
      ? filePath.slice(sectionDir.length + 1)
      : filePath;
    lines.push(`- [${entry.title}](${relativePath})`);
    lines.push(`  source: \`${entry.url}.md\``);
  }

  return lines.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchAndSave(entry: DocEntry, outputDir: string): Promise<void> {
  const markdownUrl = entry.url.endsWith(".md") ? entry.url : `${entry.url}.md`;
  const response = await fetch(markdownUrl);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${markdownUrl}`);
  }
  const content = await response.text();
  const filePath = urlToFilePath(entry.url, outputDir);
  await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
  await fsPromises.writeFile(filePath, content, "utf-8");
}

async function fetchWithConcurrency(
  entries: DocEntry[],
  outputDir: string,
  workers: number
): Promise<{
  succeeded: DocEntry[];
  failed: { entry: DocEntry; error: string }[];
}> {
  const succeeded: DocEntry[] = [];
  const failed: { entry: DocEntry; error: string }[] = [];

  for (let offset = 0; offset < entries.length; offset += workers) {
    const batch = entries.slice(offset, offset + workers);
    const results = await Promise.allSettled(
      batch.map((entry) => fetchAndSave(entry, outputDir).then(() => entry))
    );

    for (let index = 0; index < results.length; index++) {
      const result = results[index];
      if (result.status === "fulfilled") {
        succeeded.push(result.value);
      } else {
        failed.push({
          entry: batch[index],
          error:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
        });
      }
    }
  }

  return { succeeded, failed };
}

/**
 * Write the README.md and per-section _index.md files.
 */
async function writeIndexFiles(
  entries: DocEntry[],
  outputDir: string
): Promise<void> {
  const grouped = groupBySection(entries);

  // Top-level README.md
  const readmeContent = generateReadme(entries, grouped);
  await fsPromises.writeFile(
    path.join(outputDir, "README.md"),
    readmeContent,
    "utf-8"
  );

  // Per-section _index.md files
  for (const [section, sectionEntries] of grouped) {
    const indexContent = generateSectionIndex(section, sectionEntries);
    // Derive the section directory from the first entry's file path
    const firstFilePath = urlToFilePath(sectionEntries[0].url, outputDir);
    const sectionDir = path.dirname(firstFilePath);
    await fsPromises.mkdir(sectionDir, { recursive: true });
    await fsPromises.writeFile(
      path.join(sectionDir, "_index.md"),
      indexContent,
      "utf-8"
    );
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

function formatEntryLine(entry: DocEntry, target: string): string {
  const section = entry.section.toLowerCase();
  return `  - ${entry.title} [${section}] -> ${target}`;
}

/**
 * Resolve the requested workflows, falling back to {@link DEFAULT_WORKFLOWS}
 * when none were given, and report any names that aren't recognized so the
 * caller can warn without failing.
 */
export function resolveWorkflows(workflows?: string[]): {
  workflows: string[];
  unknown: string[];
} {
  const resolved =
    workflows && workflows.length > 0 ? workflows : DEFAULT_WORKFLOWS;
  const unknown = resolved.filter((workflow) => {
    const key = workflow.toLowerCase();
    return key !== ALL_WORKFLOWS && !VALID_WORKFLOWS.includes(key);
  });
  return { workflows: [...resolved], unknown };
}

/**
 * A non-2xx response from the docs index. Distinct from the `TypeError` fetch
 * throws for a refused connection, but both mean the same thing to a caller —
 * the docs site could not be read — so both exit `NETWORK_ERROR`.
 */
export class DocsIndexError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocsIndexError";
  }
}

/**
 * Fetch and parse the docs index. Throws on a network failure or non-2xx
 * response — callers decide whether that is fatal (`px docs fetch`) or a
 * non-fatal warning (setup's prefetch).
 */
export async function fetchDocsIndex(): Promise<DocEntry[]> {
  const response = await fetch(LLMS_TXT_URL);
  if (!response.ok) {
    throw new DocsIndexError(
      `Failed to fetch llms.txt: HTTP ${response.status}`
    );
  }
  return parseLlmsTxt(await response.text());
}

export interface DownloadDocsOptions {
  outputDir: string;
  workers: number;
  /** Clear `outputDir` first, so pages dropped upstream don't linger. */
  refresh?: boolean;
}

/**
 * Download `entries` into `outputDir` and write the index files. Returns the
 * per-entry outcome rather than exiting, so both `px docs fetch` and setup's
 * prefetch can report failures in their own voice.
 */
export async function downloadDocs(
  entries: DocEntry[],
  { outputDir, workers, refresh }: DownloadDocsOptions
): Promise<{
  succeeded: DocEntry[];
  failed: Array<{ entry: DocEntry; error: string }>;
}> {
  if (refresh) {
    await fsPromises.rm(outputDir, { recursive: true, force: true });
  }
  await fsPromises.mkdir(outputDir, { recursive: true });

  const { succeeded, failed } = await fetchWithConcurrency(
    entries,
    outputDir,
    workers
  );
  if (succeeded.length > 0) {
    await writeIndexFiles(succeeded, outputDir);
  }
  return { succeeded, failed };
}

async function docsFetchHandler(options: DocsFetchOptions): Promise<void> {
  // `parsePositiveIntOption` yields NaN for a value a worker pool can't run on.
  if (Number.isNaN(options.workers)) {
    writeError({ message: WORKERS_REQUIREMENT });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }

  // Fetch llms.txt index
  let indexEntries: DocEntry[];
  try {
    indexEntries = await fetchDocsIndex();
  } catch (error) {
    if (error instanceof DocsIndexError) {
      writeError({ message: error.message });
      process.exit(ExitCode.NETWORK_ERROR);
    }
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    writeError({ message: `Error fetching llms.txt: ${message}` });
    process.exit(getExitCodeForError(error));
  }
  writeOutput({ message: `Fetched docs index: ${LLMS_TXT_URL}` });

  const { workflows, unknown } = resolveWorkflows(options.workflow);
  for (const workflow of unknown) {
    writeError({ message: unknownWorkflowWarning(workflow) });
  }
  const entries = filterByWorkflows(indexEntries, workflows);
  writeOutput({ message: `Workflows: ${workflows.join(", ")}` });

  if (entries.length === 0) {
    writeOutput({ message: "No matching pages found." });
    return;
  }

  // Dry run — show what would be fetched
  if (options.dryRun) {
    writeOutput({
      message: `Discovered ${entries.length} page(s), wrote 0 page(s) (dry-run)`,
    });
    for (const entry of entries) {
      writeOutput({
        message: formatEntryLine(entry, `${entry.url}.md`),
      });
    }
    return;
  }

  const { succeeded, failed } = await downloadDocs(entries, {
    outputDir: options.outputDir,
    workers: options.workers,
    refresh: options.refresh,
  });

  writeOutput({
    message: `Discovered ${entries.length} page(s), wrote ${succeeded.length} page(s)`,
  });
  for (const entry of succeeded) {
    writeOutput({
      message: formatEntryLine(
        entry,
        urlToFilePath(entry.url, options.outputDir)
      ),
    });
  }

  if (failed.length > 0) {
    for (const { entry, error } of failed) {
      writeError({
        message: `  - ${entry.title} [${entry.section.toLowerCase()}] FAILED: ${error}`,
      });
    }
    if (options.strict) {
      process.exit(ExitCode.FAILURE);
    }
  }
}

// ---------------------------------------------------------------------------
// Shared option helpers
// ---------------------------------------------------------------------------

/** Add all docs-specific options to a command. */
function addDocsOptions(command: Command): Command {
  return command
    .option(
      "--workflow <name>",
      `Filter by workflow category (repeatable) [possible values: ${VALID_WORKFLOWS.join(", ")}, all] [default: ${DEFAULT_WORKFLOWS.join(", ")}]`,
      collectString,
      [] as string[]
    )
    .option(
      "--output-dir <dir>",
      "Output directory for downloaded docs",
      DEFAULT_OUTPUT_DIR
    )
    .option("--dry-run", "Discover links only; do not write files", false)
    .option(
      "--refresh",
      "Refresh docs by clearing output directory before download",
      false
    )
    .option("--strict", "Fail command if any page download fails", false)
    .option(
      "--workers <n>",
      "Number of concurrent workers for docs downloads",
      parsePositiveIntOption,
      DEFAULT_WORKERS
    );
}

// ---------------------------------------------------------------------------
// Command factories
// ---------------------------------------------------------------------------

export function createDocsCommand(): Command {
  const command = new Command("docs");
  command.description("Manage workflow docs for coding agents");
  command.enablePositionalOptions();
  command.passThroughOptions();

  // All options live on the parent so `px docs --help` shows them
  addDocsOptions(command);
  command.action(docsFetchHandler);

  // `fetch` is a convenience alias — it re-parses its own argv so
  // `px docs fetch --workflow X` works identically to `px docs --workflow X`.
  const fetchCommand = new Command("fetch");
  fetchCommand.description(
    "Download workflow docs markdown from llms.txt index"
  );
  addDocsOptions(fetchCommand);
  fetchCommand.action(docsFetchHandler);
  command.addCommand(fetchCommand);

  return command;
}
