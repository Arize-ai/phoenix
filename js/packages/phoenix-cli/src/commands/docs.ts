import * as fs from "fs";
import * as path from "path";
import { Command } from "commander";

import { ExitCode, getExitCodeForError } from "../exitCodes";
import { writeError, writeOutput, writeProgress } from "../io";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LLMS_TXT_URL = "https://arize.com/docs/phoenix/llms.txt";
const PHOENIX_DOCS_PREFIX = "https://arize.com/docs/phoenix/";
const DEFAULT_OUTPUT_DIR = ".px/docs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DocEntry {
  title: string;
  url: string;
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

// ---------------------------------------------------------------------------
// Workflow mapping
// ---------------------------------------------------------------------------

const WORKFLOW_SECTION_MAP: Record<string, string[]> = {
  tracing: ["tracing"],
  evaluation: ["evaluation"],
  datasets: ["datasets & experiments"],
  prompts: ["prompt engineering"],
  integrations: ["integrations"],
  sdk: ["sdk & api reference"],
  "self-hosting": ["self-hosting"],
  cookbooks: ["cookbooks"],
};

// ---------------------------------------------------------------------------
// Pure functions (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Parse an llms.txt file into an array of doc entries.
 *
 * The format uses `##` headings for sections and markdown links `- [title](url)`
 * for individual pages.
 */
export function parseLlmsTxt(content: string): DocEntry[] {
  const entries: DocEntry[] = [];
  let currentSection = "";

  for (const line of content.split("\n")) {
    const trimmed = line.trim();

    // Track section headings
    const sectionMatch = trimmed.match(/^##\s+(.+)/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      continue;
    }

    // Extract markdown links: - [title](url) or [title](url)
    const linkMatch = trimmed.match(/^-?\s*\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      const title = linkMatch[1];
      const url = linkMatch[2];
      entries.push({ title, url, section: currentSection });
    }
  }

  return entries;
}

/**
 * Filter doc entries to only those matching the given workflow categories.
 *
 * Matching is case-insensitive against the section heading. If no workflows
 * are provided (or the list is empty), all entries are returned.
 */
export function filterByWorkflows(
  entries: DocEntry[],
  workflows: string[]
): DocEntry[] {
  if (workflows.length === 0) {
    return entries;
  }

  // Collect all allowed section names (lowercase) from the workflow map
  const allowedSections = new Set<string>();
  for (const workflow of workflows) {
    const key = workflow.toLowerCase();
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
 *
 * Strips the `https://arize.com/docs/phoenix/` prefix and appends `.md`.
 */
export function urlToFilePath(url: string, outputDir: string): string {
  let relative = url;
  if (relative.startsWith(PHOENIX_DOCS_PREFIX)) {
    relative = relative.slice(PHOENIX_DOCS_PREFIX.length);
  }
  // Strip leading/trailing slashes
  relative = relative.replace(/^\/+|\/+$/g, "");
  return path.join(outputDir, `${relative}.md`);
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchMarkdown(url: string): Promise<string> {
  const markdownUrl = url.endsWith(".md") ? url : `${url}.md`;
  const response = await fetch(markdownUrl);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${markdownUrl}`);
  }
  return response.text();
}

async function fetchAndSave(entry: DocEntry, outputDir: string): Promise<void> {
  const content = await fetchMarkdown(entry.url);
  const filePath = urlToFilePath(entry.url, outputDir);
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}

interface FetchResult {
  succeeded: DocEntry[];
  failed: { entry: DocEntry; error: string }[];
}

async function fetchWithConcurrency(
  entries: DocEntry[],
  outputDir: string,
  workers: number
): Promise<FetchResult> {
  const succeeded: DocEntry[] = [];
  const failed: { entry: DocEntry; error: string }[] = [];

  // Process entries in batches
  for (let index = 0; index < entries.length; index += workers) {
    const batch = entries.slice(index, index + workers);
    const results = await Promise.allSettled(
      batch.map((entry) => fetchAndSave(entry, outputDir).then(() => entry))
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        succeeded.push(result.value);
      } else {
        // Find the corresponding entry for this failed result
        const batchIndex = results.indexOf(result);
        const entry = batch[batchIndex];
        failed.push({
          entry,
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
  try {
    // 1. Fetch llms.txt index
    writeProgress({ message: `Fetching index from ${options.llmsUrl}...` });
    const response = await fetch(options.llmsUrl);
    if (!response.ok) {
      writeError({
        message: `Failed to fetch llms.txt: HTTP ${response.status}`,
      });
      process.exit(ExitCode.NETWORK_ERROR);
    }
    const indexContent = await response.text();

    // 2. Parse entries
    let entries = parseLlmsTxt(indexContent);
    writeProgress({ message: `Found ${entries.length} pages in index` });

    // 3. Filter by workflow if specified
    const workflows = options.workflow ?? [];
    if (workflows.length > 0) {
      entries = filterByWorkflows(entries, workflows);
      writeProgress({
        message: `Filtered to ${entries.length} pages for workflow(s): ${workflows.join(", ")}`,
      });
    }

    if (entries.length === 0) {
      writeOutput({ message: "No matching pages found." });
      return;
    }

    // 4. Dry run — just list the discovered links
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

    // 5. Refresh — clear output dir
    if (options.refresh && fs.existsSync(options.outputDir)) {
      writeProgress({
        message: `Clearing ${options.outputDir}...`,
      });
      fs.rmSync(options.outputDir, { recursive: true, force: true });
    }

    // 6. Ensure output dir exists
    fs.mkdirSync(options.outputDir, { recursive: true });

    // 7. Fetch and save all pages
    writeProgress({
      message: `Downloading ${entries.length} pages (${options.workers} workers)...`,
    });
    const { succeeded, failed } = await fetchWithConcurrency(
      entries,
      options.outputDir,
      options.workers
    );

    // 8. Report results
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
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    writeError({ message: `Error: ${message}` });
    process.exit(getExitCodeForError(error));
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
      "Filter by workflow category (repeatable)",
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
