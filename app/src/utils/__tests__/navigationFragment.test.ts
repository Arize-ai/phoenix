import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every navigation target must carry the URL fragment.
 *
 * The span filter condition lives in the fragment, and React Router reads an
 * omitted `hash` as an empty one, so a target built without it silently resets
 * the user's filter. The detail-path builders in `urlUtils` make that a compile
 * error by requiring `hash`, but an inline `to={{ pathname, search }}` bypasses
 * them, and four such links were missed one at a time during review.
 *
 * `no-restricted-syntax` would express this directly, but oxlint does not
 * implement it, so the check lives here instead: find every object literal that
 * names a `pathname` in a navigation position and require a `hash` beside it.
 * Pass an explicit `hash: ""` where a location genuinely has no fragment.
 */

const SRC = join(__dirname, "..", "..");
const NAVIGATION_STARTS = ["to={{", "navigate({", "to: {", "replace({"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "__generated__" ? [] : sourceFiles(path);
    }
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) {
      return [];
    }
    return [path];
  });
}

/** The object literal starting at `open`, found by matching braces. */
function objectLiteralAt(source: string, open: number): string {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") {
      depth++;
    } else if (source[i] === "}") {
      depth--;
      if (depth === 0) {
        return source.slice(open, i + 1);
      }
    }
  }
  return source.slice(open);
}

function targetsMissingHash(source: string): number[] {
  const lines: number[] = [];
  for (const start of NAVIGATION_STARTS) {
    let from = 0;
    for (;;) {
      const found = source.indexOf(start, from);
      if (found === -1) {
        break;
      }
      from = found + 1;
      const open = source.indexOf("{", found + start.length - 1);
      if (open === -1) {
        continue;
      }
      const literal = objectLiteralAt(source, open);
      // Only object-form targets declare a pathname; string paths go through
      // the builders, which require the fragment already.
      if (literal.includes("pathname") && !literal.includes("hash")) {
        lines.push(source.slice(0, found).split("\n").length);
      }
    }
  }
  return lines;
}

describe("navigation targets keep the URL fragment", () => {
  it("has no object-form target that omits hash", () => {
    const offenders = sourceFiles(SRC).flatMap((file) =>
      targetsMissingHash(readFileSync(file, "utf8")).map(
        (line) => `${relative(SRC, file)}:${line}`
      )
    );
    expect(offenders).toEqual([]);
  });

  it("recognizes a target that omits hash", () => {
    expect(
      targetsMissingHash(`<Link to={{ pathname: "/x", search: "?a=1" }} />`)
    ).toEqual([1]);
  });

  it("accepts a target that carries hash", () => {
    expect(
      targetsMissingHash(
        `<Link to={{ pathname: "/x", search: "?a=1", hash }} />`
      )
    ).toEqual([]);
  });
});
