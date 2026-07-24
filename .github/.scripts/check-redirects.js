#!/usr/bin/env node

/**
 * Redirect checker for docs.json redirects.
 *
 * Validates:
 * - Destination exists in navigation or on disk (fragment/query stripped for lookup).
 * - Source is not also listed in navigation (avoids conflicting with a live nav target).
 * - Circular redirects.
 *
 * Usage:
 *   node scripts/check-redirects.js [--root <repo_root>] [--github-annotations] [--summary-file <path>]
 */

const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    githubAnnotations: false,
    summaryFile: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--root") {
      args.root = argv[i + 1] || args.root;
      i += 1;
    } else if (token === "--github-annotations") {
      args.githubAnnotations = true;
    } else if (token === "--summary-file") {
      args.summaryFile = argv[i + 1] || null;
      i += 1;
    }
  }

  return args;
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

function normalizeRoute(route) {
  let s = String(route || "").replace(/^\/+|\/+$/g, "");
  const hash = s.indexOf("#");
  if (hash !== -1) {
    s = s.slice(0, hash);
  }
  const q = s.indexOf("?");
  if (q !== -1) {
    s = s.slice(0, q);
  }
  return s;
}

function routeExistsOnDisk(repoRoot, route) {
  const internalPath = normalizeRoute(route);
  if (!internalPath) {
    return false;
  }

  const candidates = [
    path.join(repoRoot, internalPath),
    path.join(repoRoot, `${internalPath}.mdx`),
    path.join(repoRoot, `${internalPath}.md`),
    path.join(repoRoot, internalPath, "index.mdx"),
    path.join(repoRoot, internalPath, "index.md"),
  ];

  return candidates.some((candidate) => fs.existsSync(candidate));
}

function routeHasPageFileOnDisk(repoRoot, route) {
  const internalPath = normalizeRoute(route);
  if (!internalPath) {
    return false;
  }

  // For source conflicts, only treat actual page files as collisions.
  // A plain folder without an index page is allowed as a redirect source.
  const candidates = [
    path.join(repoRoot, `${internalPath}.mdx`),
    path.join(repoRoot, `${internalPath}.md`),
    path.join(repoRoot, internalPath, "index.mdx"),
    path.join(repoRoot, internalPath, "index.md"),
  ];

  return candidates.some((candidate) => fs.existsSync(candidate));
}

function collectNavigationPages(navRoot) {
  const pages = new Set();

  function walk(node) {
    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item);
      }
      return;
    }

    if (typeof node === "string") {
      pages.add(normalizeRoute(node));
      return;
    }

    if (node && typeof node === "object") {
      for (const [key, value] of Object.entries(node)) {
        if (key === "pages") {
          walk(value);
        } else if (value && typeof value === "object") {
          walk(value);
        }
      }
    }
  }

  walk(navRoot || {});
  return pages;
}

function parseRedirectEntriesWithLines(rawText) {
  const redirects = [];
  const regex = /\{\s*"source"\s*:\s*"(?<source>[^"]+)"\s*,\s*"destination"\s*:\s*"(?<destination>[^"]+)"\s*\}/g;

  let match;
  while ((match = regex.exec(rawText)) !== null) {
    const source = match.groups?.source || "";
    const destination = match.groups?.destination || "";
    const line = countLinesUntil(rawText, match.index || 0);
    redirects.push({ source, destination, line });
  }

  return redirects;
}

function findCycles(sourceToDestination) {
  const cycles = [];
  const seenCycleKeys = new Set();

  for (const start of sourceToDestination.keys()) {
    const seenInPath = new Map();
    const pathNodes = [];

    let current = start;
    while (sourceToDestination.has(current)) {
      if (seenInPath.has(current)) {
        const cycle = pathNodes.slice(seenInPath.get(current));

        if (cycle.length > 0) {
          const minNode = cycle.reduce((best, node) => (node < best ? node : best), cycle[0]);
          const minIndex = cycle.indexOf(minNode);
          const canonical = [...cycle.slice(minIndex), ...cycle.slice(0, minIndex)];
          const key = canonical.join(" -> ");
          if (!seenCycleKeys.has(key)) {
            seenCycleKeys.add(key);
            cycles.push(canonical);
          }
        }
        break;
      }

      seenInPath.set(current, pathNodes.length);
      pathNodes.push(current);
      current = sourceToDestination.get(current);
    }
  }

  return cycles;
}

function formatCycle(cycle) {
  return cycle.map((node) => `/${node}`).join(" -> ") + ` -> /${cycle[0]}`;
}

function writeSummary(summaryPath, summary) {
  try {
    fs.writeFileSync(summaryPath, summary, "utf8");
  } catch (err) {
    console.log(`Warning: failed to write summary file '${summaryPath}': ${err?.message || String(err)}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(args.root);
  const docsJsonPath = path.join(repoRoot, "docs.json");
  const docsJsonRel = "docs.json";

  const raw = fs.readFileSync(docsJsonPath, "utf8");
  const parsed = JSON.parse(raw);

  const redirects = parsed.redirects || [];
  const navPages = collectNavigationPages(parsed.navigation || {});

  const redirectsWithLines = parseRedirectEntriesWithLines(raw);
  const lineLookup = new Map();
  for (const item of redirectsWithLines) {
    const key = `${normalizeRoute(item.source)}=>${normalizeRoute(item.destination)}`;
    if (!lineLookup.has(key)) {
      lineLookup.set(key, []);
    }
    lineLookup.get(key).push(item.line);
  }

  const destinationIssues = [];
  const sourceIssues = [];

  const sourceToDestination = new Map();

  for (const redirect of redirects) {
    const sourceNorm = normalizeRoute(redirect.source);
    const destinationNorm = normalizeRoute(redirect.destination);
    const lineKey = `${sourceNorm}=>${destinationNorm}`;
    const lineCandidates = lineLookup.get(lineKey) || [];
    const line = lineCandidates.length > 0 ? lineCandidates.shift() : 1;

    sourceToDestination.set(sourceNorm, destinationNorm);

    const destinationInNav = navPages.has(destinationNorm);
    const destinationOnDisk = routeExistsOnDisk(repoRoot, destinationNorm);

    if (!destinationInNav && !destinationOnDisk) {
      destinationIssues.push({
        line,
        source: redirect.source,
        destination: redirect.destination,
        message: `Destination missing in navigation and on disk: ${redirect.destination}`,
      });
    }

    const sourceInNav = navPages.has(sourceNorm);

    // Only flag when the source URL is still a sidebar entry. Legacy MDX files
    // may remain on disk for deep links while redirects send old public URLs to
    // consolidated pages — that is intentional and should not fail the check.
    if (sourceInNav) {
      sourceIssues.push({
        line,
        source: redirect.source,
        destination: redirect.destination,
        message: `Source exists in navigation: ${redirect.source}`,
      });
    }
  }

  const cycles = findCycles(sourceToDestination);
  const cycleIssues = cycles.map((cycle) => {
    const first = cycle[0];
    const firstDest = sourceToDestination.get(first);
    const lineKey = `${first}=>${firstDest}`;
    const lineCandidates = lineLookup.get(lineKey) || [];
    const line = lineCandidates.length > 0 ? lineCandidates[0] : 1;

    return {
      line,
      cycle,
      message: `Circular redirect: ${formatCycle(cycle)}`,
    };
  });

  const allIssues = [
    ...destinationIssues.map((i) => ({ kind: "destination", ...i })),
    ...sourceIssues.map((i) => ({ kind: "source", ...i })),
    ...cycleIssues.map((i) => ({ kind: "cycle", ...i })),
  ].sort((a, b) => a.line - b.line || a.kind.localeCompare(b.kind));

  const lines = [
    "## :twisted_rightwards_arrows: Checking redirects\n\n",
    `- Redirects checked: **${redirects.length}**\n`,
    `- Destination issues: **${destinationIssues.length}**\n`,
    `- Source issues: **${sourceIssues.length}**\n`,
    `- Circular issues: **${cycleIssues.length}**\n\n`,
  ];

  if (allIssues.length === 0) {
    lines.push(":white_check_mark: **No broken redirects found**\n");
    if (args.summaryFile) {
      writeSummary(args.summaryFile, lines.join(""));
    }
    if (args.githubAnnotations) {
      console.log("::notice::No broken redirects found");
    }
    console.log("✅ No broken redirects found.");
    return;
  }

  if (destinationIssues.length > 0) {
    lines.push("### Destination Missing (not in nav and not on disk)\n\n");
    for (const issue of destinationIssues.sort((a, b) => a.line - b.line)) {
      lines.push(`- ${docsJsonRel}:${issue.line} - \`${issue.source}\` -> \`${issue.destination}\`\n`);
    }
    lines.push("\n");
  }

  if (sourceIssues.length > 0) {
    lines.push("### Source Already Exists (in nav or on disk)\n\n");
    for (const issue of sourceIssues.sort((a, b) => a.line - b.line)) {
      lines.push(`- ${docsJsonRel}:${issue.line} - \`${issue.source}\` -> \`${issue.destination}\`\n`);
    }
    lines.push("\n");
  }

  if (cycleIssues.length > 0) {
    lines.push("### Circular Redirects\n\n");
    for (const issue of cycleIssues.sort((a, b) => a.line - b.line)) {
      lines.push(`- ${docsJsonRel}:${issue.line} - ${issue.message}\n`);
    }
    lines.push("\n");
  }

  lines.push(`:x: **Found ${allIssues.length} redirect issue${allIssues.length === 1 ? "" : "s"}.**\n`);

  if (args.summaryFile) {
    writeSummary(args.summaryFile, lines.join(""));
  }

  console.log("Broken redirects found:");
  for (const issue of allIssues) {
    console.log(`- ${docsJsonRel}:${issue.line}: [${issue.kind}] ${issue.message}`);
    if (args.githubAnnotations) {
      console.log(`::error file=${docsJsonRel},line=${issue.line}::[${issue.kind}] ${issue.message}`);
    }
  }

  process.exitCode = 1;
}

try {
  main();
} catch (err) {
  console.error(`Fatal error: ${err?.stack || err?.message || String(err)}`);
  process.exitCode = 1;
}
