/**
 * `writeMcpConfig` — the absolute-path escape hatch used by global-scope
 * installs, plus the merge/refuse behavior shared with local installs.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  McpConfigUnreadableError,
  writeMcpConfig,
} from "../../src/setup/util/mcpConfig";

describe("writeMcpConfig", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "px-mcp-config-"));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("writes to an absolute path outside any repo (global scope)", () => {
    const target = path.join(dir, "home", ".cursor", "mcp.json");
    writeMcpConfig({
      filePath: target,
      patch: { mcpServers: { phoenix: { url: "http://x/mcp" } } },
    });
    expect(JSON.parse(fs.readFileSync(target, "utf-8"))).toEqual({
      mcpServers: { phoenix: { url: "http://x/mcp" } },
    });
  });

  it("merges into an existing absolute-path file, leaving other servers", () => {
    const target = path.join(dir, "mcp.json");
    fs.writeFileSync(
      target,
      JSON.stringify({ mcpServers: { keep: { url: "y" } } })
    );
    writeMcpConfig({
      filePath: target,
      patch: { mcpServers: { phoenix: { url: "http://x/mcp" } } },
    });
    expect(JSON.parse(fs.readFileSync(target, "utf-8"))).toEqual({
      mcpServers: { keep: { url: "y" }, phoenix: { url: "http://x/mcp" } },
    });
  });

  it("refuses a relative target rather than writing to the wrong place", () => {
    expect(() =>
      writeMcpConfig({
        filePath: "mcp.json",
        patch: {},
      })
    ).toThrow(/absolute path/);
  });

  it("refuses an unparseable existing file instead of clobbering it", () => {
    const target = path.join(dir, "mcp.json");
    fs.writeFileSync(target, "{ not json");
    expect(() => writeMcpConfig({ filePath: target, patch: {} })).toThrow(
      McpConfigUnreadableError
    );
    expect(fs.readFileSync(target, "utf-8")).toBe("{ not json");
  });
});
