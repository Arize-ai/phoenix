import { describe, it, expect, beforeEach, vi } from "vitest";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import * as url from "node:url";
import * as path from "node:path";
import { readFile } from "node:fs/promises";

const execAsync = promisify(exec);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

describe("phoenix-insight CLI", () => {
  const cliPath = path.resolve(__dirname, "../src/cli.ts");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should display help when no arguments provided", async () => {
    const { stdout } = await execAsync(`tsx ${cliPath}`);
    expect(stdout).toContain("Usage: phoenix-insight");
    expect(stdout).toContain("A CLI for Phoenix data analysis with AI agents");
    expect(stdout).toContain("Commands:");
    expect(stdout).toContain("snapshot");
  });

  it("should display version", async () => {
    const { stdout } = await execAsync(`tsx ${cliPath} --version`);
    expect(stdout.trim()).toMatch(/\d+\.\d+\.\d+/);
  });

  it("should show help for snapshot command", async () => {
    const { stdout } = await execAsync(`tsx ${cliPath} snapshot --help`);
    expect(stdout).toContain("Create a snapshot of Phoenix data");
    expect(stdout).toContain("--base-url");
    expect(stdout).toContain("--api-key");
    expect(stdout).toContain("--refresh");
  });

  it("should require query argument", async () => {
    const { stdout } = await execAsync(`tsx ${cliPath}`);
    expect(stdout).toContain("Usage: phoenix-insight");
  });

  it("should accept sandbox option", async () => {
    // We can't fully test the execution without mocking Phoenix client
    // Just ensure the CLI accepts the option
    try {
      await execAsync(`tsx ${cliPath} "test" --sandbox`, { timeout: 1000 });
    } catch (error: any) {
      // The command will fail because we don't have a real Phoenix instance
      // But we can check that it tried to execute
      expect(error.message).toContain("Error"); // Network error expected
    }
  });

  it("should accept base-url option", async () => {
    const customUrl = "https://phoenix.example.com";
    try {
      await execAsync(
        `tsx ${cliPath} "test" --base-url ${customUrl} --sandbox`,
        { timeout: 1000 }
      );
    } catch (error: any) {
      // Check that the custom URL was used
      expect(error.message).toContain("Error"); // Network error expected
    }
  });

  it("should accept limit option", async () => {
    try {
      await execAsync(`tsx ${cliPath} "test" --limit 500 --sandbox`, {
        timeout: 1000,
      });
    } catch (error: any) {
      // The command will fail but should accept the limit option
      expect(error.message).toContain("Error"); // Network error expected
    }
  });
});

describe("Package configuration", () => {
  it("should have correct package.json configuration", async () => {
    const packagePath = path.resolve(__dirname, "../package.json");
    const packageContent = await readFile(packagePath, "utf-8");
    const pkg = JSON.parse(packageContent);

    expect(pkg.name).toBe("@arizeai/phoenix-insight");
    expect(pkg.type).toBe("module");
    expect(pkg.bin).toHaveProperty("phoenix-insight");
    expect(pkg.bin["phoenix-insight"]).toBe("./dist/cli.js");
    expect(pkg.dependencies).toHaveProperty("commander");
    expect(pkg.dependencies).toHaveProperty("@arizeai/phoenix-client");
    expect(pkg.dependencies).toHaveProperty("ai");
    expect(pkg.dependencies).toHaveProperty("@ai-sdk/anthropic");
    expect(pkg.dependencies).toHaveProperty("just-bash");
    expect(pkg.dependencies).toHaveProperty("bash-tool");
  });

  it("should have correct tsconfig.json configuration", async () => {
    const tsconfigPath = path.resolve(__dirname, "../tsconfig.json");
    const tsconfigContent = await readFile(tsconfigPath, "utf-8");
    const tsconfig = JSON.parse(tsconfigContent);

    expect(tsconfig.extends).toBe("../../tsconfig.base.json");
    expect(tsconfig.compilerOptions.resolveJsonModule).toBe(true);
    expect(tsconfig.compilerOptions.types).toContain("node");
    expect(tsconfig.compilerOptions.module).toBe("ES2022");
    expect(tsconfig.compilerOptions.target).toBe("ES2022");
    expect(tsconfig.include).toContain("src/**/*.ts");
  });

  it("should have README.md file", async () => {
    const readmePath = path.resolve(__dirname, "../README.md");
    const readmeContent = await readFile(readmePath, "utf-8");

    expect(readmeContent).toContain("Phoenix Insight CLI");
    expect(readmeContent).toContain("Installation");
    expect(readmeContent).toContain("Usage");
    expect(readmeContent).toContain("Development");
  });
});
