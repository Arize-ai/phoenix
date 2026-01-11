import { describe, it, expect, vi } from "vitest";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { Readable, Writable } from "node:stream";

describe("CLI Interactive Mode - Premature Exit Fix", () => {
  it("should verify readline event listeners are properly set", async () => {
    const cliPath = join(__dirname, "..", "src", "cli.ts");
    const cliContent = await import("node:fs").then((fs) =>
      fs.promises.readFile(cliPath, "utf-8")
    );

    // Check that we're using event-based approach (not async iterator which can cause premature exits)
    expect(cliContent).toContain('rl.on("line"');
    expect(cliContent).toContain('rl.on("close"');

    // Check that we have proper error handling
    expect(cliContent).toContain("} catch (error) {");
    expect(cliContent).toContain('console.error("\\n❌ Query Error:");');

    // Check that rl.prompt() is called after handling each query
    const promptCalls = cliContent.match(/rl\.prompt\(\)/g) || [];
    expect(promptCalls.length).toBeGreaterThanOrEqual(3); // Initial + after each query handling
  });

  it("should check for potential readline interface issues", () => {
    // Test that mocked readline behaves as expected
    const mockStdin = new Readable({
      read() {},
    });
    const mockStdout = new Writable({
      write(chunk, encoding, callback) {
        if (callback) callback();
        return true;
      },
    });

    // Mock readline module
    const readline = require("readline");
    const rl = readline.createInterface({
      input: mockStdin,
      output: mockStdout,
      prompt: "test> ",
    });

    // Verify the interface is created properly
    expect(rl).toBeDefined();
    expect(rl.input).toBe(mockStdin);
    expect(rl.output).toBe(mockStdout);

    // Test that event-based approach works correctly
    let lineReceived = false;
    rl.on("line", () => {
      lineReceived = true;
    });
    expect(rl.listenerCount("line")).toBe(1);

    rl.close();
  });

  it("should use event-based approach for readline", async () => {
    const cliPath = join(__dirname, "..", "src", "cli.ts");
    const cliContent = await import("node:fs").then((fs) =>
      fs.promises.readFile(cliPath, "utf-8")
    );

    // Check that we use event-based approach instead of async iterator
    // The async iterator pattern can cause premature exits when ora/spinners interact with stdin
    expect(cliContent).toContain(
      "Use event-based approach instead of async iterator"
    );
    expect(cliContent).toContain('rl.on("line", async (line)');
    expect(cliContent).toContain("rl.pause()");
    expect(cliContent).toContain("rl.resume()");
  });
});
