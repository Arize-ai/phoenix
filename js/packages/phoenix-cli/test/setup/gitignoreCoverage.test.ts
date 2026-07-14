import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  GITIGNORE_BANNER,
  ensureGitignored,
} from "../../src/setup/util/gitignoreCoverage";

const FILES = [".env.phoenix", ".env.phoenix.local"];

describe("ensureGitignored", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "px-setup-gitignore-"));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function readGitignore(): string {
    return fs.readFileSync(path.join(dir, ".gitignore"), "utf-8");
  }

  it("appends uncovered names under the banner", () => {
    fs.writeFileSync(path.join(dir, ".gitignore"), "node_modules\n");
    const result = ensureGitignored({
      directory: dir,
      filenames: FILES,
      isGitRepository: true,
    });
    expect(result.appended).toEqual(FILES);
    const content = readGitignore();
    expect(content).toContain(GITIGNORE_BANNER);
    expect(content).toContain(".env.phoenix");
    expect(content.endsWith("\n")).toBe(true);
    expect(content.endsWith("\n\n")).toBe(false);
  });

  it("does not append names already covered by patterns like .env*", () => {
    fs.writeFileSync(
      path.join(dir, ".gitignore"),
      ".env*\n.env.phoenix.local\n"
    );
    const result = ensureGitignored({
      directory: dir,
      filenames: FILES,
      isGitRepository: true,
    });
    expect(result.appended).toEqual([]);
    expect(readGitignore()).not.toContain(GITIGNORE_BANNER);
  });

  it("respects negation patterns (a re-included file is uncovered)", () => {
    fs.writeFileSync(
      path.join(dir, ".gitignore"),
      ".env*\n!.env.phoenix\n.env.phoenix.local\n"
    );
    const result = ensureGitignored({
      directory: dir,
      filenames: FILES,
      isGitRepository: true,
    });
    expect(result.appended).toEqual([".env.phoenix"]);
  });

  it("terminates an unterminated final line before appending", () => {
    fs.writeFileSync(path.join(dir, ".gitignore"), "node_modules");
    ensureGitignored({
      directory: dir,
      filenames: FILES,
      isGitRepository: true,
    });
    const content = readGitignore();
    expect(content).toContain(`node_modules\n\n${GITIGNORE_BANNER}`);
  });

  it("creates a .gitignore in a repo that has none", () => {
    const result = ensureGitignored({
      directory: dir,
      filenames: FILES,
      isGitRepository: true,
    });
    expect(result.appended).toEqual(FILES);
    expect(readGitignore().startsWith(GITIGNORE_BANNER)).toBe(true);
  });

  it("skips silently outside a git repo when no .gitignore exists", () => {
    const result = ensureGitignored({
      directory: dir,
      filenames: FILES,
      isGitRepository: false,
    });
    expect(result.appended).toEqual([]);
    expect(fs.existsSync(path.join(dir, ".gitignore"))).toBe(false);
  });
});
