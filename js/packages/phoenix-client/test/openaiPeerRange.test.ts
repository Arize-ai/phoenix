import { readFileSync } from "node:fs";
import invariant from "tiny-invariant";
import { describe, expect, test } from "vitest";

import type { SemanticVersion } from "../src/types/semver";
import {
  parseSemanticVersion,
  satisfiesMinVersion,
} from "../src/utils/semverUtils";

type OpenaiPeer = { peerDependencies: { openai: string } };
type PackageVersion = { version: string };

const readJson = <T>(relativePath: string): T =>
  JSON.parse(
    readFileSync(new URL(relativePath, import.meta.url), "utf-8")
  ) as T;

const manifest = readJson<OpenaiPeer>("../package.json");
const openaiPeerRange = manifest.peerDependencies.openai;

// The isolated pnpm layout symlinks every declared dependency into the
// package's own node_modules, so this is the exact copy that the
// `openai/resources` type imports resolve to.
const installedOpenai = readJson<PackageVersion>(
  "../node_modules/openai/package.json"
);

/**
 * Reports whether `version` satisfies a `^a.b.c || ^x.y.z` style range.
 *
 * Only caret clauses over stable (`>=1.0.0`) releases are understood, which
 * covers every range this file asserts on.
 */
const satisfiesCaretRange = (
  version: SemanticVersion,
  range: string
): boolean =>
  range.split("||").some((clause) => {
    const minVersion = parseSemanticVersion(clause.trim().replace(/^\^/, ""));
    return (
      minVersion != null &&
      minVersion[0] === version[0] &&
      satisfiesMinVersion({ version, minVersion })
    );
  });

/**
 * Guards the published `openai` peer range. Nothing else in the suite
 * exercises it: the package imports `openai` types only, so a range that has
 * drifted from what the package is actually built against still type checks
 * and tests clean while breaking installs for consumers.
 */
describe("the openai peer dependency range", () => {
  test("accepts both openai v6 and v7", () => {
    expect(satisfiesCaretRange([6, 10, 0], openaiPeerRange)).toBe(true);
    expect(satisfiesCaretRange([7, 5, 0], openaiPeerRange)).toBe(true);
  });

  test("accepts the openai version the package is built against", () => {
    const { version } = installedOpenai;
    const parsed = parseSemanticVersion(version);
    invariant(parsed, `Unparsable openai version: ${version}`);
    expect(satisfiesCaretRange(parsed, openaiPeerRange)).toBe(true);
  });
});
