import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PhoenixInsightAgent } from "../../src/agent/index.js";
import { SandboxMode } from "../../src/modes/sandbox.js";
import { LocalMode } from "../../src/modes/local.js";
import type { ExecutionMode } from "../../src/modes/types.js";
import type { PhoenixClient } from "@arizeai/phoenix-client";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

// Mock the AI SDK modules
vi.mock("ai", () => ({
  generateText: vi.fn(),
  streamText: vi.fn(),
  stepCountIs: vi.fn((count) => ({ type: "stepCount", count })),
  tool: vi.fn((config) => {
    // Mock the tool function to return a properly structured tool
    return {
      description: config.description,
      inputSchema: config.inputSchema,
      execute: config.execute,
    };
  }),
}));

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn(() => ({
    modelId: "claude-3-5-sonnet-20241022",
  })),
}));

describe("Agent Tools", () => {
  let mockClient: any;
  let tempDir: string;

  beforeEach(async () => {
    // Create mock Phoenix client with proper structure
    mockClient = {
      GET: vi.fn().mockImplementation((path: string) => {
        if (path.includes("/projects/") && path.includes("/spans")) {
          return Promise.resolve({
            data: {
              data: [{ id: "span-1", name: "test-span" }],
            },
            error: undefined,
          });
        }
        return Promise.resolve({ data: null, error: undefined });
      }),
    };

    // Create temporary directory for tests
    tempDir = path.join(
      os.tmpdir(),
      `phoenix-insight-test-${Date.now()}-${Math.random()
        .toString(36)
        .substring(7)}`
    );
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors during cleanup
    }
  });

  describe("Tool Creation", () => {
    it("should create tools with correct structure in sandbox mode", async () => {
      const mode = new SandboxMode();
      const agent = new PhoenixInsightAgent({
        mode,
        client: mockClient,
      });

      // Access the private initializeTools method via reflection
      const tools = await (agent as any).initializeTools();

      expect(tools).toBeDefined();
      expect(tools.bash).toBeDefined();
      expect(tools.px_fetch_more_spans).toBeDefined();
      expect(tools.px_fetch_more_trace).toBeDefined();

      // Check that the custom tools have the right structure
      expect(tools.px_fetch_more_spans).toHaveProperty("description");
      expect(tools.px_fetch_more_spans).toHaveProperty("inputSchema");
      expect(tools.px_fetch_more_spans).toHaveProperty("execute");

      expect(tools.px_fetch_more_trace).toHaveProperty("description");
      expect(tools.px_fetch_more_trace).toHaveProperty("inputSchema");
      expect(tools.px_fetch_more_trace).toHaveProperty("execute");
    });

    it("should create tools with correct structure in local mode", async () => {
      const mode = new LocalMode();
      const agent = new PhoenixInsightAgent({
        mode,
        client: mockClient,
      });

      // Access the private initializeTools method via reflection
      const tools = await (agent as any).initializeTools();

      expect(tools).toBeDefined();
      expect(tools.bash).toBeDefined();
      expect(tools.px_fetch_more_spans).toBeDefined();
      expect(tools.px_fetch_more_trace).toBeDefined();

      // Check that all tools have the right structure
      expect(tools.bash).toHaveProperty("description");
      expect(tools.bash).toHaveProperty("inputSchema");
      expect(tools.bash).toHaveProperty("execute");
    });
  });

  describe("px-fetch-more-spans Tool", () => {
    it("should execute fetch more spans successfully", async () => {
      const mode: ExecutionMode = {
        writeFile: vi.fn().mockResolvedValue(undefined),
        exec: vi.fn(),
        getBashTool: vi.fn().mockResolvedValue({}),
        cleanup: vi.fn(),
      };

      const agent = new PhoenixInsightAgent({
        mode,
        client: mockClient,
      });

      const tools = await (agent as any).initializeTools();
      const pxFetchMoreSpans = tools.px_fetch_more_spans;

      const result = await pxFetchMoreSpans.execute({
        project: "test-project",
        limit: 100,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("test-project");
      expect(mockClient.GET).toHaveBeenCalled();
      expect(mode.writeFile).toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      const mode: ExecutionMode = {
        writeFile: vi.fn().mockResolvedValue(undefined),
        exec: vi.fn(),
        getBashTool: vi.fn().mockResolvedValue({}),
        cleanup: vi.fn(),
      };

      const errorClient: any = {
        GET: vi.fn().mockRejectedValue(new Error("Network error")),
      };

      const agent = new PhoenixInsightAgent({
        mode,
        client: errorClient,
      });

      const tools = await (agent as any).initializeTools();
      const pxFetchMoreSpans = tools.px_fetch_more_spans;

      const result = await pxFetchMoreSpans.execute({
        project: "test-project",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Network error");
    });
  });

  describe("px-fetch-more-trace Tool", () => {
    it("should execute fetch more trace successfully", async () => {
      const mode: ExecutionMode = {
        writeFile: vi.fn().mockResolvedValue(undefined),
        exec: vi.fn().mockImplementation((cmd: string) => {
          if (cmd === "cat /phoenix/projects/index.jsonl") {
            return Promise.resolve({
              stdout: JSON.stringify({ name: "test-project" }) + "\n",
              stderr: "",
              exitCode: 0,
            });
          }
          return Promise.resolve({ stdout: "", stderr: "", exitCode: 0 });
        }),
        getBashTool: vi.fn().mockResolvedValue({}),
        cleanup: vi.fn(),
      };

      const clientWithTrace: any = {
        GET: vi.fn().mockImplementation((path: string) => {
          if (path.includes("/projects/") && path.includes("/spans")) {
            return Promise.resolve({
              data: {
                data: [
                  {
                    id: "span-1",
                    name: "test-span",
                    context: {
                      trace_id: "trace-123",
                      span_id: "span-1",
                    },
                    parent_id: null,
                    start_time: "2025-01-01T00:00:00Z",
                    end_time: "2025-01-01T00:00:01Z",
                  },
                  {
                    id: "span-2",
                    name: "child-span",
                    context: {
                      trace_id: "trace-123",
                      span_id: "span-2",
                    },
                    parent_id: "span-1",
                    start_time: "2025-01-01T00:00:00.5Z",
                    end_time: "2025-01-01T00:00:01Z",
                  },
                ],
                next_cursor: null,
              },
              error: undefined,
            });
          }
          return Promise.resolve({ data: null, error: undefined });
        }),
      };

      const agent = new PhoenixInsightAgent({
        mode,
        client: clientWithTrace,
      });

      const tools = await (agent as any).initializeTools();
      const pxFetchMoreTrace = tools.px_fetch_more_trace;

      const result = await pxFetchMoreTrace.execute({
        traceId: "trace-123",
        project: "test-project",
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("trace-123");
      expect(clientWithTrace.GET).toHaveBeenCalled();
      expect(mode.writeFile).toHaveBeenCalled();
    });
  });

  describe("Integration with AI SDK", () => {
    it("should pass tools to generateText with correct format", async () => {
      const { generateText } = await import("ai");
      const mode = new SandboxMode();
      const agent = new PhoenixInsightAgent({
        mode,
        client: mockClient,
      });

      // Mock generateText to capture the tools parameter
      (generateText as any).mockResolvedValue({
        text: "Test response",
        steps: [],
      });

      await agent.generate("test query");

      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: expect.objectContaining({
            bash: expect.any(Object),
            px_fetch_more_spans: expect.objectContaining({
              description: expect.any(String),
              inputSchema: expect.any(Object),
              execute: expect.any(Function),
            }),
            px_fetch_more_trace: expect.objectContaining({
              description: expect.any(String),
              inputSchema: expect.any(Object),
              execute: expect.any(Function),
            }),
          }),
          stopWhen: expect.objectContaining({
            type: "stepCount",
            count: 25,
          }),
        })
      );
    });
  });
});
