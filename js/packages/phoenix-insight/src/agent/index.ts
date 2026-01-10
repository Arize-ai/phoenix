/**
 * Phoenix Insight AI agent setup using Vercel AI SDK
 */

import {
  generateText,
  streamText,
  tool,
  stepCountIs,
  type GenerateTextResult,
  type StreamTextResult,
} from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import type { ExecutionMode } from "../modes/types.js";
import { INSIGHT_SYSTEM_PROMPT } from "../prompts/system.js";
import {
  fetchMoreSpans,
  fetchMoreTrace,
  type FetchMoreSpansOptions,
  type FetchMoreTraceOptions,
} from "../commands/index.js";
import type { PhoenixClient } from "@arizeai/phoenix-client";
import { PhoenixClientError } from "../snapshot/client.js";

/**
 * Configuration for the Phoenix Insight agent
 */
export interface PhoenixInsightAgentConfig {
  /** The execution mode (sandbox or local) */
  mode: ExecutionMode;
  /** Phoenix client instance */
  client: PhoenixClient;
  /** Maximum number of agent steps before stopping (default: 25) */
  maxSteps?: number;
}

/**
 * Phoenix Insight Agent
 */
export class PhoenixInsightAgent {
  private mode: ExecutionMode;
  private client: PhoenixClient;
  private maxSteps: number;
  private tools: Record<string, any> | null = null;
  private model = anthropic("claude-sonnet-4-5");

  constructor(config: PhoenixInsightAgentConfig) {
    this.mode = config.mode;
    this.client = config.client;
    this.maxSteps = config.maxSteps || 25;
  }

  /**
   * Initialize the agent tools
   */
  private async initializeTools(): Promise<Record<string, any>> {
    if (this.tools) return this.tools;

    // Get the bash tool from the execution mode
    const bashTool = await this.mode.getBashTool();

    // Store references in closure for the custom tools
    const client = this.client;
    const mode = this.mode;

    // Create custom px-fetch-more-spans tool using AI SDK's tool function
    const pxFetchMoreSpans = tool({
      description:
        "Fetch additional spans from Phoenix. Use when you need more span data than what's in the snapshot. You must provide both project name and optionally a limit.",
      inputSchema: z.object({
        project: z.string().describe("The project name"),
        limit: z
          .number()
          .optional()
          .describe("Number of spans to fetch (default: 500)"),
        startTime: z
          .string()
          .optional()
          .describe("Start time filter in ISO format"),
        endTime: z
          .string()
          .optional()
          .describe("End time filter in ISO format"),
      }),
      execute: async (params) => {
        try {
          const options: FetchMoreSpansOptions = {
            project: params.project,
            limit: params.limit || 500,
            startTime: params.startTime,
            endTime: params.endTime,
          };

          await fetchMoreSpans(client, mode, options);

          return {
            success: true,
            message: `Fetched additional spans for project ${params.project}. Data saved to /phoenix/projects/${params.project}/spans/`,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
    });

    // Create custom px-fetch-more-trace tool using AI SDK's tool function
    const pxFetchMoreTrace = tool({
      description:
        "Fetch a specific trace by ID from Phoenix. Use when you need to examine a particular trace in detail. You must provide both the trace ID and the project name.",
      inputSchema: z.object({
        traceId: z.string().describe("The trace ID to fetch"),
        project: z.string().describe("The project name to search in"),
      }),
      execute: async (params) => {
        try {
          const options: FetchMoreTraceOptions = {
            traceId: params.traceId,
            project: params.project,
          };

          await fetchMoreTrace(client, mode, options);

          return {
            success: true,
            message: `Fetched trace ${params.traceId}. Data saved to /phoenix/traces/${params.traceId}/`,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
    });

    this.tools = {
      bash: bashTool,
      px_fetch_more_spans: pxFetchMoreSpans,
      px_fetch_more_trace: pxFetchMoreTrace,
    };

    return this.tools;
  }

  /**
   * Generate a response for a user query
   */
  async generate(
    userQuery: string,
    options?: {
      onStepFinish?: (step: any) => void;
    }
  ): Promise<GenerateTextResult<any, any>> {
    let tools;
    try {
      tools = await this.initializeTools();
    } catch (error) {
      throw new Error(
        `Failed to initialize agent tools: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    try {
      const result = await generateText({
        model: this.model,
        system: INSIGHT_SYSTEM_PROMPT,
        prompt: userQuery,
        tools,
        stopWhen: stepCountIs(this.maxSteps),
        onStepFinish: options?.onStepFinish,
        experimental_telemetry: {
          isEnabled: true,
        },
      });

      return result;
    } catch (error) {
      // Check for specific AI SDK errors
      if (error instanceof Error) {
        if (error.message.includes("rate limit")) {
          throw new Error(
            "AI model rate limit exceeded. Please wait and try again."
          );
        }
        if (error.message.includes("timeout")) {
          throw new Error("AI model request timed out. Please try again.");
        }
        if (
          error.message.includes("authentication") ||
          error.message.includes("API key")
        ) {
          throw new Error(
            "AI model authentication failed. Check your API key configuration."
          );
        }
      }

      throw new Error(
        `AI generation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Stream a response for a user query
   */
  async stream(
    userQuery: string,
    options?: {
      onStepFinish?: (step: any) => void;
    }
  ): Promise<StreamTextResult<any, any>> {
    let tools;
    try {
      tools = await this.initializeTools();
    } catch (error) {
      throw new Error(
        `Failed to initialize agent tools: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    try {
      const result = streamText({
        model: this.model,
        system: INSIGHT_SYSTEM_PROMPT,
        prompt: userQuery,
        tools,
        stopWhen: stepCountIs(this.maxSteps),
        onStepFinish: options?.onStepFinish,
      });

      return result;
    } catch (error) {
      // Check for specific AI SDK errors
      if (error instanceof Error) {
        if (error.message.includes("rate limit")) {
          throw new Error(
            "AI model rate limit exceeded. Please wait and try again."
          );
        }
        if (error.message.includes("timeout")) {
          throw new Error("AI model request timed out. Please try again.");
        }
        if (
          error.message.includes("authentication") ||
          error.message.includes("API key")
        ) {
          throw new Error(
            "AI model authentication failed. Check your API key configuration."
          );
        }
      }

      throw new Error(
        `AI streaming failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    await this.mode.cleanup();
  }
}

/**
 * Creates a Phoenix Insight agent
 */
export async function createInsightAgent(
  config: PhoenixInsightAgentConfig
): Promise<PhoenixInsightAgent> {
  return new PhoenixInsightAgent(config);
}

/**
 * Run a query with the Phoenix Insight agent
 */
export async function runQuery(
  agent: PhoenixInsightAgent,
  userQuery: string,
  options?: {
    onStepFinish?: (step: any) => void;
    stream?: boolean;
  }
): Promise<GenerateTextResult<any, any> | StreamTextResult<any, any>> {
  const { stream = false, ...callbacks } = options || {};

  if (stream) {
    return await agent.stream(userQuery, callbacks);
  } else {
    return await agent.generate(userQuery, callbacks);
  }
}

/**
 * Create and run a one-shot query
 */
export async function runOneShotQuery(
  config: PhoenixInsightAgentConfig,
  userQuery: string,
  options?: {
    onStepFinish?: (step: any) => void;
    stream?: boolean;
  }
): Promise<GenerateTextResult<any, any> | StreamTextResult<any, any>> {
  const agent = await createInsightAgent(config);

  try {
    const result = await runQuery(agent, userQuery, options);
    return result;
  } finally {
    await agent.cleanup();
  }
}
