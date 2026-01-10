import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PhoenixInsightAgent,
  createInsightAgent,
  runQuery,
  runOneShotQuery,
  type PhoenixInsightAgentConfig,
} from "../../src/agent/index.js";
import type { ExecutionMode } from "../../src/modes/types.js";
import type { PhoenixClient } from "@arizeai/phoenix-client";

describe("Phoenix Insight Agent", () => {
  let mockMode: ExecutionMode;
  let mockClient: PhoenixClient;
  let mockBashTool: any;

  beforeEach(() => {
    // Create mock bash tool
    mockBashTool = {
      description: "Execute bash commands",
      inputSchema: {
        type: "object",
        properties: {
          command: { type: "string" },
        },
      },
      execute: vi.fn().mockResolvedValue({
        stdout: "test output",
        stderr: "",
        exitCode: 0,
      }),
    };

    // Create mock execution mode
    mockMode = {
      writeFile: vi.fn().mockResolvedValue(undefined),
      exec: vi.fn().mockResolvedValue({
        stdout: "",
        stderr: "",
        exitCode: 0,
      }),
      getBashTool: vi.fn().mockResolvedValue(mockBashTool),
      cleanup: vi.fn().mockResolvedValue(undefined),
    };

    // Create mock Phoenix client
    mockClient = {} as PhoenixClient;
  });

  describe("PhoenixInsightAgent", () => {
    it("should create an agent with default max steps", () => {
      const config: PhoenixInsightAgentConfig = {
        mode: mockMode,
        client: mockClient,
      };

      const agent = new PhoenixInsightAgent(config);
      expect(agent).toBeInstanceOf(PhoenixInsightAgent);
    });

    it("should create an agent with custom max steps", () => {
      const config: PhoenixInsightAgentConfig = {
        mode: mockMode,
        client: mockClient,
        maxSteps: 50,
      };

      const agent = new PhoenixInsightAgent(config);
      expect(agent).toBeInstanceOf(PhoenixInsightAgent);
    });

    it("should initialize tools correctly", async () => {
      const config: PhoenixInsightAgentConfig = {
        mode: mockMode,
        client: mockClient,
      };

      const agent = new PhoenixInsightAgent(config);
      // The tools are private, but we can test getBashTool was called
      // when we call generate
      await agent.generate("test query").catch(() => {});
      expect(mockMode.getBashTool).toHaveBeenCalled();
    });

    it("should cleanup resources", async () => {
      const config: PhoenixInsightAgentConfig = {
        mode: mockMode,
        client: mockClient,
      };

      const agent = new PhoenixInsightAgent(config);
      await agent.cleanup();
      expect(mockMode.cleanup).toHaveBeenCalled();
    });
  });

  describe("createInsightAgent", () => {
    it("should create and return a Phoenix Insight agent", async () => {
      const config: PhoenixInsightAgentConfig = {
        mode: mockMode,
        client: mockClient,
        maxSteps: 30,
      };

      const agent = await createInsightAgent(config);
      expect(agent).toBeInstanceOf(PhoenixInsightAgent);
    });
  });

  describe("runQuery", () => {
    it("should run a query with generate method when stream is false", async () => {
      const config: PhoenixInsightAgentConfig = {
        mode: mockMode,
        client: mockClient,
      };

      const agent = await createInsightAgent(config);
      const generateSpy = vi.spyOn(agent, "generate");
      const streamSpy = vi.spyOn(agent, "stream");

      // Mock the generate method
      generateSpy.mockResolvedValue({
        text: "test response",
        content: [],
        reasoning: [],
        reasoningText: "",
        files: [],
        steps: [],
        toolCalls: [],
        toolResults: [],
        warnings: [],
        finishReason: "stop",
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        },
        metadata: {},
      } as any);

      const result = await runQuery(agent, "test query", { stream: false });

      expect(generateSpy).toHaveBeenCalledWith("test query", {});
      expect(streamSpy).not.toHaveBeenCalled();
    });

    it("should run a query with stream method when stream is true", async () => {
      const config: PhoenixInsightAgentConfig = {
        mode: mockMode,
        client: mockClient,
      };

      const agent = await createInsightAgent(config);
      const generateSpy = vi.spyOn(agent, "generate");
      const streamSpy = vi.spyOn(agent, "stream");

      // Mock the stream method
      const mockStream = {
        textStream: "mock stream",
        content: Promise.resolve([]),
        text: Promise.resolve("test response"),
        reasoning: Promise.resolve([]),
        reasoningText: Promise.resolve(""),
        files: Promise.resolve([]),
        steps: Promise.resolve([]),
        toolCalls: Promise.resolve([]),
        toolResults: Promise.resolve([]),
        warnings: Promise.resolve([]),
        finishReason: Promise.resolve("stop"),
        usage: Promise.resolve({
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        }),
        metadata: Promise.resolve({}),
        toDataStreamResponse: () => ({}) as any,
        pipeDataStreamToResponse: () => ({}) as any,
      } as any;
      streamSpy.mockResolvedValue(mockStream);

      const result = await runQuery(agent, "test query", { stream: true });

      expect(streamSpy).toHaveBeenCalledWith("test query", {});
      expect(generateSpy).not.toHaveBeenCalled();
      expect(result).toBe(mockStream);
    });

    it("should pass callbacks to generate method", async () => {
      const config: PhoenixInsightAgentConfig = {
        mode: mockMode,
        client: mockClient,
      };

      const agent = await createInsightAgent(config);
      const generateSpy = vi.spyOn(agent, "generate");

      const onStepFinish = vi.fn();

      generateSpy.mockResolvedValue({
        text: "test response",
        content: [],
        reasoning: [],
        reasoningText: "",
        files: [],
        steps: [],
        toolCalls: [],
        toolResults: [],
        warnings: [],
        finishReason: "stop",
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        },
        metadata: {},
      } as any);

      await runQuery(agent, "test query", {
        onStepFinish,
        stream: false,
      });

      expect(generateSpy).toHaveBeenCalledWith("test query", {
        onStepFinish,
      });
    });
  });

  describe("runOneShotQuery", () => {
    it("should create agent, run query, and cleanup", async () => {
      const config: PhoenixInsightAgentConfig = {
        mode: mockMode,
        client: mockClient,
      };

      // We can't easily mock the AI SDK's generateText, so we'll just
      // verify the cleanup happens (the query will fail but cleanup should still run)
      try {
        await runOneShotQuery(config, "test query");
      } catch (error) {
        // Expected - AI SDK will fail without proper setup
      }

      expect(mockMode.getBashTool).toHaveBeenCalled();
      expect(mockMode.cleanup).toHaveBeenCalled();
    });

    it("should cleanup even if query fails", async () => {
      const config: PhoenixInsightAgentConfig = {
        mode: mockMode,
        client: mockClient,
      };

      try {
        await runOneShotQuery(config, "test query");
      } catch (error) {
        // Expected error
      }

      expect(mockMode.cleanup).toHaveBeenCalled();
    });
  });

  describe("Tool Integration", () => {
    it("should create tools with correct structure", async () => {
      const config: PhoenixInsightAgentConfig = {
        mode: mockMode,
        client: mockClient,
      };

      const agent = new PhoenixInsightAgent(config);

      // We can't directly access private tools, but we can verify
      // that getBashTool was called when initializing for a query
      await agent.generate("test").catch(() => {});
      expect(mockMode.getBashTool).toHaveBeenCalled();
    });
  });
});
