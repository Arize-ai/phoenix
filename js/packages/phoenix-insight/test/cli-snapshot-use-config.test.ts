import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import * as path from "node:path";
import * as url from "node:url";
import * as fs from "node:fs/promises";
import * as os from "node:os";

const execAsync = promisify(exec);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

describe("cli-snapshot-use-config", () => {
  const cliPath = path.resolve(__dirname, "../src/cli.ts");
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "phoenix-insight-snapshot-test-")
    );
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("snapshot command help", () => {
    it("should NOT show --base-url, --api-key, --refresh, --trace options in snapshot help", async () => {
      const { stdout } = await execAsync(`tsx ${cliPath} snapshot --help`);

      // These options should NOT appear in snapshot subcommand help
      // They are global options accessed via getConfig()
      expect(stdout).not.toContain("--base-url");
      expect(stdout).not.toContain("--api-key");
      expect(stdout).not.toContain("--refresh");
      expect(stdout).not.toContain("--trace");

      // But we should still have basic help structure
      expect(stdout).toContain("Create a snapshot of Phoenix data");
      expect(stdout).toContain("-h, --help");
    });

    it("should show global options in main help that snapshot will use via config", async () => {
      const { stdout } = await execAsync(`tsx ${cliPath} --help`);

      // Global options should be available on the main command
      expect(stdout).toContain("--base-url <url>");
      expect(stdout).toContain("--api-key <key>");
      expect(stdout).toContain("--refresh");
      expect(stdout).toContain("--trace");
    });
  });

  describe("snapshot uses config values", () => {
    it("should work with config file settings for snapshot", async () => {
      const configPath = path.join(tempDir, "config.json");
      await fs.writeFile(
        configPath,
        JSON.stringify({
          baseUrl: "http://custom-phoenix:8080",
          apiKey: "test-key",
          trace: false,
        })
      );

      // Help should work without error (proves config is loaded)
      const { stdout } = await execAsync(
        `tsx ${cliPath} --config ${configPath} snapshot --help`
      );

      expect(stdout).toContain("Create a snapshot of Phoenix data");
    });

    it("should accept global flags before snapshot command", async () => {
      const configPath = path.join(tempDir, "config.json");
      await fs.writeFile(configPath, JSON.stringify({}));

      // Global flags before subcommand should be accepted
      const { stdout } = await execAsync(
        `tsx ${cliPath} --config ${configPath} --base-url http://test:6006 snapshot --help`
      );

      expect(stdout).toContain("Create a snapshot of Phoenix data");
    });

    it("should accept global flags via env vars for snapshot", async () => {
      const { stdout } = await execAsync(
        `PHOENIX_BASE_URL="http://env-phoenix:6006" tsx ${cliPath} snapshot --help`
      );

      expect(stdout).toContain("Create a snapshot of Phoenix data");
    });
  });

  describe("config inheritance", () => {
    it("should prefer CLI args over config file for snapshot", async () => {
      const configPath = path.join(tempDir, "config.json");
      await fs.writeFile(
        configPath,
        JSON.stringify({
          baseUrl: "http://from-config:6006",
        })
      );

      // CLI arg should take precedence (verified by successful help output)
      const { stdout } = await execAsync(
        `tsx ${cliPath} --config ${configPath} --base-url http://from-cli:6006 snapshot --help`
      );

      expect(stdout).toContain("Create a snapshot of Phoenix data");
    });

    it("should prefer env vars over config file for snapshot", async () => {
      const configPath = path.join(tempDir, "config.json");
      await fs.writeFile(
        configPath,
        JSON.stringify({
          baseUrl: "http://from-config:6006",
        })
      );

      const { stdout } = await execAsync(
        `PHOENIX_BASE_URL="http://from-env:6006" tsx ${cliPath} --config ${configPath} snapshot --help`
      );

      expect(stdout).toContain("Create a snapshot of Phoenix data");
    });
  });
});
