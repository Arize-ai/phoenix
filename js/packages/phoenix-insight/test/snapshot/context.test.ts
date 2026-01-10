import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateContext } from "../../src/snapshot/context.js";
import type { ExecutionMode } from "../../src/modes/types.js";

describe("generateContext", () => {
  let mockMode: ExecutionMode;
  let writtenFiles: Record<string, string>;

  beforeEach(() => {
    writtenFiles = {};

    mockMode = {
      writeFile: vi.fn(async (path: string, content: string) => {
        writtenFiles[path] = content;
      }),
      exec: vi.fn(async (command: string) => {
        // Mock responses for different commands
        if (command.includes("cat /phoenix/projects/index.jsonl")) {
          return {
            stdout:
              JSON.stringify({
                name: "chatbot-prod",
                updated_at: "2025-01-10T10:00:00Z",
              }) +
              "\n" +
              JSON.stringify({
                name: "rag-experiment",
                updated_at: "2025-01-09T15:00:00Z",
              }),
            stderr: "",
            exitCode: 0,
          };
        }

        if (
          command.includes(
            "cat /phoenix/projects/chatbot-prod/spans/metadata.json"
          )
        ) {
          return {
            stdout: JSON.stringify({ spanCount: 2341 }),
            stderr: "",
            exitCode: 0,
          };
        }

        if (
          command.includes(
            "cat /phoenix/projects/rag-experiment/spans/metadata.json"
          )
        ) {
          return {
            stdout: JSON.stringify({ spanCount: 892 }),
            stderr: "",
            exitCode: 0,
          };
        }

        if (command.includes("cat /phoenix/datasets/index.jsonl")) {
          return {
            stdout:
              JSON.stringify({
                name: "customer-queries",
                updated_at: "2025-01-10T08:00:00Z",
              }) +
              "\n" +
              JSON.stringify({
                name: "test-cases",
                updated_at: "2025-01-08T10:00:00Z",
              }),
            stderr: "",
            exitCode: 0,
          };
        }

        if (
          command.includes(
            "wc -l < /phoenix/datasets/customer-queries/examples.jsonl"
          )
        ) {
          return { stdout: "150", stderr: "", exitCode: 0 };
        }

        if (
          command.includes(
            "wc -l < /phoenix/datasets/test-cases/examples.jsonl"
          )
        ) {
          return { stdout: "75", stderr: "", exitCode: 0 };
        }

        if (command.includes("cat /phoenix/experiments/index.jsonl")) {
          return {
            stdout: JSON.stringify({
              id: "exp-123",
              datasetName: "customer-queries",
              project_name: "chatbot-prod",
              example_count: 50,
              repetitions: 3,
              successful_run_count: 150,
              failed_run_count: 0,
              missing_run_count: 0,
              updated_at: "2025-01-10T09:00:00Z",
            }),
            stderr: "",
            exitCode: 0,
          };
        }

        if (command.includes("cat /phoenix/prompts/index.jsonl")) {
          return {
            stdout:
              JSON.stringify({
                name: "main-assistant",
                updated_at: "2025-01-09T14:00:00Z",
              }) +
              "\n" +
              JSON.stringify({
                name: "summarizer",
                updated_at: "2025-01-08T16:00:00Z",
              }),
            stderr: "",
            exitCode: 0,
          };
        }

        if (
          command.includes(
            "wc -l < /phoenix/prompts/main-assistant/versions/index.jsonl"
          )
        ) {
          return { stdout: "5", stderr: "", exitCode: 0 };
        }

        if (
          command.includes(
            "wc -l < /phoenix/prompts/summarizer/versions/index.jsonl"
          )
        ) {
          return { stdout: "3", stderr: "", exitCode: 0 };
        }

        // Default: empty response for missing files
        return { stdout: "", stderr: "", exitCode: 0 };
      }),
      getBashTool: vi.fn(),
      cleanup: vi.fn(),
    };
  });

  it("should generate context file with all sections", async () => {
    const metadata = {
      phoenixUrl: "http://localhost:6006",
      snapshotTime: new Date("2025-01-10T10:30:00Z"),
      spansPerProject: 1000,
    };

    await generateContext(mockMode, metadata);

    expect(mockMode.writeFile).toHaveBeenCalledWith(
      "/phoenix/_context.md",
      expect.any(String)
    );

    const content = writtenFiles["/phoenix/_context.md"];

    // Check header
    expect(content).toContain("# Phoenix Snapshot Context");

    // Check What's Here section
    expect(content).toContain("## What's Here");
    expect(content).toContain(
      "**2 projects**: chatbot-prod (2341 spans), rag-experiment (892 spans)"
    );
    expect(content).toContain("**2 datasets**: customer-queries, test-cases");
    expect(content).toContain("**1 experiments**: 1 completed");
    expect(content).toContain("**2 prompts**: main-assistant, summarizer");
    expect(content).toContain("**Snapshot**: Created");
    expect(content).toContain("from http://localhost:6006");

    // Check What You Can Do section
    expect(content).toContain("## What You Can Do");
    expect(content).toContain("ls, cat, grep, find, jq, awk, sed");
    expect(content).toContain("px-fetch-more spans");
    expect(content).toContain("px-fetch-more trace");

    // Check Data Freshness section
    expect(content).toContain("## Data Freshness");
    expect(content).toContain("read-only snapshot");
    expect(content).toContain("--refresh");

    // Check File Formats section
    expect(content).toContain("## File Formats");
    expect(content).toContain(".jsonl");
    expect(content).toContain(".json");
    expect(content).toContain(".md");

    // Check Directory Structure
    expect(content).toContain("## Directory Structure");
    expect(content).toContain("/phoenix/");
    expect(content).toContain("_context.md");
  });

  it("should handle empty snapshot gracefully", async () => {
    // Override exec to return empty results
    mockMode.exec = vi.fn(async () => ({
      stdout: "",
      stderr: "",
      exitCode: 0,
    }));

    const metadata = {
      phoenixUrl: "http://localhost:6006",
      snapshotTime: new Date(),
    };

    await generateContext(mockMode, metadata);

    expect(mockMode.writeFile).toHaveBeenCalled();
    const content = writtenFiles["/phoenix/_context.md"];

    expect(content).toContain("**No projects found**");
    expect(content).toContain("**No datasets found**");
    expect(content).toContain("**No experiments found**");
    expect(content).toContain("**No prompts found**");
  });

  it("should include recent activity for recent updates", async () => {
    // Create a recent timestamp (1 hour ago)
    const recentTime = new Date();
    recentTime.setHours(recentTime.getHours() - 1);

    // Override the experiments response to have recent activity
    mockMode.exec = vi.fn(async (command: string) => {
      if (command.includes("cat /phoenix/experiments/index.jsonl")) {
        return {
          stdout: JSON.stringify({
            id: "exp-recent",
            datasetName: "test-data",
            project_name: "test-project",
            example_count: 10,
            repetitions: 1,
            successful_run_count: 10,
            failed_run_count: 0,
            missing_run_count: 0,
            updated_at: recentTime.toISOString(),
          }),
          stderr: "",
          exitCode: 0,
        };
      }
      // Return empty for other commands
      return { stdout: "", stderr: "", exitCode: 0 };
    });

    const metadata = {
      phoenixUrl: "http://localhost:6006",
      snapshotTime: new Date(),
    };

    await generateContext(mockMode, metadata);

    const content = writtenFiles["/phoenix/_context.md"];

    // Should include Recent Activity section
    expect(content).toContain("## Recent Activity");
    expect(content).toContain("test-project: experiment");
    expect(content).toContain("completed");
  });

  it("should format relative time correctly", async () => {
    const metadata = {
      phoenixUrl: "http://localhost:6006",
      snapshotTime: new Date(), // Just now
    };

    await generateContext(mockMode, metadata);

    const content = writtenFiles["/phoenix/_context.md"];

    // Should say "just now" for a very recent snapshot
    expect(content).toContain("Created just now");
  });

  it("should determine experiment status correctly", async () => {
    mockMode.exec = vi.fn(async (command: string) => {
      if (command.includes("cat /phoenix/experiments/index.jsonl")) {
        return {
          stdout:
            // Completed experiment
            JSON.stringify({
              id: "exp-complete",
              datasetName: "data1",
              example_count: 10,
              repetitions: 2,
              successful_run_count: 20,
              failed_run_count: 0,
              missing_run_count: 0,
            }) +
            "\n" +
            // In progress experiment
            JSON.stringify({
              id: "exp-progress",
              datasetName: "data2",
              example_count: 10,
              repetitions: 2,
              successful_run_count: 5,
              failed_run_count: 0,
              missing_run_count: 15,
            }) +
            "\n" +
            // Failed experiment
            JSON.stringify({
              id: "exp-failed",
              datasetName: "data3",
              example_count: 10,
              repetitions: 1,
              successful_run_count: 2,
              failed_run_count: 8,
              missing_run_count: 0,
            }),
          stderr: "",
          exitCode: 0,
        };
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    });

    const metadata = {
      phoenixUrl: "http://localhost:6006",
      snapshotTime: new Date(),
    };

    await generateContext(mockMode, metadata);

    const content = writtenFiles["/phoenix/_context.md"];

    // Should show correct counts: 1 completed, 1 failed, 1 in_progress
    expect(content).toContain(
      "**3 experiments**: 1 completed, 1 in progress, 1 failed"
    );
  });

  it("should handle exec errors gracefully", async () => {
    let callCount = 0;
    mockMode.exec = vi.fn(async (command: string) => {
      callCount++;
      if (callCount === 1) {
        // First call fails
        throw new Error("Command failed");
      }
      // Other calls succeed with empty data
      return { stdout: "", stderr: "", exitCode: 0 };
    });

    const metadata = {
      phoenixUrl: "http://localhost:6006",
      snapshotTime: new Date(),
    };

    // Should not throw, but continue with empty data
    await expect(generateContext(mockMode, metadata)).resolves.not.toThrow();

    expect(mockMode.writeFile).toHaveBeenCalled();
    const content = writtenFiles["/phoenix/_context.md"];
    expect(content).toContain("**No projects found**");
  });
});
