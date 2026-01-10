import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LocalMode } from "../src/modes/local.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

describe("LocalMode", () => {
  let localMode: LocalMode;
  let testDir: string;

  beforeEach(() => {
    localMode = new LocalMode();
    // Get the work directory from the private property (for testing)
    testDir = (localMode as any).workDir;
  });

  afterEach(async () => {
    // Cleanup is handled by the LocalMode itself
    await localMode.cleanup();
  });

  describe("writeFile", () => {
    it("should write a file to the local filesystem", async () => {
      const content = "Hello, Phoenix!";
      await localMode.writeFile("/test.txt", content);

      // Check if file exists
      const filePath = path.join(testDir, "test.txt");
      const exists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);

      // Check content
      const readContent = await fs.readFile(filePath, "utf-8");
      expect(readContent).toBe(content);
    });

    it("should create nested directories", async () => {
      const content = '{"name": "test-project"}';
      await localMode.writeFile("/projects/test/metadata.json", content);

      // Check if nested file exists
      const filePath = path.join(testDir, "projects", "test", "metadata.json");
      const exists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it("should handle paths with /phoenix prefix", async () => {
      const content = "test data";
      await localMode.writeFile("/phoenix/data.txt", content);

      // Should strip /phoenix prefix and write to root
      const filePath = path.join(testDir, "data.txt");
      const exists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe("exec", () => {
    it("should execute bash commands", async () => {
      // Create a test file first
      await localMode.writeFile("/test.txt", "line1\nline2\nline3\n");

      // Execute a command
      const result = await localMode.exec("wc -l test.txt");

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toMatch(/3\s+test\.txt/);
      expect(result.stderr).toBe("");
    });

    it("should handle command failures", async () => {
      // Try to cat a non-existent file
      const result = await localMode.exec("cat non-existent-file.txt");

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("No such file");
    });

    it("should execute commands in the correct directory", async () => {
      // Check current directory
      const result = await localMode.exec("pwd");

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe(testDir);
    });

    it("should handle complex bash commands", async () => {
      // Create test data
      await localMode.writeFile(
        "/spans.jsonl",
        '{"id": 1, "latency": 100}\n{"id": 2, "latency": 200}\n{"id": 3, "latency": 150}\n'
      );

      // Use jq to process JSON
      const result = await localMode.exec(
        "cat spans.jsonl | jq -s 'map(.latency) | add'"
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("450");
    });
  });

  describe("getBashTool", () => {
    it("should return a bash tool for AI SDK", async () => {
      const tool = await localMode.getBashTool();

      expect(tool).toBeDefined();
      expect(tool.description).toContain("bash");
      expect(tool.parameters).toBeDefined();
      expect(tool.execute).toBeInstanceOf(Function);
    });

    it("should cache the bash tool", async () => {
      const tool1 = await localMode.getBashTool();
      const tool2 = await localMode.getBashTool();

      // Should return the same instance
      expect(tool1).toBe(tool2);
    });

    it("should execute commands through the bash tool", async () => {
      const tool = await localMode.getBashTool();

      // Create a test file
      await localMode.writeFile("/test-tool.txt", "Hello from tool!");

      // Execute through the tool
      const result = await tool.execute({ command: "cat test-tool.txt" });

      expect(result.success).toBe(true);
      expect(result.stdout).toBe("Hello from tool!");
      expect(result.exitCode).toBe(0);
    });

    it("should handle errors through the bash tool", async () => {
      const tool = await localMode.getBashTool();

      // Try to execute a failing command
      const result = await tool.execute({ command: "cat /does/not/exist" });

      expect(result.success).toBe(false);
      expect(result.exitCode).not.toBe(0);
      expect(result.error).toContain("Command failed");
    });
  });

  describe("cleanup", () => {
    it("should not throw errors on cleanup", async () => {
      // Cleanup should be a no-op for now
      await expect(localMode.cleanup()).resolves.not.toThrow();
    });
  });

  describe("integration", () => {
    it("should work with a real-world example", async () => {
      // Create a project structure similar to Phoenix
      await localMode.writeFile(
        "/projects/index.jsonl",
        '{"name": "chatbot-prod", "id": "proj-1"}\n{"name": "rag-experiment", "id": "proj-2"}\n'
      );
      await localMode.writeFile(
        "/projects/chatbot-prod/metadata.json",
        '{"name": "chatbot-prod", "id": "proj-1", "span_count": 2341}'
      );
      await localMode.writeFile(
        "/projects/chatbot-prod/spans/index.jsonl",
        '{"id": "span-1", "latency": 123}\n{"id": "span-2", "latency": 456}\n'
      );

      // List projects
      const listResult = await localMode.exec("ls projects/");
      expect(listResult.stdout).toContain("chatbot-prod");
      expect(listResult.stdout).toContain("index.jsonl");

      // Count spans
      const countResult = await localMode.exec(
        "wc -l projects/chatbot-prod/spans/index.jsonl"
      );
      expect(countResult.stdout).toMatch(/2\s+/);

      // Calculate total latency with jq
      const latencyResult = await localMode.exec(
        "cat projects/chatbot-prod/spans/index.jsonl | jq '.latency' | awk '{sum += $1} END {print sum}'"
      );
      expect(latencyResult.stdout.trim()).toBe("579");
    });
  });

  describe("directory structure", () => {
    it("should create directories under ~/.phoenix-insight/snapshots/", async () => {
      // Verify the directory structure
      expect(testDir).toMatch(
        /\.phoenix-insight\/snapshots\/\d+(-\w+)?\/phoenix$/
      );

      // Check if parent directories exist
      const snapshotsDir = path.dirname(path.dirname(testDir));
      const exists = await fs
        .access(snapshotsDir)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });
  });
});
