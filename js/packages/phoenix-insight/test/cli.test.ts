import { describe, it, expect, beforeEach, vi } from "vitest";
import { exec } from "child_process";
import { promisify } from "util";
import { resolve } from "path";
import { readFile } from "fs/promises";

const execAsync = promisify(exec);

describe("phoenix-insight CLI", () => {
  const cliPath = resolve(__dirname, "../src/cli.ts");

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

  it("should accept query arguments", async () => {
    const { stdout } = await execAsync(`tsx ${cliPath} "test query"`);
    expect(stdout).toContain("Query command not yet implemented");
    expect(stdout).toContain("Query: test query");
  });

  it("should accept sandbox option", async () => {
    const { stdout } = await execAsync(`tsx ${cliPath} "test" --sandbox`);
    expect(stdout).toContain("Query command not yet implemented");
    expect(stdout).toContain("Options:");
    expect(stdout).toContain("sandbox: true");
  });

  it("should accept base-url option", async () => {
    const customUrl = "https://phoenix.example.com";
    const { stdout } = await execAsync(
      `tsx ${cliPath} "test" --base-url ${customUrl}`
    );
    expect(stdout).toContain("Options:");
    expect(stdout).toContain(`baseUrl: '${customUrl}'`);
  });

  it("should accept limit option", async () => {
    const { stdout } = await execAsync(`tsx ${cliPath} "test" --limit 500`);
    expect(stdout).toContain("Options:");
    expect(stdout).toContain("limit: 500");
  });
});

describe("Package configuration", () => {
  it("should have correct package.json configuration", async () => {
    const packagePath = resolve(__dirname, "../package.json");
    const packageContent = await readFile(packagePath, "utf-8");
    const pkg = JSON.parse(packageContent);

    expect(pkg.name).toBe("@arizeai/phoenix-insight");
    expect(pkg.bin).toHaveProperty("phoenix-insight");
    expect(pkg.bin["phoenix-insight"]).toBe("dist/src/cli.js");
    expect(pkg.dependencies).toHaveProperty("commander");
    expect(pkg.dependencies).toHaveProperty("@arizeai/phoenix-client");
    expect(pkg.dependencies).toHaveProperty("ai");
    expect(pkg.dependencies).toHaveProperty("@ai-sdk/anthropic");
    expect(pkg.dependencies).toHaveProperty("just-bash");
    expect(pkg.dependencies).toHaveProperty("bash-tool");
  });

  it("should have correct tsconfig.json configuration", async () => {
    const tsconfigPath = resolve(__dirname, "../tsconfig.json");
    const tsconfigContent = await readFile(tsconfigPath, "utf-8");
    const tsconfig = JSON.parse(tsconfigContent);

    expect(tsconfig.extends).toBe("../../tsconfig.base.json");
    expect(tsconfig.compilerOptions.resolveJsonModule).toBe(true);
    expect(tsconfig.compilerOptions.types).toContain("node");
    expect(tsconfig.include).toContain("src/**/*.ts");
    expect(tsconfig.include).toContain("test/**/*.ts");
  });

  it("should have README.md file", async () => {
    const readmePath = resolve(__dirname, "../README.md");
    const readmeContent = await readFile(readmePath, "utf-8");

    expect(readmeContent).toContain("Phoenix Insight CLI");
    expect(readmeContent).toContain("Installation");
    expect(readmeContent).toContain("Usage");
    expect(readmeContent).toContain("Development");
  });
});
