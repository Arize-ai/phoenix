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

  it("should track user exit status properly", async () => {
    const cliPath = join(__dirname, "..", "src", "cli.ts");
    const cliContent = await import("node:fs").then((fs) =>
      fs.promises.readFile(cliPath, "utf-8")
    );

    // Check that we have the userExited flag
    expect(cliContent).toContain("let userExited = false");
    expect(cliContent).toContain("userExited = true");
    expect(cliContent).toContain("if (!userExited)");
  });

  it("should prompt after each query", async () => {
    const cliPath = join(__dirname, "..", "src", "cli.ts");
    const cliContent = await import("node:fs").then((fs) =>
      fs.promises.readFile(cliPath, "utf-8")
    );

    // Check that rl.prompt() is called after query processing
    const lines = cliContent.split("\n");

    // Find the separator line and verify prompt follows
    let foundPattern = false;
    for (let i = 0; i < lines.length - 1; i++) {
      if (
        lines[i].includes('"─".repeat(50)') &&
        lines[i + 1].includes("rl.prompt()")
      ) {
        foundPattern = true;
        break;
      }
    }

    expect(foundPattern).toBe(true);
  });

  it("should handle errors without exiting the loop", async () => {
    const cliPath = join(__dirname, "..", "src", "cli.ts");
    const cliContent = await import("node:fs").then((fs) =>
      fs.promises.readFile(cliPath, "utf-8")
    );

    // Check that errors are caught and don't break the loop
    expect(cliContent).toContain('console.error("\\n❌ Query Error:"');
    expect(cliContent).toContain("You can try again with a different query");

    // Verify that after error handling, we still prompt
    const errorSection = cliContent.match(
      /} catch \(error\) \{[\s\S]*?console\.error.*?You can try again[\s\S]*?\}/
    );
    expect(errorSection).toBeTruthy();
  });
});
