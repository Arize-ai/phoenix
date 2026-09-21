#!/usr/bin/env node
/**
 * `oxlint-jev` — lint only the changed files that import Phoenix,
 * OpenInference or OpenTelemetry packages.
 *
 *   oxlint-jev [--base <git ref>] [-- <extra oxlint args>]
 *
 * Changed = diff against --base (default origin/main) plus the working tree
 * and untracked files. A cheap regex over each file's text is the first gate;
 * the plugin then performs the real import analysis on the AST.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const IMPORT_GATE =
  /(from\s+|require\(|import\()\s*["'](@arizeai\/(phoenix-otel|phoenix-client|openinference-)|@opentelemetry\/)/;
const LINTABLE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

function git(args: string[]): string[] {
  try {
    return execFileSync("git", args, { encoding: "utf8" })
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function main(): number {
  const argv = process.argv.slice(2);
  let base = "origin/main";
  const passthrough: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--base") base = argv[++i] ?? base;
    else if (arg === "--") {
      passthrough.push(...argv.slice(i + 1));
      break;
    } else passthrough.push(arg ?? "");
  }
  const root = git(["rev-parse", "--show-toplevel"])[0] ?? process.cwd();
  const changed = new Set<string>([
    ...git(["diff", "--name-only", "--diff-filter=ACMR", `${base}...HEAD`]),
    ...git(["diff", "--name-only", "--diff-filter=ACMR"]),
    ...git(["ls-files", "--others", "--exclude-standard"]),
  ]);
  const files = [...changed]
    .filter((f) => LINTABLE.test(f))
    .map((f) => path.resolve(root, f))
    .filter((f) => existsSync(f) && IMPORT_GATE.test(readFileSync(f, "utf8")));

  if (files.length === 0) {
    process.stdout.write(
      "oxlint-jev: no changed files import Phoenix/OpenInference/OpenTelemetry packages.\n"
    );
    return 0;
  }
  process.stdout.write(`oxlint-jev: ${files.length} candidate file(s)\n`);

  let oxlintBin = "oxlint";
  try {
    const require = createRequire(import.meta.url);
    const pkgDir = path.dirname(require.resolve("oxlint/package.json"));
    const bin = (
      require("oxlint/package.json") as {
        bin?: Record<string, string> | string;
      }
    ).bin;
    const rel = typeof bin === "string" ? bin : bin?.oxlint;
    if (rel) oxlintBin = path.join(pkgDir, rel);
  } catch {
    // fall back to PATH
  }
  const result = spawnSync(oxlintBin, [...passthrough, ...files], {
    stdio: "inherit",
  });
  return result.status ?? 1;
}

process.exit(main());
