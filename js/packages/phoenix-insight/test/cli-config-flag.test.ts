import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import * as url from "node:url";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import * as os from "node:os";

const execAsync = promisify(exec);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

describe("cli-config-flag", () => {
  const cliPath = path.resolve(__dirname, "../src/cli.ts");
  let tempDir: string;

  beforeEach(async () => {
    // Create a temp directory for test config files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "phoenix-insight-test-"));
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("--config option in help", () => {
    it("should show --config option in help text", async () => {
      const { stdout } = await execAsync(`tsx ${cliPath} --help`);

      expect(stdout).toContain("--config <path>");
      expect(stdout).toContain("Path to config file");
    });

    it("should document config priority in help text", async () => {
      const { stdout } = await execAsync(`tsx ${cliPath} --help`);

      // Should document priority order
      expect(stdout).toContain("Configuration:");
      expect(stdout).toContain("CLI arguments");
      expect(stdout).toContain("Environment variables");
      expect(stdout).toContain("Config file");
    });

    it("should show example with --config in help", async () => {
      const { stdout } = await execAsync(`tsx ${cliPath} --help`);

      expect(stdout).toContain("--config ./my-config.json");
    });
  });

  describe("--config option behavior", () => {
    it("should accept --config flag without error", async () => {
      // Create a valid config file
      const configPath = path.join(tempDir, "config.json");
      await fs.writeFile(
        configPath,
        JSON.stringify({ baseUrl: "http://test:6006" })
      );

      // The --config flag should be accepted
      const { stdout } = await execAsync(
        `tsx ${cliPath} --config ${configPath} --help`
      );

      expect(stdout).toContain("Usage: phoenix-insight");
    });

    it("should accept --config before other options", async () => {
      const configPath = path.join(tempDir, "config.json");
      await fs.writeFile(configPath, JSON.stringify({ limit: 500 }));

      // --config before other options
      const { stdout } = await execAsync(
        `tsx ${cliPath} --config ${configPath} --sandbox --help`
      );

      expect(stdout).toContain("Usage: phoenix-insight");
    });

    it("should accept --config after other options", async () => {
      const configPath = path.join(tempDir, "config.json");
      await fs.writeFile(configPath, JSON.stringify({ limit: 500 }));

      // --config after other options
      const { stdout } = await execAsync(
        `tsx ${cliPath} --sandbox --config ${configPath} --help`
      );

      expect(stdout).toContain("Usage: phoenix-insight");
    });
  });

  describe("subcommand --config support", () => {
    it("should accept --config with snapshot command", async () => {
      const configPath = path.join(tempDir, "config.json");
      await fs.writeFile(
        configPath,
        JSON.stringify({ baseUrl: "http://test:6006" })
      );

      const { stdout } = await execAsync(
        `tsx ${cliPath} --config ${configPath} snapshot --help`
      );

      expect(stdout).toContain("Create a snapshot of Phoenix data");
    });

    it("should accept --config with help command", async () => {
      const configPath = path.join(tempDir, "config.json");
      await fs.writeFile(configPath, JSON.stringify({}));

      const { stdout } = await execAsync(
        `tsx ${cliPath} --config ${configPath} help`
      );

      expect(stdout).toContain("Usage: phoenix-insight");
    });
  });

  describe("config file error handling", () => {
    it("should handle non-existent config file gracefully", async () => {
      const nonExistentPath = path.join(tempDir, "does-not-exist.json");

      // Should not throw, just use defaults
      const { stdout } = await execAsync(
        `tsx ${cliPath} --config ${nonExistentPath} --help`
      );

      expect(stdout).toContain("Usage: phoenix-insight");
    });

    it("should handle invalid JSON config file gracefully", async () => {
      const configPath = path.join(tempDir, "invalid.json");
      await fs.writeFile(configPath, "{ invalid json }");

      // Should warn but not crash
      const result = await execAsync(
        `tsx ${cliPath} --config ${configPath} --help`
      );

      expect(result.stdout).toContain("Usage: phoenix-insight");
    });
  });
});
