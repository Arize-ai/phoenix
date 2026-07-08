import * as fs from "fs";
import { fileURLToPath } from "url";
import type { Command } from "commander";
import { describe, expect, it } from "vitest";

import { createAnnotationConfigCommand } from "../src/commands/annotationConfig";

/**
 * Convention tests for the `annotation-config` command tree, per the CLI
 * design spec (phoenix-cli-development skill): noun-verb structure, dual
 * audience (humans and coding agents), `--help` examples, and consistent
 * option surfaces. These exist to catch drift — a renamed flag, a dropped
 * example, or docs that reference options that no longer exist.
 */

const EXPECTED_SUBCOMMANDS = ["list", "get", "create", "update", "delete"];

/** Subcommands that write data to stdout and must support output formats. */
const DATA_SUBCOMMANDS = ["list", "get", "create", "update"];

function getSubcommands(): Map<string, Command> {
  return new Map(
    createAnnotationConfigCommand().commands.map((command) => [
      command.name(),
      command,
    ])
  );
}

/** Render a command's full help output, including addHelpText additions. */
function renderHelp(command: Command): string {
  let output = "";
  command.configureOutput({
    writeOut: (text: string) => {
      output += text;
    },
    writeErr: (text: string) => {
      output += text;
    },
  });
  command.outputHelp();
  return output;
}

interface ExampleInvocation {
  subcommand: string;
  flags: string[];
}

/**
 * Extract every `px annotation-config <subcommand> ...` invocation from a
 * block of text (help output or docs) along with the flags it uses, so
 * examples can be validated against the real option surface. Handles shell
 * line continuations and pipelines (each pipe segment is inspected
 * independently, so `... | xargs px annotation-config delete --yes` is
 * validated against `delete`).
 */
function extractExampleInvocations(text: string): ExampleInvocation[] {
  const joined = text.replace(/\\\n\s*/g, " ");
  const invocations: ExampleInvocation[] = [];
  for (const line of joined.split("\n")) {
    for (const segment of line.split("|")) {
      const match = segment.match(/px annotation-config ([a-z-]+)(.*)/);
      if (!match) {
        continue;
      }
      const flags = [...match[2].matchAll(/(?:^|\s)(--?[a-z][a-z-]*)/g)].map(
        (flagMatch) => flagMatch[1]
      );
      invocations.push({ subcommand: match[1], flags });
    }
  }
  return invocations;
}

/**
 * Assert every extracted invocation targets a real subcommand and only uses
 * flags that subcommand actually defines.
 */
function assertInvocationsValid(
  invocations: ExampleInvocation[],
  source: string
): void {
  const subcommands = getSubcommands();
  expect(
    invocations.length,
    `${source}: expected at least one example invocation`
  ).toBeGreaterThan(0);
  for (const { subcommand, flags } of invocations) {
    const command = subcommands.get(subcommand);
    expect(
      command,
      `${source}: example references unknown subcommand '${subcommand}'`
    ).toBeDefined();
    const knownFlags = new Set(
      command!.options.flatMap((option) =>
        [option.long, option.short].filter(Boolean)
      )
    );
    for (const flag of flags) {
      expect(
        knownFlags.has(flag),
        `${source}: example uses flag '${flag}' which does not exist on 'annotation-config ${subcommand}'`
      ).toBe(true);
    }
  }
}

describe("annotation-config CLI conventions", () => {
  it("exposes the full CRUD surface", () => {
    const names = [...getSubcommands().keys()].sort();
    expect(names).toEqual([...EXPECTED_SUBCOMMANDS].sort());
  });

  it("every subcommand has a description and a commented Examples block", () => {
    for (const [name, command] of getSubcommands()) {
      expect(
        command.description(),
        `'${name}' is missing a description`
      ).toBeTruthy();

      const help = renderHelp(command);
      expect(help, `'${name}' --help is missing an Examples block`).toContain(
        "Examples:"
      );
      expect(
        help,
        `'${name}' --help examples are missing '#' description comments`
      ).toMatch(/^ {2}# /m);
      expect(
        help,
        `'${name}' --help examples must show a full 'px annotation-config ${name}' invocation`
      ).toContain(`px annotation-config ${name}`);
    }
  });

  it("help examples only use flags that exist on the command they invoke", () => {
    for (const [name, command] of getSubcommands()) {
      assertInvocationsValid(
        extractExampleInvocations(renderHelp(command)),
        `--help for '${name}'`
      );
    }
  });

  it("README examples stay in sync with the option surface", () => {
    const readmePath = fileURLToPath(new URL("../README.md", import.meta.url));
    const readme = fs.readFileSync(readmePath, "utf8");
    assertInvocationsValid(extractExampleInvocations(readme), "README.md");
  });

  it("phoenix-cli skill examples stay in sync with the option surface", () => {
    const skillPath = fileURLToPath(
      new URL(
        "../../../../.agents/skills/phoenix-cli/SKILL.md",
        import.meta.url
      )
    );
    const skill = fs.readFileSync(skillPath, "utf8");
    assertInvocationsValid(extractExampleInvocations(skill), "SKILL.md");
  });

  it("every subcommand accepts --endpoint and --api-key", () => {
    for (const [name, command] of getSubcommands()) {
      const longFlags = command.options.map((option) => option.long);
      expect(longFlags, `'${name}' is missing --endpoint`).toContain(
        "--endpoint"
      );
      expect(longFlags, `'${name}' is missing --api-key`).toContain(
        "--api-key"
      );
    }
  });

  it("data-returning subcommands support --format (default pretty) and --no-progress", () => {
    const subcommands = getSubcommands();
    for (const name of DATA_SUBCOMMANDS) {
      const command = subcommands.get(name)!;
      const formatOption = command.options.find(
        (option) => option.long === "--format"
      );
      expect(formatOption, `'${name}' is missing --format`).toBeDefined();
      expect(
        formatOption!.defaultValue,
        `'${name}' --format must default to pretty`
      ).toBe("pretty");
      expect(
        command.options.map((option) => option.long),
        `'${name}' is missing --no-progress`
      ).toContain("--no-progress");
    }
  });

  it("create and update share the categorical value input surface", () => {
    const subcommands = getSubcommands();
    for (const name of ["create", "update"]) {
      const longFlags = subcommands.get(name)!.options.map((o) => o.long);
      expect(longFlags, `'${name}' is missing --value`).toContain("--value");
      expect(longFlags, `'${name}' is missing --values`).toContain("--values");
    }
  });

  it("delete supports -y/--yes for non-interactive use", () => {
    const deleteCommand = getSubcommands().get("delete")!;
    const yesOption = deleteCommand.options.find(
      (option) => option.long === "--yes"
    );
    expect(yesOption).toBeDefined();
    expect(yesOption!.short).toBe("-y");
  });
});
