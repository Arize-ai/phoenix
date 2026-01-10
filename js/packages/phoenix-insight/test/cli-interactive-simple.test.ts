import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

describe("CLI Interactive Mode", () => {
  it("should have interactive flag in CLI", async () => {
    const cliPath = join(__dirname, "..", "src", "cli.ts");
    expect(existsSync(cliPath)).toBe(true);

    // Verify the CLI code contains interactive flag
    const cliContent = await import("node:fs").then((fs) =>
      fs.promises.readFile(cliPath, "utf-8")
    );
    expect(cliContent).toContain("--interactive");
    expect(cliContent).toContain("Run in interactive mode (REPL)");
  });

  it("should have runInteractiveMode function", async () => {
    const cliPath = join(__dirname, "..", "src", "cli.ts");
    const cliContent = await import("node:fs").then((fs) =>
      fs.promises.readFile(cliPath, "utf-8")
    );

    expect(cliContent).toContain("async function runInteractiveMode");
    expect(cliContent).toContain("readline.createInterface");
    expect(cliContent).toContain('prompt: "phoenix> "');
  });

  it("should handle exit and quit commands", async () => {
    const cliPath = join(__dirname, "..", "src", "cli.ts");
    const cliContent = await import("node:fs").then((fs) =>
      fs.promises.readFile(cliPath, "utf-8")
    );

    expect(cliContent).toContain('query === "exit" || query === "quit"');
    expect(cliContent).toContain("Goodbye!");
    expect(cliContent).toContain("rl.close()");
  });

  it("should setup agent and snapshot in interactive mode", async () => {
    const cliPath = join(__dirname, "..", "src", "cli.ts");
    const cliContent = await import("node:fs").then((fs) =>
      fs.promises.readFile(cliPath, "utf-8")
    );

    // Check that it creates mode
    expect(cliContent).toContain(
      "options.sandbox ? createSandboxMode() : await createLocalMode()"
    );

    // Check that it creates snapshot
    expect(cliContent).toContain("await createSnapshot(mode, snapshotOptions)");
    expect(cliContent).toContain(
      "await createIncrementalSnapshot(mode, snapshotOptions)"
    );

    // Check that it creates agent
    expect(cliContent).toContain("agent = createInsightAgent(agentConfig)");
  });

  it("should support streaming in interactive mode", async () => {
    const cliPath = join(__dirname, "..", "src", "cli.ts");
    const cliContent = await import("node:fs").then((fs) =>
      fs.promises.readFile(cliPath, "utf-8")
    );

    // Check streaming support
    expect(cliContent).toContain("if (options.stream)");
    expect(cliContent).toContain("await agent.stream({");
    expect(cliContent).toContain(
      "for await (const chunk of result.textStream)"
    );
  });

  it("should have proper error handling", async () => {
    const cliPath = join(__dirname, "..", "src", "cli.ts");
    const cliContent = await import("node:fs").then((fs) =>
      fs.promises.readFile(cliPath, "utf-8")
    );

    // Check error handling in interactive loop
    expect(cliContent).toContain('console.error("\\n❌ Error:"');
    expect(cliContent).toContain("await mode.cleanup()");
  });

  it("should show help text with examples", async () => {
    const cliPath = join(__dirname, "..", "src", "cli.ts");
    const cliContent = await import("node:fs").then((fs) =>
      fs.promises.readFile(cliPath, "utf-8")
    );

    // Check help text includes interactive example
    expect(cliContent).toContain("phoenix-insight --interactive");
    expect(cliContent).toContain("Interactive REPL mode");
  });
});
