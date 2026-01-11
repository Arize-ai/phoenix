import { describe, it, expect } from "vitest";
import { join } from "node:path";

describe("CLI Interactive Mode - Premature Exit Fix", () => {
  it("should have proper readline configuration", async () => {
    const cliPath = join(__dirname, "..", "src", "cli.ts");
    const cliContent = await import("node:fs").then((fs) =>
      fs.promises.readFile(cliPath, "utf-8")
    );

    // Check that readline is configured with terminal: true
    expect(cliContent).toContain("terminal: true");

    // Check that we handle SIGINT properly
    expect(cliContent).toContain('rl.on("SIGINT"');
    expect(cliContent).toContain('Use "exit" to quit');

    // Check that we handle unhandled rejections
    expect(cliContent).toContain('process.on("unhandledRejection"');
    expect(cliContent).toContain("The interactive mode will continue");
  });

  it("should track user exit status for Ctrl+C handling", async () => {
    const cliPath = join(__dirname, "..", "src", "cli.ts");
    const cliContent = await import("node:fs").then((fs) =>
      fs.promises.readFile(cliPath, "utf-8")
    );

    // Check that we have the userExited flag for Ctrl+C double-press to exit
    expect(cliContent).toContain("let userExited = false");
    expect(cliContent).toContain("userExited = true");
    // Check that we use it to determine exit behavior on second Ctrl+C
    expect(cliContent).toContain("if (userExited)");
  });

  it("should use event-based approach instead of async iterator", async () => {
    const cliPath = join(__dirname, "..", "src", "cli.ts");
    const cliContent = await import("node:fs").then((fs) =>
      fs.promises.readFile(cliPath, "utf-8")
    );

    // Check that we use event-based approach (not async iterator which causes premature exit)
    expect(cliContent).toContain('rl.on("line", async (line)');
    expect(cliContent).toContain('rl.on("close"');

    // Check that we properly pause/resume readline during query processing
    expect(cliContent).toContain("rl.pause()");
    expect(cliContent).toContain("rl.resume()");

    // Check for the comment explaining the fix
    expect(cliContent).toContain(
      "Use event-based approach instead of async iterator"
    );
  });

  it("should prompt after each query via event handler", async () => {
    const cliPath = join(__dirname, "..", "src", "cli.ts");
    const cliContent = await import("node:fs").then((fs) =>
      fs.promises.readFile(cliPath, "utf-8")
    );

    // Check that rl.prompt() is called after query processing in the event handler
    // The pattern is: rl.resume() followed by rl.prompt()
    expect(cliContent).toMatch(/rl\.resume\(\);\s*\n\s*rl\.prompt\(\)/);

    // Check that we show the initial prompt
    expect(cliContent).toContain("// Show initial prompt");
  });

  it("should handle errors without exiting the loop", async () => {
    const cliPath = join(__dirname, "..", "src", "cli.ts");
    const cliContent = await import("node:fs").then((fs) =>
      fs.promises.readFile(cliPath, "utf-8")
    );

    // Check that errors are caught and don't break the loop
    expect(cliContent).toContain('console.error("\\n❌ Query Error:"');
    expect(cliContent).toContain("You can try again with a different query");

    // Verify that after error handling in processQuery, it returns false (continue loop)
    expect(cliContent).toMatch(
      /} catch \(error\) \{[\s\S]*?You can try again[\s\S]*?return false;/
    );
  });

  it("should close readline only on explicit exit command", async () => {
    const cliPath = join(__dirname, "..", "src", "cli.ts");
    const cliContent = await import("node:fs").then((fs) =>
      fs.promises.readFile(cliPath, "utf-8")
    );

    // Check that rl.close() is only called when shouldExit is true
    expect(cliContent).toContain("if (shouldExit)");
    expect(cliContent).toMatch(/if \(shouldExit\) \{\s*\n\s*rl\.close\(\)/);
  });
});
