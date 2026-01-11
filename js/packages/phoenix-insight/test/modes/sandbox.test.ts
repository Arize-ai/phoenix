import { describe, it, expect, beforeEach } from "vitest";
import { SandboxMode } from "../../src/modes/sandbox.js";

describe("SandboxMode", () => {
  let sandbox: SandboxMode;

  beforeEach(() => {
    sandbox = new SandboxMode();
  });

  describe("writeFile", () => {
    it("should write a file with absolute path", async () => {
      await sandbox.writeFile("/phoenix/test.txt", "Hello World");

      const result = await sandbox.exec("cat /phoenix/test.txt");
      expect(result.stdout).toBe("Hello World");
      expect(result.exitCode).toBe(0);
    });

    it("should write a file with relative path", async () => {
      await sandbox.writeFile("test.txt", "Hello World");

      const result = await sandbox.exec("cat /phoenix/test.txt");
      expect(result.stdout).toBe("Hello World");
      expect(result.exitCode).toBe(0);
    });

    it("should create parent directories", async () => {
      await sandbox.writeFile("/phoenix/deep/nested/file.txt", "Content");

      const result = await sandbox.exec("cat /phoenix/deep/nested/file.txt");
      expect(result.stdout).toBe("Content");
      expect(result.exitCode).toBe(0);
    });

    it("should handle paths without leading slash", async () => {
      await sandbox.writeFile("nested/file.txt", "Content");

      const result = await sandbox.exec("cat /phoenix/nested/file.txt");
      expect(result.stdout).toBe("Content");
      expect(result.exitCode).toBe(0);
    });
  });

  describe("exec", () => {
    it("should execute basic commands", async () => {
      const result = await sandbox.exec("echo 'Hello World'");
      expect(result.stdout.trim()).toBe("Hello World");
      expect(result.stderr).toBe("");
      expect(result.exitCode).toBe(0);
    });

    it("should handle command failures", async () => {
      const result = await sandbox.exec("cat /nonexistent/file.txt");
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("No such file");
    });

    it("should work with pipes", async () => {
      await sandbox.writeFile("/phoenix/data.txt", "line1\nline2\nline3\n");

      const result = await sandbox.exec("cat /phoenix/data.txt | wc -l");
      expect(result.stdout.trim()).toBe("3");
      expect(result.exitCode).toBe(0);
    });

    it("should work with redirections", async () => {
      await sandbox.exec("echo 'Test Content' > /phoenix/output.txt");

      const result = await sandbox.exec("cat /phoenix/output.txt");
      expect(result.stdout.trim()).toBe("Test Content");
      expect(result.exitCode).toBe(0);
    });

    it("should support working directory", async () => {
      const result = await sandbox.exec("pwd");
      expect(result.stdout.trim()).toBe("/phoenix");
      expect(result.exitCode).toBe(0);
    });

    it("should support jq for JSON processing", async () => {
      await sandbox.writeFile(
        "/phoenix/data.json",
        JSON.stringify({ name: "test", value: 42 })
      );

      const result = await sandbox.exec("cat /phoenix/data.json | jq '.name'");
      expect(result.stdout.trim()).toBe('"test"');
      expect(result.exitCode).toBe(0);
    });
  });

  describe("getBashTool", () => {
    it("should return a bash tool after initialization", async () => {
      const tool = await sandbox.getBashTool();
      expect(tool).toBeDefined();
      // The tool should now be an AI SDK tool with description, inputSchema, and execute
      expect(tool).toHaveProperty("description");
      expect(tool).toHaveProperty("inputSchema");
      expect(tool).toHaveProperty("execute");
      expect(tool.description).toContain("bash");
      expect(typeof tool.execute).toBe("function");
    });

    it("should return the same tool instance on multiple calls", async () => {
      const tool1 = await sandbox.getBashTool();
      const tool2 = await sandbox.getBashTool();
      expect(tool1).toBe(tool2);
    });

    it("should execute commands through the tool", async () => {
      const tool = await sandbox.getBashTool();

      // Write a test file first
      await sandbox.writeFile("/phoenix/test.txt", "tool test");

      // Execute a command through the tool
      const result = await tool.execute({ command: "cat /phoenix/test.txt" });

      expect(result.success).toBe(true);
      expect(result.stdout).toBe("tool test");
      expect(result.exitCode).toBe(0);
    });

    it("should handle command failures through the tool", async () => {
      const tool = await sandbox.getBashTool();

      // Execute a failing command
      const result = await tool.execute({ command: "cat /nonexistent/file" });

      expect(result.success).toBe(false);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("No such file");
      expect(result.error).toContain("exit code");
    });
  });

  describe("cleanup", () => {
    it("should cleanup without error", async () => {
      await sandbox.writeFile("/phoenix/test.txt", "test");
      await expect(sandbox.cleanup()).resolves.not.toThrow();
    });
  });

  describe("integration scenarios", () => {
    it("should handle Phoenix-like data structure", async () => {
      // Create a Phoenix-like directory structure
      await sandbox.writeFile(
        "/phoenix/projects/index.jsonl",
        JSON.stringify({ name: "project1", id: "123" }) +
          "\n" +
          JSON.stringify({ name: "project2", id: "456" })
      );

      await sandbox.writeFile(
        "/phoenix/projects/project1/metadata.json",
        JSON.stringify({ name: "project1", created_at: "2025-01-01" })
      );

      await sandbox.writeFile(
        "/phoenix/projects/project1/spans/index.jsonl",
        JSON.stringify({ span_id: "span1", latency: 100 }) +
          "\n" +
          JSON.stringify({ span_id: "span2", latency: 200 })
      );

      // Test listing projects
      const projectsResult = await sandbox.exec(
        "cat /phoenix/projects/index.jsonl | jq -s '.'"
      );
      const projects = JSON.parse(projectsResult.stdout);
      expect(projects).toHaveLength(2);
      expect(projects[0].name).toBe("project1");

      // Test reading metadata
      const metadataResult = await sandbox.exec(
        "cat /phoenix/projects/project1/metadata.json | jq '.created_at'"
      );
      expect(metadataResult.stdout.trim()).toBe('"2025-01-01"');

      // Test analyzing spans - use jq to sum directly
      const spansResult = await sandbox.exec(
        "cat /phoenix/projects/project1/spans/index.jsonl | jq -s 'map(.latency) | add'"
      );
      expect(spansResult.stdout.trim()).toBe("300");
    });
  });
});
