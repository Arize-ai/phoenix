import * as fs from "node:fs";
import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import { Command } from "commander";

import { ExitCode, getExitCodeForError } from "../exitCodes";
import { writeError, writeOutput, writeProgress } from "../io";

const LLMS_TXT_URL = "https://arize.com/docs/phoenix/llms.txt";
const PHOENIX_DOCS_PREFIX = "https://arize.com/docs/phoenix/";
const DEFAULT_OUTPUT_DIR = ".px/docs";

export interface DocEntry {
  title: string;
  url: string;
  description: string;
  section: string;
}

interface DocsFetchOptions {
  workflow?: string[];
  outputDir: string;
  llmsUrl: string;
  dryRun?: boolean;
  refresh?: boolean;
  strict?: boolean;
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
  cookbooks: ["cookbooks"],
  concepts: ["concepts"],
  quickstart: ["quick start"],
  overview: ["overview"],
  resources: ["resources"],
  settings: ["settings"],
};

const VALID_WORKFLOWS = Object.keys(WORKFLOW_SECTION_MAP);

/** The default set fetched when no --workflow is specified. */
const DEFAULT_WORKFLOWS = ["tracing", "evaluation", "datasets", "prompts"];

// ---------------------------------------------------------------------------
// Pure functions (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Parse an llms.txt file into doc entries.
 *
 * The real Phoenix llms.txt format uses:
 *   ## Section           — top-level sections
 *   ### Subsection       — subsections (inherit parent ## section)
 *   - Title: `url` - Description
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

    // Parse: - Title: `url` - Description
    const entryMatch = line.match(
      /^-\s+(.+?):\s+`(https?:\/\/[^`]+)`(?:\s+-\s+(.*))?$/
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
 * workflows is empty or contains "all".
 */
export function filterByWorkflows(
  entries: DocEntry[],
  workflows: string[]
): DocEntry[] {
  if (workflows.length === 0) {
    return entries;
  }

  const normalized = workflows.map((workflow) => workflow.toLowerCase());
  if (normalized.includes("all")) {
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

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

async function docsFetchHandler(options: DocsFetchOptions): Promise<void> {
  // Fetch llms.txt index
  writeProgress({ message: `Fetching index from ${options.llmsUrl}...` });
  let response: Response;
  try {
    response = await fetch(options.llmsUrl);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    writeError({ message: `Error fetching llms.txt: ${message}` });
    process.exit(getExitCodeForError(error));
  }
  if (!response.ok) {
    writeError({
      message: `Failed to fetch llms.txt: HTTP ${response.status}`,
    });
    process.exit(ExitCode.NETWORK_ERROR);
  }
  const indexContent = await response.text();

  // Parse entries
  let entries = parseLlmsTxt(indexContent);
  writeProgress({ message: `Found ${entries.length} pages in index` });

  // Filter by workflow (defaults to curated subset, use --workflow all for everything)
  const workflows =
    options.workflow && options.workflow.length > 0
      ? options.workflow
      : DEFAULT_WORKFLOWS;

  // Warn about unknown workflow names
  for (const workflow of workflows) {
    const key = workflow.toLowerCase();
    if (key !== "all" && !VALID_WORKFLOWS.includes(key)) {
      writeError({
        message: `Warning: unknown workflow "${workflow}". Valid values: ${VALID_WORKFLOWS.join(", ")}, all`,
      });
    }
  }
  entries = filterByWorkflows(entries, workflows);
  writeProgress({
    message: `Filtered to ${entries.length} pages for workflow(s): ${workflows.join(", ")}`,
  });

  if (entries.length === 0) {
    writeOutput({ message: "No matching pages found." });
    return;
  }

  // Dry run — list discovered links
  if (options.dryRun) {
    writeOutput({ message: `Discovered ${entries.length} pages:\n` });
    for (const entry of entries) {
      const filePath = urlToFilePath(entry.url, options.outputDir);
      writeOutput({
        message: `  [${entry.section}] ${entry.title}\n    ${entry.url} -> ${filePath}`,
      });
    }
    return;
  }

  // Refresh — clear output dir
  if (options.refresh && fs.existsSync(options.outputDir)) {
    writeProgress({ message: `Clearing ${options.outputDir}...` });
    fs.rmSync(options.outputDir, { recursive: true, force: true });
  }

  fs.mkdirSync(options.outputDir, { recursive: true });

  // Fetch and save
  writeProgress({
    message: `Downloading ${entries.length} pages (${options.workers} workers)...`,
  });
  const { succeeded, failed } = await fetchWithConcurrency(
    entries,
    options.outputDir,
    options.workers
  );

  writeOutput({
    message: `Downloaded ${succeeded.length}/${entries.length} pages to ${options.outputDir}`,
  });

  if (failed.length > 0) {
    writeError({ message: `\nFailed to download ${failed.length} pages:` });
    for (const { entry, error } of failed) {
      writeError({ message: `  ${entry.url}: ${error}` });
    }
    if (options.strict) {
      process.exit(ExitCode.FAILURE);
    }
  }
}

// ---------------------------------------------------------------------------
// Command factories
// ---------------------------------------------------------------------------

function createDocsFetchCommand(): Command {
  const command = new Command("fetch");

  command
    .description("Fetch Phoenix documentation from llms.txt index")
    .option(
      "--workflow <name>",
      `Filter by workflow category (repeatable). Defaults to: ${DEFAULT_WORKFLOWS.join(", ")}. Use "all" for everything.`,
      (value: string, previous: string[]) => previous.concat([value]),
      [] as string[]
    )
    .option(
      "--output-dir <dir>",
      "Output directory for docs",
      DEFAULT_OUTPUT_DIR
    )
    .option("--llms-url <url>", "Override llms.txt index URL", LLMS_TXT_URL)
    .option("--dry-run", "Show discovered links without downloading", false)
    .option("--refresh", "Clear output directory before downloading", false)
    .option("--strict", "Fail if any page download fails", false)
    .option("--workers <n>", "Concurrent download workers", parseInt, 4)
    .action(docsFetchHandler);

  return command;
}

export function createDocsCommand(): Command {
  const command = new Command("docs");

  command.description("Fetch and manage Phoenix documentation");

  command.addCommand(createDocsFetchCommand());

  return command;
}
