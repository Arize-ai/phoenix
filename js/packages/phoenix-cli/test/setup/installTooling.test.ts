/**
 * Tooling-install tests: CLI install offered only when `px` is missing, skills
 * install runs `npx skills add`, failures are non-fatal.
 */

import { describe, expect, it } from "vitest";

import * as COPY from "../../src/setup/copy";
import type { CommandSpec } from "../../src/setup/deps";
import { offerToolingInstalls } from "../../src/setup/steps/installTooling";
import { buildFakeDeps, scriptedPrompter } from "./fakes";

describe("offerToolingInstalls", () => {
  it("skips the CLI question when px is already on PATH", async () => {
    const prompter = scriptedPrompter([false /* no skills */]);
    const deps = buildFakeDeps({ prompter });

    await offerToolingInstalls(deps, {
      pxOnPath: Promise.resolve(true),
      canPrompt: true,
    });
    expect(prompter.transcript).toHaveLength(1);
    expect(prompter.transcript[0]).toContain(COPY.TOOLING.skills.message);
  });

  it("offers and runs the global CLI install when px is missing", async () => {
    const prompter = scriptedPrompter([true /* install CLI */, false]);
    const spawned: CommandSpec[] = [];
    const deps = buildFakeDeps({
      prompter,
      processes: {
        spawnInteractive: async (spec) => {
          spawned.push(spec);
          return { exitCode: 0 };
        },
      },
    });

    await offerToolingInstalls(deps, {
      pxOnPath: Promise.resolve(false),
      canPrompt: true,
    });
    expect(spawned).toHaveLength(1);
    expect(spawned[0]?.command).toBe("npm");
    expect(spawned[0]?.args).toEqual(["install", "-g", "@arizeai/phoenix-cli"]);
    expect(
      prompter.output.some((message) => message.includes("px CLI installed"))
    ).toBe(true);
  });

  it("installs the Phoenix skills via npx skills add", async () => {
    const prompter = scriptedPrompter([true /* install skills */]);
    const spawned: CommandSpec[] = [];
    const deps = buildFakeDeps({
      prompter,
      processes: {
        spawnInteractive: async (spec) => {
          spawned.push(spec);
          return { exitCode: 0 };
        },
      },
    });

    await offerToolingInstalls(deps, {
      pxOnPath: Promise.resolve(true),
      canPrompt: true,
    });
    expect(spawned).toHaveLength(1);
    expect(spawned[0]?.command).toBe("npx");
    expect(spawned[0]?.args).toEqual([
      "-y",
      "skills",
      "add",
      "Arize-ai/phoenix",
    ]);
  });

  it("a failed install warns with the retry command and completes", async () => {
    const prompter = scriptedPrompter([true]);
    const deps = buildFakeDeps({
      prompter,
      processes: { spawnInteractive: async () => ({ exitCode: 1 }) },
    });

    const result = await offerToolingInstalls(deps, {
      pxOnPath: Promise.resolve(true),
      canPrompt: true,
    });
    expect(result.skills).toBe("failed");
    expect(
      prompter.output.some((message) =>
        message.includes("npx skills add Arize-ai/phoenix")
      )
    ).toBe(true);
  });

  it("reports what each offer did", async () => {
    const prompter = scriptedPrompter([
      true /* install CLI */,
      false /* skills */,
    ]);
    const deps = buildFakeDeps({ prompter });

    const result = await offerToolingInstalls(deps, {
      pxOnPath: Promise.resolve(false),
      canPrompt: true,
    });
    expect(result).toEqual({ cli: "installed", skills: "declined" });
  });

  it("skips the CLI offer but installs the skills when it cannot prompt", async () => {
    const prompter = scriptedPrompter([]);
    const spawned: CommandSpec[] = [];
    const deps = buildFakeDeps({
      prompter,
      processes: {
        spawnInteractive: async (spec) => {
          spawned.push(spec);
          return { exitCode: 0 };
        },
      },
    });

    const result = await offerToolingInstalls(deps, {
      // `px` is missing, but installing a global package unattended is not ours
      // to decide — that offer is skipped rather than taken. The skills install
      // is the whole point of the unattended lane, so it defaults to going
      // ahead.
      pxOnPath: Promise.resolve(false),
      canPrompt: false,
    });
    expect(result).toEqual({ cli: "skipped", skills: "installed" });
    // `--yes` is the skills CLI's own: it is interactive by default, and a
    // missing TTY does not suppress its pickers — without the flag this spawn
    // would hang on stdin.
    expect(spawned.map((spec) => spec.args)).toEqual([
      ["-y", "skills", "add", "Arize-ai/phoenix", "--yes"],
    ]);
    expect(prompter.transcript).toEqual([]);
  });

  it("installs the skills unattended on an explicit --skills", async () => {
    const prompter = scriptedPrompter([]);
    const spawned: CommandSpec[] = [];
    const deps = buildFakeDeps({
      prompter,
      processes: {
        spawnInteractive: async (spec) => {
          spawned.push(spec);
          return { exitCode: 0 };
        },
      },
    });

    const result = await offerToolingInstalls(deps, {
      pxOnPath: Promise.resolve(true),
      skills: true,
      canPrompt: false,
    });
    expect(result).toEqual({ cli: "skipped", skills: "installed" });
    expect(prompter.transcript).toEqual([]);
    expect(spawned).toHaveLength(1);
    expect(spawned[0]?.args).toEqual([
      "-y",
      "skills",
      "add",
      "Arize-ai/phoenix",
      "--yes",
    ]);
  });

  it("--no-skills unattended records an explicit decline, silently", async () => {
    const prompter = scriptedPrompter([]);
    const spawned: CommandSpec[] = [];
    const deps = buildFakeDeps({
      prompter,
      processes: {
        spawnInteractive: async (spec) => {
          spawned.push(spec);
          return { exitCode: 0 };
        },
      },
    });

    const result = await offerToolingInstalls(deps, {
      pxOnPath: Promise.resolve(true),
      skills: false,
      canPrompt: false,
    });
    expect(result.skills).toBe("declined");
    expect(spawned).toEqual([]);
    expect(prompter.output).toEqual([]);
  });

  it("--no-skills declines without asking, even when it could prompt", async () => {
    const prompter = scriptedPrompter([]);
    const spawned: CommandSpec[] = [];
    const deps = buildFakeDeps({
      prompter,
      processes: {
        spawnInteractive: async (spec) => {
          spawned.push(spec);
          return { exitCode: 0 };
        },
      },
    });

    const result = await offerToolingInstalls(deps, {
      pxOnPath: Promise.resolve(true),
      skills: false,
      canPrompt: true,
    });
    expect(result.skills).toBe("declined");
    expect(prompter.transcript).toEqual([]);
    expect(spawned).toEqual([]);
  });
});
