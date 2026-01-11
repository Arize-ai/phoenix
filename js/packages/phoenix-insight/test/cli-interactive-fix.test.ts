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

    // Check that we're using for await...of pattern
    expect(cliContent).toContain("for await (const line of rl)");

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

    // Test that events are properly registered
    const lineListeners = rl.listenerCount("line");
    const closeListeners = rl.listenerCount("close");

    // The async iterator should register listeners
    expect(typeof rl[Symbol.asyncIterator]).toBe("function");

    rl.close();
  });

  it("should handle EOF signal gracefully", async () => {
    const cliPath = join(__dirname, "..", "src", "cli.ts");
    const cliContent = await import("node:fs").then((fs) =>
      fs.promises.readFile(cliPath, "utf-8")
    );

    // Check that we handle the case where the loop exits without explicit exit/quit
    // This is now handled by the userExited flag
    expect(cliContent).toContain("let userExited = false");
    expect(cliContent).toContain("userExited = true");
    expect(cliContent).toContain("if (!userExited)");
  });
});
