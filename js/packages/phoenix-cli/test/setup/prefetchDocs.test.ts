/**
 * Docs-prefetch tests: off by flag, gitignored on success, and never fatal —
 * a docs site that is down degrades to the agent fetching pages itself.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type {
  DocsPrefetchOptions,
  DocsPrefetchResult,
} from "../../src/setup/deps";
import { prefetchDocs } from "../../src/setup/steps/prefetchDocs";
import { buildFakeDeps, scriptedPrompter } from "./fakes";

describe("prefetchDocs", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "px-docs-"));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function gitignore(): string {
    const file = path.join(dir, ".gitignore");
    return fs.existsSync(file) ? fs.readFileSync(file, "utf-8") : "";
  }

  it("does nothing when the prefetch is disabled", async () => {
    const prompter = scriptedPrompter([]);
    const calls: DocsPrefetchOptions[] = [];
    const deps = buildFakeDeps({
      context: { cwd: dir },
      prompter,
      fetchDocs: async (options) => {
        calls.push(options);
        throw new Error("fetchDocs must not be called");
      },
    });

    const result = await prefetchDocs(deps, {
      docs: { enabled: false },
      isGitRepository: true,
    });

    expect(result).toBeUndefined();
    expect(calls).toEqual([]);
    expect(prompter.output).toEqual([]);
    expect(gitignore()).toBe("");
  });

  it("downloads the docs, reports them, and gitignores .px/", async () => {
    const prompter = scriptedPrompter([]);
    const calls: DocsPrefetchOptions[] = [];
    const downloaded: DocsPrefetchResult = {
      outputDir: ".px/docs",
      workflows: ["tracing"],
      written: 7,
      failed: 0,
      hasPagesOnDisk: true,
    };
    const deps = buildFakeDeps({
      context: { cwd: dir },
      prompter,
      fetchDocs: async (options) => {
        calls.push(options);
        return downloaded;
      },
    });

    const result = await prefetchDocs(deps, {
      docs: { enabled: true, workflows: ["tracing"], refresh: true },
      isGitRepository: true,
    });

    expect(result).toMatchObject(downloaded);
    expect(calls).toEqual([
      { enabled: true, workflows: ["tracing"], refresh: true },
    ]);
    expect(gitignore()).toContain(".px/");
    expect(
      prompter.output.some((message) =>
        message.includes("Downloaded 7 doc page(s) to .px/docs")
      )
    ).toBe(true);
  });

  it("leaves .gitignore alone outside a git repository", async () => {
    const deps = buildFakeDeps({ context: { cwd: dir } });

    expect(
      await prefetchDocs(deps, {
        docs: { enabled: true },
        isGitRepository: false,
      })
    ).toBeDefined();
    expect(fs.existsSync(path.join(dir, ".gitignore"))).toBe(false);
  });

  it("adds no duplicate when .px/ is already covered", async () => {
    fs.writeFileSync(path.join(dir, ".gitignore"), ".px/\n", "utf-8");
    const deps = buildFakeDeps({ context: { cwd: dir } });

    await prefetchDocs(deps, {
      docs: { enabled: true },
      isGitRepository: true,
    });

    expect(gitignore()).toBe(".px/\n");
  });

  it("a failed download is a warning, not a failure", async () => {
    const prompter = scriptedPrompter([]);
    const deps = buildFakeDeps({
      context: { cwd: dir },
      prompter,
      fetchDocs: async () => {
        throw new Error("docs site is down");
      },
    });

    const result = await prefetchDocs(deps, {
      docs: { enabled: true },
      isGitRepository: true,
    });

    expect(result).toBeUndefined();
    expect(
      prompter.output.some((message) =>
        message.includes("Couldn't download the docs (docs site is down)")
      )
    ).toBe(true);
  });
});
