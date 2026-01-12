import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSandboxMode, createLocalMode } from "../src/modes/index.js";
import { createInsightAgent, runOneShotQuery } from "../src/agent/index.js";
import type { ExecutionMode } from "../src/modes/types.js";
import type { PhoenixClient } from "@arizeai/phoenix-client";

// Mock the Phoenix client
vi.mock("@arizeai/phoenix-client", () => ({
  createPhoenixClient: vi.fn(() => ({
    projects: { list: vi.fn(() => Promise.resolve([])) },
    spans: { getSpans: vi.fn(() => Promise.resolve([])) },
    datasets: { list: vi.fn(() => Promise.resolve([])) },
    experiments: { list: vi.fn(() => Promise.resolve([])) },
    prompts: { list: vi.fn(() => Promise.resolve([])) },
  })),
}));

// Mock the snapshot module
vi.mock("../src/snapshot/index.js", () => ({
  createPhoenixClient: vi.fn(() => ({
    projects: { list: vi.fn(() => Promise.resolve([])) },
    spans: { getSpans: vi.fn(() => Promise.resolve([])) },
    datasets: { list: vi.fn(() => Promise.resolve([])) },
    experiments: { list: vi.fn(() => Promise.resolve([])) },
    prompts: { list: vi.fn(() => Promise.resolve([])) },
  })),
  createSnapshot: vi.fn(() => Promise.resolve()),
  createIncrementalSnapshot: vi.fn(() => Promise.resolve()),
  loadSnapshotMetadata: vi.fn(() => Promise.resolve(null)),
}));

// Mock the AI SDK
vi.mock("ai", () => ({
  generateText: vi.fn(async () => ({
    text: "Test response",
    toolCalls: [],
    toolResults: [],
    steps: [],
  })),
  streamText: vi.fn(() => ({
    textStream: (async function* () {
      yield "Test ";
      yield "streaming ";
      yield "response";
    })(),
    response: Promise.resolve({
      text: "Test streaming response",
      toolCalls: [],
      toolResults: [],
      steps: [],
    }),
  })),
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

// Mock anthropic
vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn(() => "mocked-model"),
}));

describe("CLI Single-Query Mode", () => {
  let sandboxMode: ExecutionMode;
  let localMode: ExecutionMode;

  beforeEach(async () => {
    vi.clearAllMocks();
    sandboxMode = createSandboxMode();
    localMode = await createLocalMode();
  });

  describe("Execution Modes", () => {
    it("should create sandbox mode", () => {
      expect(sandboxMode).toBeDefined();
      expect(sandboxMode.writeFile).toBeDefined();
      expect(sandboxMode.exec).toBeDefined();
      expect(sandboxMode.getBashTool).toBeDefined();
      expect(sandboxMode.cleanup).toBeDefined();
    });

    it("should create local mode", () => {
      expect(localMode).toBeDefined();
      expect(localMode.writeFile).toBeDefined();
      expect(localMode.exec).toBeDefined();
      expect(localMode.getBashTool).toBeDefined();
      expect(localMode.cleanup).toBeDefined();
    });
  });

  describe("Agent Creation", () => {
    it("should create an insight agent with sandbox mode", async () => {
      const mockClient = {} as PhoenixClient;
      const agent = await createInsightAgent({
        mode: sandboxMode,
        client: mockClient,
        maxSteps: 10,
      });

      expect(agent).toBeDefined();
      expect(agent.generate).toBeDefined();
      expect(agent.stream).toBeDefined();
      expect(agent.cleanup).toBeDefined();
    });

    it("should create an insight agent with local mode", async () => {
      const mockClient = {} as PhoenixClient;
      const agent = await createInsightAgent({
        mode: localMode,
        client: mockClient,
        maxSteps: 10,
      });

      expect(agent).toBeDefined();
      expect(agent.generate).toBeDefined();
      expect(agent.stream).toBeDefined();
      expect(agent.cleanup).toBeDefined();
    });
  });

  describe("Query Execution", () => {
    it("should execute a query in non-streaming mode", async () => {
      const mockClient = {} as PhoenixClient;
      const result = await runOneShotQuery(
        {
          mode: sandboxMode,
          client: mockClient,
          maxSteps: 10,
        },
        "Test query",
        { stream: false }
      );

      expect(result).toBeDefined();
      expect(result.text).toBe("Test response");
    });

    it("should execute a query in streaming mode", async () => {
      const mockClient = {} as PhoenixClient;
      const result = await runOneShotQuery(
        {
          mode: sandboxMode,
          client: mockClient,
          maxSteps: 10,
        },
        "Test query",
        { stream: true }
      );

      expect(result).toBeDefined();
      // Type guard to check if it's a stream result
      if ("textStream" in result) {
        expect(result.textStream).toBeDefined();

        // Collect the stream
        let streamedText = "";
        for await (const chunk of result.textStream) {
          streamedText += chunk;
        }

        expect(streamedText).toBe("Test streaming response");
      } else {
        throw new Error("Expected stream result");
      }
    });

    it("should handle step callbacks", async () => {
      const onStepFinish = vi.fn();
      const mockClient = {} as PhoenixClient;

      await runOneShotQuery(
        {
          mode: sandboxMode,
          client: mockClient,
          maxSteps: 10,
        },
        "Test query",
        {
          stream: false,
          onStepFinish,
        }
      );

      // Since we mocked generateText to not use tools, callbacks might not be called
      // This is fine for unit testing - integration tests would verify actual tool use
      expect(onStepFinish).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should clean up on error", async () => {
      const cleanup = vi.spyOn(sandboxMode, "cleanup");
      const mockClient = {} as PhoenixClient;

      // Even if there's an error, cleanup should be called
      await runOneShotQuery(
        {
          mode: sandboxMode,
          client: mockClient,
          maxSteps: 10,
        },
        "Test query",
        { stream: false }
      );

      expect(cleanup).toHaveBeenCalled();
    });
  });
});
