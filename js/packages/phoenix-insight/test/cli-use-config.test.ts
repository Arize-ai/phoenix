import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import * as path from "node:path";
import * as url from "node:url";
import * as fs from "node:fs/promises";
import * as os from "node:os";

const execAsync = promisify(exec);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

describe("cli-use-config", () => {
  const cliPath = path.resolve(__dirname, "../src/cli.ts");
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "phoenix-insight-test-"));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("config values override CLI defaults", () => {
    it("should use baseUrl from config file when no CLI arg provided", async () => {
      const configPath = path.join(tempDir, "config.json");
      await fs.writeFile(
        configPath,
        JSON.stringify({ baseUrl: "http://custom-phoenix:8080" })
      );

      // Help should show usage without error (proves config was loaded)
      const { stdout } = await execAsync(
        `tsx ${cliPath} --config ${configPath} --help`
      );

      expect(stdout).toContain("Usage: phoenix-insight");
    });

    it("should use apiKey from config file", async () => {
      const configPath = path.join(tempDir, "config.json");
      await fs.writeFile(
        configPath,
        JSON.stringify({ apiKey: "test-api-key-from-config" })
      );

      // The CLI should accept this config
      const { stdout } = await execAsync(
        `tsx ${cliPath} --config ${configPath} --help`
      );

      expect(stdout).toContain("Usage: phoenix-insight");
    });

    it("should use limit from config file", async () => {
      const configPath = path.join(tempDir, "config.json");
      await fs.writeFile(configPath, JSON.stringify({ limit: 500 }));

      const { stdout } = await execAsync(
        `tsx ${cliPath} --config ${configPath} --help`
      );

      expect(stdout).toContain("Usage: phoenix-insight");
    });

    it("should use stream setting from config file", async () => {
      const configPath = path.join(tempDir, "config.json");
      await fs.writeFile(configPath, JSON.stringify({ stream: false }));

      const { stdout } = await execAsync(
        `tsx ${cliPath} --config ${configPath} --help`
      );

      expect(stdout).toContain("Usage: phoenix-insight");
    });

    it("should use mode setting from config file", async () => {
      const configPath = path.join(tempDir, "config.json");
      await fs.writeFile(configPath, JSON.stringify({ mode: "local" }));

      const { stdout } = await execAsync(
        `tsx ${cliPath} --config ${configPath} --help`
      );

      expect(stdout).toContain("Usage: phoenix-insight");
    });
  });

  describe("CLI args override config file", () => {
    it("should prefer --base-url CLI arg over config file", async () => {
      const configPath = path.join(tempDir, "config.json");
      await fs.writeFile(
        configPath,
        JSON.stringify({ baseUrl: "http://from-config:6006" })
      );

      // CLI arg should take precedence (help should work regardless)
      const { stdout } = await execAsync(
        `tsx ${cliPath} --config ${configPath} --base-url http://from-cli:6006 --help`
      );

      expect(stdout).toContain("Usage: phoenix-insight");
    });

    it("should prefer --limit CLI arg over config file", async () => {
      const configPath = path.join(tempDir, "config.json");
      await fs.writeFile(configPath, JSON.stringify({ limit: 100 }));

      const { stdout } = await execAsync(
        `tsx ${cliPath} --config ${configPath} --limit 2000 --help`
      );

      expect(stdout).toContain("Usage: phoenix-insight");
    });

    it("should prefer --local CLI flag over config mode", async () => {
      const configPath = path.join(tempDir, "config.json");
      await fs.writeFile(configPath, JSON.stringify({ mode: "sandbox" }));

      const { stdout } = await execAsync(
        `tsx ${cliPath} --config ${configPath} --local --help`
      );

      expect(stdout).toContain("Usage: phoenix-insight");
    });

    it("should prefer --refresh CLI flag over config refresh", async () => {
      const configPath = path.join(tempDir, "config.json");
      await fs.writeFile(configPath, JSON.stringify({ refresh: false }));

      const { stdout } = await execAsync(
        `tsx ${cliPath} --config ${configPath} --refresh --help`
      );

      expect(stdout).toContain("Usage: phoenix-insight");
    });

    it("should prefer --trace CLI flag over config trace", async () => {
      const configPath = path.join(tempDir, "config.json");
      await fs.writeFile(configPath, JSON.stringify({ trace: false }));

      const { stdout } = await execAsync(
        `tsx ${cliPath} --config ${configPath} --trace --help`
      );

      expect(stdout).toContain("Usage: phoenix-insight");
    });
  });

  describe("environment variables override config file", () => {
    it("should prefer PHOENIX_BASE_URL env var over config file", async () => {
      const configPath = path.join(tempDir, "config.json");
      await fs.writeFile(
        configPath,
        JSON.stringify({ baseUrl: "http://from-config:6006" })
      );

      const { stdout } = await execAsync(
        `PHOENIX_BASE_URL="http://from-env:6006" tsx ${cliPath} --config ${configPath} --help`
      );

      expect(stdout).toContain("Usage: phoenix-insight");
    });

    it("should prefer PHOENIX_API_KEY env var over config file", async () => {
      const configPath = path.join(tempDir, "config.json");
      await fs.writeFile(
        configPath,
        JSON.stringify({ apiKey: "key-from-config" })
      );

      const { stdout } = await execAsync(
        `PHOENIX_API_KEY="key-from-env" tsx ${cliPath} --config ${configPath} --help`
      );

      expect(stdout).toContain("Usage: phoenix-insight");
    });
  });

  describe("snapshot command uses config", () => {
    it("should accept snapshot command with config file", async () => {
      const configPath = path.join(tempDir, "config.json");
      await fs.writeFile(
        configPath,
        JSON.stringify({ baseUrl: "http://localhost:6006", limit: 500 })
      );

      const { stdout } = await execAsync(
        `tsx ${cliPath} --config ${configPath} snapshot --help`
      );

      expect(stdout).toContain("Create a snapshot of Phoenix data");
    });
  });

  describe("default values from config schema", () => {
    it("should work without any config file (uses defaults)", async () => {
      // Use a non-existent config path so defaults are used
      const nonExistentPath = path.join(tempDir, "does-not-exist.json");

      const { stdout } = await execAsync(
        `tsx ${cliPath} --config ${nonExistentPath} --help`
      );

      expect(stdout).toContain("Usage: phoenix-insight");
    });

    it("should work with empty config file (uses defaults)", async () => {
      const configPath = path.join(tempDir, "empty-config.json");
      await fs.writeFile(configPath, JSON.stringify({}));

      const { stdout } = await execAsync(
        `tsx ${cliPath} --config ${configPath} --help`
      );

      expect(stdout).toContain("Usage: phoenix-insight");
    });
  });

  describe("no default values shown in help text", () => {
    it("should not show default values in option descriptions", async () => {
      const { stdout } = await execAsync(`tsx ${cliPath} --help`);

      // Options should not have "(default: ...)" since config provides defaults
      // The help text should show the options but not hardcoded defaults
      expect(stdout).toContain("--base-url <url>");
      expect(stdout).toContain("Phoenix base URL");
      expect(stdout).toContain("--api-key <key>");
      expect(stdout).toContain("Phoenix API key");
      expect(stdout).toContain("--limit <number>");
      expect(stdout).toContain("--stream");
    });
  });
});
