import * as fs from "fs";
import { fileURLToPath } from "url";
import type { Command } from "commander";
import { describe, expect, it } from "vitest";

import { createSecretCommand } from "../src/commands/secret";

/**
 * Convention tests for the `secret` command tree: noun-verb structure,
 * `--help` examples that only use real flags, docs that stay in sync with
 * the option surface — and the security invariants that make these commands
 * safe to use with real credentials.
 */

const EXPECTED_SUBCOMMANDS = ["set", "delete"];

/** Subcommands that write data to stdout and must support output formats. */
const DATA_SUBCOMMANDS = ["set"];

function getSubcommands(): Map<string, Command> {
  return new Map(
    createSecretCommand().commands.map((command) => [command.name(), command])
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
 * Extract every `px secret <subcommand> ...` invocation from help or docs
 * text along with the flags it uses. Pipelines are split so each segment is
 * inspected on its own (`printf ... | px secret set KEY`).
 */
function extractExampleInvocations(text: string): ExampleInvocation[] {
  const joined = text.replace(/\\\n\s*/g, " ");
  const invocations: ExampleInvocation[] = [];
  for (const line of joined.split("\n")) {
    for (const segment of line.split("|")) {
      const match = segment.match(/px secret ([a-z-]+)(.*)/);
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

function assertInvocationsValid(
  invocations: ExampleInvocation[],
  source: string
): void {
  const subcommands = getSubcommands();
  const aliases = new Map(
    [...subcommands.values()].flatMap((command) =>
      command.aliases().map((alias) => [alias, command] as const)
    )
  );
  expect(
    invocations.length,
    `${source}: expected at least one example invocation`
  ).toBeGreaterThan(0);
  for (const { subcommand, flags } of invocations) {
    const command = subcommands.get(subcommand) ?? aliases.get(subcommand);
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
        `${source}: example uses flag '${flag}' which does not exist on 'secret ${subcommand}'`
      ).toBe(true);
    }
  }
}

describe("secret CLI conventions", () => {
  it("exposes set (aliased upsert) and delete", () => {
    const subcommands = getSubcommands();
    expect([...subcommands.keys()].sort()).toEqual(
      [...EXPECTED_SUBCOMMANDS].sort()
    );
    expect(subcommands.get("set")!.aliases()).toContain("upsert");
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
        `'${name}' --help examples must show a full 'px secret ${name}' invocation`
      ).toContain(`px secret ${name}`);
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

  it("delete supports -y/--yes for non-interactive use and documents the env gate", () => {
    const deleteCommand = getSubcommands().get("delete")!;
    const yesOption = deleteCommand.options.find(
      (option) => option.long === "--yes"
    );
    expect(yesOption).toBeDefined();
    expect(yesOption!.short).toBe("-y");
    expect(renderHelp(deleteCommand)).toContain(
      "PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES=true"
    );
  });

  describe("security invariants", () => {
    it("set never accepts a secret value through a flag", () => {
      const setCommand = getSubcommands().get("set")!;
      const longFlags = setCommand.options.map((option) => option.long);
      expect(longFlags).not.toContain("--value");
      expect(longFlags).not.toContain("--secret");
      // Every value-bearing flag names a *source*, never the value itself.
      expect(longFlags).toEqual(
        expect.arrayContaining(["--value-file", "--from-env", "--env-file"])
      );
    });

    it("set --help warns against putting secret values on the command line", () => {
      const help = renderHelp(getSubcommands().get("set")!);
      expect(help).toMatch(/never accepted as a command-line argument/i);
      expect(help).toMatch(/shell history/i);
      expect(help).toMatch(/\bps\b/);
    });

    it("no help example places a literal value in argv", () => {
      for (const [, command] of getSubcommands()) {
        for (const { subcommand, flags } of extractExampleInvocations(
          renderHelp(command)
        )) {
          expect(flags, `'${subcommand}' example uses --value`).not.toContain(
            "--value"
          );
        }
        expect(renderHelp(command)).not.toMatch(/px secret set \S+=\S+/);
      }
    });
  });
});
