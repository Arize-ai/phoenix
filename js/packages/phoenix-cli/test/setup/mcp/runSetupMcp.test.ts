/**
 * `runSetupMcp` orchestration: endpoint inference, scope/agent resolution, and
 * the two install mechanisms. CLI agents are driven through an exec spy; file
 * agents write real temp dirs (global under a fake HOME, local under the cwd).
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { formatMcpSetupOutput } from "../../../src/commands/formatSetup";
import type { CommandSpec, ExecResult } from "../../../src/setup/deps";
import { HeadlessInputError, SetupFatalError } from "../../../src/setup/errors";
import {
  runSetupMcp,
  type McpSetupInputs,
} from "../../../src/setup/mcp/runSetupMcp";
import { buildFakeDeps, scriptedPrompter } from "../fakes";

const ENDPOINT = "http://localhost:6006";

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

/**
 * exec fake: `git rev-parse --show-toplevel` answers with the repo root
 * (`gitTopLevel`, defaulting to the exec's own cwd); every agent CLI call
 * exits 0.
 */
function agentExecFake(
  calls: CommandSpec[],
  gitTopLevel?: string
): (spec: CommandSpec) => Promise<ExecResult> {
  return async (spec) => {
    calls.push(spec);
    if (spec.command === "git") {
      return {
        exitCode: 0,
        stdout: `${gitTopLevel ?? spec.cwd ?? ""}\n`,
        stderr: "",
      };
    }
    return { exitCode: 0, stdout: "", stderr: "" };
  };
}

function inputs(overrides: Partial<McpSetupInputs>): McpSetupInputs {
  return {
    endpoint: ENDPOINT,
    endpointExplicit: true,
    headers: [],
    headless: true,
    ...overrides,
  };
}

describe("runSetupMcp", () => {
  let home: string;
  let repo: string;

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), "px-mcp-home-"));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), "px-mcp-repo-"));
  });
  afterEach(() => {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  });

  describe("CLI agents", () => {
    it("registers codex globally via `codex mcp add --url …/mcp`", async () => {
      const calls: CommandSpec[] = [];
      const deps = buildFakeDeps({
        context: { cwd: repo, env: { HOME: home } },
        processes: { exec: agentExecFake(calls) },
      });

      const report = await runSetupMcp(
        deps,
        inputs({ agent: "codex", scope: "global" })
      );

      expect(report).toEqual({
        endpoint: ENDPOINT,
        url: `${ENDPOINT}/mcp`,
        serverName: "phoenix",
        agent: "codex",
        scope: "global",
        auth: "oauth",
      });
      const add = calls.find(
        (c) => c.command === "codex" && c.args[1] === "add"
      );
      expect(add?.args).toEqual([
        "mcp",
        "add",
        "phoenix",
        "--url",
        `${ENDPOINT}/mcp`,
      ]);
    });

    it("registers claude locally via --scope project, running in the repo", async () => {
      const calls: CommandSpec[] = [];
      const deps = buildFakeDeps({
        context: { cwd: repo, env: { HOME: home } },
        processes: { exec: agentExecFake(calls) },
      });

      const report = await runSetupMcp(
        deps,
        inputs({ agent: "claude", scope: "local" })
      );

      expect(report.scope).toBe("local");
      const claudeCalls = calls.filter((c) => c.command === "claude");
      expect(claudeCalls[0]?.args).toContain("project");
      // A --scope project add must land in this repo, not px's launch dir.
      expect(claudeCalls.every((c) => c.cwd === repo)).toBe(true);
      // The read-back confirms the entry landed.
      expect(claudeCalls.some((c) => c.args[1] === "get")).toBe(true);
    });

    it("translates a bearer header to codex's --bearer-token-env-var and reports header auth", async () => {
      const calls: CommandSpec[] = [];
      const deps = buildFakeDeps({
        context: { cwd: repo, env: { HOME: home } },
        processes: { exec: agentExecFake(calls) },
      });

      const report = await runSetupMcp(
        deps,
        inputs({
          agent: "codex",
          scope: "global",
          headers: [
            { name: "Authorization", value: "Bearer ${PHOENIX_API_KEY}" },
          ],
        })
      );

      expect(report.auth).toBe("header");
      const add = calls.find((c) => c.args[1] === "add");
      expect(add?.args).toContain("--bearer-token-env-var");
      expect(add?.args).toContain("PHOENIX_API_KEY");
    });

    it("refuses a header codex can't store instead of silently dropping it", async () => {
      const calls: CommandSpec[] = [];
      const deps = buildFakeDeps({
        context: { cwd: repo, env: { HOME: home } },
        processes: { exec: agentExecFake(calls) },
      });

      // A non-Authorization header (and a literal bearer token) can't survive
      // `codex mcp add`, so the run must error rather than write a config that
      // claims header auth but carries no credential.
      await expect(
        runSetupMcp(
          deps,
          inputs({
            agent: "codex",
            scope: "global",
            headers: [{ name: "X-Api-Key", value: "abc123" }],
          })
        )
      ).rejects.toBeInstanceOf(HeadlessInputError);
      // Nothing was added — we stopped before the install ran.
      expect(calls.some((c) => c.args[1] === "add")).toBe(false);
    });

    it("fails when the read-back never shows the entry", async () => {
      const deps = buildFakeDeps({
        context: { cwd: repo, env: { HOME: home } },
        processes: {
          exec: async (spec) =>
            spec.args[1] === "get"
              ? { exitCode: 1, stdout: "", stderr: "not found" }
              : { exitCode: 0, stdout: "", stderr: "" },
        },
      });

      await expect(
        runSetupMcp(deps, inputs({ agent: "claude", scope: "global" }))
      ).rejects.toBeInstanceOf(SetupFatalError);
    });
  });

  describe("file agents", () => {
    it("writes cursor's global config under HOME, preserving other servers", async () => {
      const cursorConfig = path.join(home, ".cursor", "mcp.json");
      fs.mkdirSync(path.dirname(cursorConfig), { recursive: true });
      fs.writeFileSync(
        cursorConfig,
        JSON.stringify({ mcpServers: { mine: { command: "my-mcp" } } })
      );
      const deps = buildFakeDeps({
        context: { cwd: repo, env: { HOME: home } },
      });

      const report = await runSetupMcp(
        deps,
        inputs({ agent: "cursor", scope: "global" })
      );

      expect(report.file).toBe("~/.cursor/mcp.json");
      expect(readJson(cursorConfig)).toEqual({
        mcpServers: {
          mine: { command: "my-mcp" },
          phoenix: { url: `${ENDPOINT}/mcp` },
        },
      });
    });

    it("writes vscode's workspace file under the repo with a bearer header", async () => {
      const deps = buildFakeDeps({
        context: { cwd: repo, env: { HOME: home } },
        // Local scope: the git-repo guard must see a repo.
        processes: { exec: agentExecFake([]) },
      });

      const report = await runSetupMcp(
        deps,
        inputs({
          agent: "vscode",
          scope: "local",
          headers: [
            { name: "Authorization", value: "Bearer ${PHOENIX_API_KEY}" },
          ],
        })
      );

      expect(report.file).toBe(".vscode/mcp.json");
      expect(readJson(path.join(repo, ".vscode", "mcp.json"))).toEqual({
        servers: {
          phoenix: {
            type: "http",
            url: `${ENDPOINT}/mcp`,
            headers: { Authorization: "Bearer ${PHOENIX_API_KEY}" },
          },
        },
      });
    });

    it("writes a local config at the repo root when run from a subdirectory", async () => {
      const subdirectory = path.join(repo, "packages", "app");
      fs.mkdirSync(subdirectory, { recursive: true });
      const deps = buildFakeDeps({
        context: { cwd: subdirectory, env: { HOME: home } },
        processes: { exec: agentExecFake([], repo) },
      });

      const report = await runSetupMcp(
        deps,
        inputs({ agent: "cursor", scope: "local" })
      );

      expect(report.file).toBe(".cursor/mcp.json");
      expect(fs.existsSync(path.join(repo, ".cursor", "mcp.json"))).toBe(true);
      expect(
        fs.existsSync(path.join(subdirectory, ".cursor", "mcp.json"))
      ).toBe(false);
    });

    it("errors clearly when no home directory is known for a global file install", async () => {
      const deps = buildFakeDeps({
        context: { cwd: repo, env: {} },
      });
      await expect(
        runSetupMcp(deps, inputs({ agent: "cursor", scope: "global" }))
      ).rejects.toThrow(/home directory/);
    });

    it("re-running a file install is idempotent", async () => {
      const run = () =>
        runSetupMcp(
          buildFakeDeps({
            context: { cwd: repo, env: { HOME: home } },
            processes: { exec: agentExecFake([]) },
          }),
          inputs({ agent: "opencode", scope: "local" })
        );
      await run();
      const configPath = path.join(repo, "opencode.json");
      const first = fs.readFileSync(configPath, "utf-8");
      await run();
      expect(fs.readFileSync(configPath, "utf-8")).toBe(first);
    });
  });

  describe("endpoint", () => {
    it("appends /mcp and strips a trailing slash", async () => {
      const deps = buildFakeDeps({
        context: { cwd: repo, env: { HOME: home } },
      });
      const report = await runSetupMcp(
        deps,
        inputs({
          agent: "cursor",
          scope: "global",
          endpoint: "https://phoenix.example.com/",
        })
      );
      expect(report.url).toBe("https://phoenix.example.com/mcp");
    });

    it("refuses a headless endpoint that is not an http(s) URL as bad input", async () => {
      const deps = buildFakeDeps({
        context: { cwd: repo, env: { HOME: home } },
      });
      // e.g. a scheme-less PHOENIX_HOST, which nothing upstream validates.
      await expect(
        runSetupMcp(
          deps,
          inputs({
            agent: "cursor",
            scope: "global",
            endpoint: "localhost:6006",
            endpointExplicit: false,
          })
        )
      ).rejects.toBeInstanceOf(HeadlessInputError);
    });
  });

  describe("scope reconciliation", () => {
    it("errors when --local names codex, which is global-only (headless)", async () => {
      const deps = buildFakeDeps({
        context: { cwd: repo, env: { HOME: home } },
        processes: { exec: agentExecFake([]) },
      });
      await expect(
        runSetupMcp(deps, inputs({ agent: "codex", scope: "local" }))
      ).rejects.toBeInstanceOf(HeadlessInputError);
    });

    it("falls back to global for codex --local interactively, telling the user", async () => {
      const prompter = scriptedPrompter([]);
      const deps = buildFakeDeps({
        context: { cwd: repo, env: { HOME: home } },
        prompter,
        processes: { exec: agentExecFake([]) },
      });
      const report = await runSetupMcp(
        deps,
        inputs({ agent: "codex", scope: "local", headless: false })
      );
      expect(report.scope).toBe("global");
      expect(prompter.output.some((m) => m.includes("Codex"))).toBe(true);
    });

    it("errors on --local outside a git repository", async () => {
      const deps = buildFakeDeps({
        context: { cwd: repo, env: { HOME: home } },
        processes: {
          exec: async (spec) =>
            spec.command === "git"
              ? { exitCode: 128, stdout: "", stderr: "not a repo" }
              : { exitCode: 0, stdout: "", stderr: "" },
        },
      });
      await expect(
        runSetupMcp(deps, inputs({ agent: "cursor", scope: "local" }))
      ).rejects.toBeInstanceOf(HeadlessInputError);
    });
  });

  describe("headless", () => {
    it("requires an agent", async () => {
      const deps = buildFakeDeps({
        context: { cwd: repo, env: { HOME: home } },
      });
      await expect(
        runSetupMcp(deps, inputs({ agent: undefined }))
      ).rejects.toBeInstanceOf(HeadlessInputError);
    });

    it("defaults the scope to global", async () => {
      const deps = buildFakeDeps({
        context: { cwd: repo, env: { HOME: home } },
      });
      const report = await runSetupMcp(
        deps,
        inputs({ agent: "cursor", scope: undefined })
      );
      expect(report.scope).toBe("global");
    });
  });

  describe("interactive", () => {
    it("prompts for scope then agent, defaulting the endpoint", async () => {
      // endpoint textInput (accept default) → scope select → agent select.
      const prompter = scriptedPrompter([undefined, "global", "cursor"]);
      const deps = buildFakeDeps({
        context: { cwd: repo, env: { HOME: home } },
        prompter,
        // every --version probe succeeds, so all agents show as detected.
        processes: {
          exec: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
        },
      });

      const report = await runSetupMcp(
        deps,
        inputs({ endpointExplicit: false, headless: false, scope: undefined })
      );

      expect(report.agent).toBe("cursor");
      expect(report.scope).toBe("global");
      expect(report.url).toBe(`${ENDPOINT}/mcp`);
      // Endpoint, scope, and agent were all asked.
      expect(prompter.transcript).toHaveLength(3);
    });
  });

  describe("formatMcpSetupOutput", () => {
    it("renders raw as single-line JSON and pretty as a summary", async () => {
      const deps = buildFakeDeps({
        context: { cwd: repo, env: { HOME: home } },
      });
      const report = await runSetupMcp(
        deps,
        inputs({ agent: "cursor", scope: "global" })
      );

      const raw = formatMcpSetupOutput({ report, format: "raw" });
      expect(raw).not.toContain("\n");
      expect(JSON.parse(raw)).toMatchObject({
        agent: "cursor",
        scope: "global",
        url: `${ENDPOINT}/mcp`,
        auth: "oauth",
      });

      const pretty = formatMcpSetupOutput({ report, format: "pretty" });
      expect(pretty).toContain("phoenix");
      expect(pretty).toContain(`${ENDPOINT}/mcp`);
    });
  });
});
