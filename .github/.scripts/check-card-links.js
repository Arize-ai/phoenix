#!/usr/bin/env node

/**
 * Link checker for Mintlify <Card> components.
 *
 * Scans all .mdx/.md/.html files for <Card ... href="..."> attributes and validates:
 * - External links (http/https): HEAD check (fallback to GET) with timeout.
 * - Internal links (starting with "/" or relative paths): verify file exists in repo.
 *
 * Outputs any broken links with file path and line number, then exits non-zero if any are found.
 *
 * Usage:
 *   node scripts/check-card-links.js [--root <repo_root>] [--timeout 10]
 */

const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const CARD_HREF_REGEX = /<Card\b[^>]*?\bhref\s*=\s*(['"])(?<href>[^'\"]+)\1/gis;
const MDX_COMMENT_BLOCK = /\{\/\*.*?\*\/\}/gs;

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    timeout: 10,
    maxWorkers: 12,
    verbose: false,
    githubAnnotations: false,
    summaryFile: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--root") {
      args.root = argv[i + 1] || args.root;
      i += 1;
    } else if (token === "--timeout") {
      const n = Number(argv[i + 1]);
      if (!Number.isNaN(n) && n > 0) {
        args.timeout = n;
      }
      i += 1;
    } else if (token === "--max-workers") {
      const n = Number(argv[i + 1]);
      if (!Number.isNaN(n) && n > 0) {
        args.maxWorkers = Math.floor(n);
      }
      i += 1;
    } else if (token === "--verbose") {
      args.verbose = true;
    } else if (token === "--github-annotations") {
      args.githubAnnotations = true;
    } else if (token === "--summary-file") {
      args.summaryFile = argv[i + 1] || null;
      i += 1;
    }
  }

  return args;
}

function findFiles(rootDir) {
  const exts = new Set([".mdx", ".md", ".html"]);
  const results = [];

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) {
        continue;
      }

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (exts.has(ext)) {
          results.push(fullPath);
        }
      }
    }
  }

  walk(rootDir);
  return results;
}

function stripMdxComments(text) {
  return text.replace(MDX_COMMENT_BLOCK, "");
}

function countLinesUntil(text, index) {
  let lines = 1;
  for (let i = 0; i < index; i += 1) {
    if (text[i] === "\n") {
      lines += 1;
    }
  }
  return lines;
}

function extractCardHrefs(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch {
    content = fs.readFileSync(filePath, "latin1");
  }

  const processed = stripMdxComments(content);
  const hrefs = [];

  for (const match of processed.matchAll(CARD_HREF_REGEX)) {
    const href = (match.groups?.href || "").trim();
    const startIdx = match.index || 0;

    const windowStart = Math.max(0, startIdx - 200);
    const windowEnd = Math.min(content.length, startIdx + 200);
    const window = content.slice(windowStart, windowEnd);

    const hrefQuote = match[1] || '"';
    const needle = `href=${hrefQuote}${href}${hrefQuote}`;
    const localIdx = window.indexOf(needle);

    let lineNum;
    if (localIdx !== -1) {
      const absoluteIdx = windowStart + localIdx;
      lineNum = countLinesUntil(content, absoluteIdx);
    } else {
      lineNum = countLinesUntil(processed, startIdx);
    }

    hrefs.push([href, lineNum]);
  }

  return hrefs;
}

function isExternalUrl(href) {
  return href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:");
}

function normalizeInternalPath(href) {
  let url;
  try {
    url = new URL(href, "https://placeholder.local");
  } catch {
    return href.replace(/^\//, "");
  }
  const internalPath = url.pathname || "";
  return internalPath.startsWith("/") ? internalPath.slice(1) : internalPath;
}

function existsInternal(root, href) {
  const internalPath = normalizeInternalPath(href);
  const candidates = [
    path.join(root, internalPath),
    path.join(root, `${internalPath}.mdx`),
    path.join(root, `${internalPath}.md`),
    path.join(root, internalPath, "index.mdx"),
    path.join(root, internalPath, "index.md"),
  ];

  return candidates.some((candidate) => fs.existsSync(candidate));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkExternal(href, timeoutMs, maxRetries = 5, backoffBaseMs = 500) {
  if (href.startsWith("mailto:")) {
    return [true, "mailto link"];
  }

  if (href.includes("localhost")) {
    return [true, "Localhost link"];
  }

  if (href.startsWith("https://www.npmjs.com/package/@arizeai")) {
    return [true, "Arize NPM package"];
  }

  if (href === "https://arconia.io/docs/arconia/latest/observability/generative-ai/") {
    return [true, "Arconia returns 404 from actions, but is valid"];
  }

  if (href === "https://openai.com/") {
    return [true, "OpenAI returns 404 from actions, but is valid"];
  }

  const headers = {
    "User-Agent": "Mozilla/5.0 (compatible; LinkChecker/1.0; +https://github.com/)",
    Accept: "*/*",
    Connection: "close",
  };

  let lastReason = "";

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(href, {
        method: "HEAD",
        headers,
        redirect: "follow",
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.status >= 200 && res.status < 400) {
        return [true, `HTTP ${res.status}`];
      }
      if (res.status !== 405) {
        return [false, `HTTP ${res.status}`];
      }
    } catch (err) {
      lastReason = `HEAD failed: ${err?.message || String(err)}`;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(href, {
        method: "GET",
        headers: { ...headers, Range: "bytes=0-0" },
        redirect: "follow",
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.status >= 200 && res.status < 400) {
        return [true, `HTTP ${res.status}`];
      }
      lastReason = `HTTP ${res.status}`;
    } catch (err) {
      lastReason = `GET failed: ${err?.message || String(err)}`;
    }

    const jitter = Math.random() * 200;
    const waitMs = backoffBaseMs * (2 ** attempt) + jitter;
    await sleep(waitMs);
  }

  return [false, `Failed after ${maxRetries} retries: ${lastReason}`];
}

async function runWithConcurrency(items, limit, workerFn) {
  const results = new Array(items.length);
  let current = 0;

  async function worker() {
    while (current < items.length) {
      const idx = current;
      current += 1;
      results[idx] = await workerFn(items[idx], idx);
    }
  }

  const workers = [];
  const workerCount = Math.max(1, Math.min(limit, items.length || 1));
  for (let i = 0; i < workerCount; i += 1) {
    workers.push(worker());
  }
  await Promise.all(workers);

  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(args.root);
  const files = findFiles(repoRoot);

  const broken = [];
  const externalsToCheck = [];

  for (const filePath of files) {
    const hrefs = extractCardHrefs(filePath);
    if (hrefs.length === 0) {
      continue;
    }

    for (const [href, line] of hrefs) {
      if (isExternalUrl(href)) {
        externalsToCheck.push({ href, filePath, line });
      } else {
        if (!existsInternal(repoRoot, href)) {
          broken.push({
            file: filePath,
            line,
            href,
            reason: "File not found",
            kind: "internal",
          });
          continue;
        }

        let parsedPath = "";
        try {
          parsedPath = new URL(href, "https://placeholder.local").pathname || "";
        } catch {
          parsedPath = href;
        }

        if (parsedPath.toLowerCase().endsWith(".mdx")) {
          broken.push({
            file: filePath,
            line,
            href,
            reason: "Link points directly to a .mdx file; use a permalink or non-.mdx path",
            kind: "internal",
          });
        }
      }
    }
  }

  const start = Date.now();
  if (externalsToCheck.length > 0) {
    if (args.verbose) {
      console.log(`Checking ${externalsToCheck.length} external links...`);
    }

    const timeoutMs = Math.max(1, Math.floor(args.timeout * 1000));
    const checks = await runWithConcurrency(
      externalsToCheck,
      args.maxWorkers,
      async (item) => {
        const [ok, reason] = await checkExternal(item.href, timeoutMs, 5);
        return { ...item, ok, reason };
      }
    );

    for (const c of checks) {
      if (!c.ok) {
        broken.push({
          file: c.filePath,
          line: c.line,
          href: c.href,
          reason: c.reason,
          kind: "external",
        });
      }
    }
  }

  const durSeconds = (Date.now() - start) / 1000;

  if (broken.length > 0) {
    const brokenSorted = broken.sort((a, b) => {
      if (a.file !== b.file) return a.file.localeCompare(b.file);
      if (a.line !== b.line) return a.line - b.line;
      return a.href.localeCompare(b.href);
    });

    console.log("Broken links found:");
    for (const b of brokenSorted) {
      const relFile = path.relative(repoRoot, b.file);
      console.log(`- ${relFile}:${b.line}: [${b.kind}] ${b.href} -> ${b.reason}`);
    }

    if (args.githubAnnotations) {
      for (const b of brokenSorted) {
        const relFile = path.relative(repoRoot, b.file);
        console.log(`::error file=${relFile},line=${b.line}::[${b.kind}] ${b.href} -> ${b.reason}`);
      }
    }

    if (args.summaryFile) {
      try {
        const lines = [
          "# Broken Card links report\n",
          `Checked external links in ${durSeconds.toFixed(1)}s.\n\n`,
        ];

        let currentFile = null;
        for (const b of brokenSorted) {
          const relFile = path.relative(repoRoot, b.file);
          if (relFile !== currentFile) {
            if (currentFile !== null) {
              lines.push("\n");
            }
            lines.push(`## ${relFile}\n\n`);
            currentFile = relFile;
          }
          const hrefDisplay = b.kind === "external" ? `[${b.href}](${b.href})` : b.href;
          lines.push(`- Line ${b.line}: ${hrefDisplay} (${b.kind}) - ${b.reason}\n`);
        }

        fs.writeFileSync(args.summaryFile, lines.join(""), "utf8");
      } catch (err) {
        console.log(`Warning: failed to write summary file '${args.summaryFile}': ${err?.message || String(err)}`);
      }
    }

    console.log(`Total broken: ${broken.length} | Checked external links in ${durSeconds.toFixed(1)}s`);
    process.exitCode = 1;
    return;
  }

  const successMsg = `No broken Card links found. Checked external links in ${durSeconds.toFixed(1)}s`;
  if (args.githubAnnotations) {
    console.log(`::notice::${successMsg}`);
  }
  if (args.summaryFile) {
    try {
      fs.writeFileSync(args.summaryFile, `# Card links check\n\n${successMsg}\n`, "utf8");
    } catch (err) {
      console.log(`Warning: failed to write summary file '${args.summaryFile}': ${err?.message || String(err)}`);
    }
  }

  console.log(`✅ ${successMsg}`);
}

main().catch((err) => {
  console.error(`Fatal error: ${err?.stack || err?.message || String(err)}`);
  process.exitCode = 1;
});
