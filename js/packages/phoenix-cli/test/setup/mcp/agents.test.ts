/**
 * Per-agent, per-scope install descriptors: the argv the CLI agents run and the
 * JSON fragments the file agents merge. These are the contract the executor
 * hands to the agent binaries and config files, so they are pinned here.
 */

import { describe, expect, it } from "vitest";

import {
  getMcpAgent,
  MCP_AGENT_IDS,
  type McpAgent,
  type McpHeader,
  type McpInstallAction,
} from "../../../src/setup/mcp/agents";

const URL = "http://localhost:6006/mcp";
const CTX = { home: "/home/me", cwd: "/repo" };
const NO_HEADERS: McpHeader[] = [];
const BEARER: McpHeader[] = [
  { name: "Authorization", value: "Bearer ${PHOENIX_API_KEY}" },
];

function agent(id: string): McpAgent {
  const found = getMcpAgent(id);
  if (!found) {
    throw new Error(`unknown agent in test: ${id}`);
  }
  return found;
}

function cli(action: McpInstallAction | undefined) {
  if (!action || action.kind !== "cli") {
    throw new Error("expected a cli install action");
  }
  return action;
}

function file(action: McpInstallAction | undefined) {
  if (!action || action.kind !== "file") {
    throw new Error("expected a file install action");
  }
  return action;
}

describe("MCP agent registry", () => {
  it("every advertised id resolves to an agent with a global install", () => {
    for (const id of MCP_AGENT_IDS) {
      const found = agent(id);
      expect(found.install.global).toBeDefined();
    }
  });

  describe("claude", () => {
    it("registers over http, scoped user for global and project for local", () => {
      expect(
        cli(agent("claude").install.global).addArgs(URL, NO_HEADERS)
      ).toEqual([
        "mcp",
        "add",
        "--scope",
        "user",
        "--transport",
        "http",
        "phoenix",
        URL,
      ]);
      expect(
        cli(agent("claude").install.local).addArgs(URL, NO_HEADERS)
      ).toEqual([
        "mcp",
        "add",
        "--scope",
        "project",
        "--transport",
        "http",
        "phoenix",
        URL,
      ]);
    });

    it("passes a header through as a --header flag", () => {
      expect(cli(agent("claude").install.global).addArgs(URL, BEARER)).toEqual([
        "mcp",
        "add",
        "--scope",
        "user",
        "--transport",
        "http",
        "--header",
        "Authorization: Bearer ${PHOENIX_API_KEY}",
        "phoenix",
        URL,
      ]);
    });

    it("reads the entry back to confirm it landed", () => {
      expect(cli(agent("claude").install.global).verifyArgs).toEqual([
        "mcp",
        "get",
        "phoenix",
      ]);
    });
  });

  describe("codex", () => {
    it("has no repo-scoped install", () => {
      expect(agent("codex").install.local).toBeUndefined();
    });

    it("adds a streamable-http server by url", () => {
      expect(
        cli(agent("codex").install.global).addArgs(URL, NO_HEADERS)
      ).toEqual(["mcp", "add", "phoenix", "--url", URL]);
    });

    it("translates an Authorization: Bearer ${VAR} header to --bearer-token-env-var", () => {
      expect(cli(agent("codex").install.global).addArgs(URL, BEARER)).toEqual([
        "mcp",
        "add",
        "phoenix",
        "--url",
        URL,
        "--bearer-token-env-var",
        "PHOENIX_API_KEY",
      ]);
    });

    it("ignores a literal (non-env) bearer token it cannot store", () => {
      const literal: McpHeader[] = [
        { name: "Authorization", value: "Bearer sk-abc123" },
      ];
      expect(cli(agent("codex").install.global).addArgs(URL, literal)).toEqual([
        "mcp",
        "add",
        "phoenix",
        "--url",
        URL,
      ]);
    });

    it("reports which headers it can't store, so the run can refuse them", () => {
      const dropped = cli(agent("codex").install.global).droppedHeaders;
      expect(dropped).toBeDefined();
      // A translatable bearer header is honored — nothing dropped.
      expect(dropped!(BEARER)).toEqual([]);
      // A literal bearer token and any non-Authorization header can't be stored.
      expect(
        dropped!([{ name: "Authorization", value: "Bearer sk-abc123" }])
      ).toEqual([{ name: "Authorization", value: "Bearer sk-abc123" }]);
      expect(dropped!([{ name: "X-Api-Key", value: "abc123" }])).toEqual([
        { name: "X-Api-Key", value: "abc123" },
      ]);
    });

    it("drops a second Authorization header even when one is honored", () => {
      const dropped = cli(agent("codex").install.global).droppedHeaders;
      const literal: McpHeader = {
        name: "Authorization",
        value: "Bearer sk-abc123",
      };
      // Only the env-var-shaped header is honored, whichever order they come in.
      expect(dropped!([...BEARER, literal])).toEqual([literal]);
      expect(dropped!([literal, ...BEARER])).toEqual([literal]);
    });
  });

  describe("gemini", () => {
    it("mirrors claude's flags but has no read-back (no `mcp get`)", () => {
      const global = cli(agent("gemini").install.global);
      expect(global.addArgs(URL, NO_HEADERS)).toEqual([
        "mcp",
        "add",
        "--scope",
        "user",
        "--transport",
        "http",
        "phoenix",
        URL,
      ]);
      expect(global.verifyArgs).toBeUndefined();
    });
  });

  describe("cursor", () => {
    it("targets ~/.cursor/mcp.json globally and .cursor/mcp.json locally", () => {
      const global = file(agent("cursor").install.global);
      expect(global.path(CTX)).toBe("/home/me/.cursor/mcp.json");
      expect(global.displayPath(CTX)).toBe("~/.cursor/mcp.json");
      const local = file(agent("cursor").install.local);
      expect(local.path(CTX)).toBe("/repo/.cursor/mcp.json");
      expect(local.displayPath(CTX)).toBe(".cursor/mcp.json");
    });

    it("writes a url-only server, and a headers object only when given headers", () => {
      const global = file(agent("cursor").install.global);
      expect(global.patch(URL, NO_HEADERS)).toEqual({
        mcpServers: { phoenix: { url: URL } },
      });
      expect(global.patch(URL, BEARER)).toEqual({
        mcpServers: {
          phoenix: {
            url: URL,
            headers: { Authorization: "Bearer ${PHOENIX_API_KEY}" },
          },
        },
      });
    });
  });

  describe("opencode", () => {
    it("targets the platform config dir globally and opencode.json locally", () => {
      const global = file(agent("opencode").install.global);
      expect(global.path(CTX)).toBe("/home/me/.config/opencode/opencode.json");
      expect(global.displayPath(CTX)).toBe("~/.config/opencode/opencode.json");
      expect(file(agent("opencode").install.local).path(CTX)).toBe(
        "/repo/opencode.json"
      );
    });

    it("carries the $schema default and a remote-enabled server entry", () => {
      const global = file(agent("opencode").install.global);
      expect(global.createDefaults).toEqual({
        $schema: "https://opencode.ai/config.json",
      });
      expect(global.patch(URL, NO_HEADERS)).toEqual({
        mcp: { phoenix: { type: "remote", url: URL, enabled: true } },
      });
    });
  });

  describe("vscode", () => {
    it("uses the code CLI globally and a workspace file locally", () => {
      const global = cli(agent("vscode").install.global);
      expect(global.binary).toBe("code");
      expect(global.addArgs(URL, NO_HEADERS)).toEqual([
        "--add-mcp",
        JSON.stringify({ name: "phoenix", type: "http", url: URL }),
      ]);
      const local = file(agent("vscode").install.local);
      expect(local.displayPath(CTX)).toBe(".vscode/mcp.json");
      expect(local.patch(URL, NO_HEADERS)).toEqual({
        servers: { phoenix: { type: "http", url: URL } },
      });
    });

    it("embeds headers in the --add-mcp json when supplied", () => {
      expect(cli(agent("vscode").install.global).addArgs(URL, BEARER)).toEqual([
        "--add-mcp",
        JSON.stringify({
          name: "phoenix",
          type: "http",
          url: URL,
          headers: { Authorization: "Bearer ${PHOENIX_API_KEY}" },
        }),
      ]);
    });
  });
});
