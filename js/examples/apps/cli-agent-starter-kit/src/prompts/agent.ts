/**
 * Agent System Instructions
 *
 * This module contains system instruction prompts for the CLI agent.
 * These prompts define the agent's behavior, tone, and capabilities.
 */

/**
 * Default system instructions for the CLI agent
 *
 * Provides a balanced approach: helpful, accurate, and friendly
 * while remaining concise in responses.
 */
export const DEFAULT_AGENT_INSTRUCTIONS = `You are a helpful CLI agent. Use the available tools to answer questions accurately. Be concise and friendly.`;

/**
 * Verbose system instructions for detailed explanations
 *
 * Use this when you want the agent to provide more context,
 * explain its reasoning, and give thorough responses.
 */
export const VERBOSE_AGENT_INSTRUCTIONS = `You are a helpful CLI agent with detailed explanations. When using tools, explain your reasoning. Use the available tools to answer questions accurately. Be thorough and friendly.`;

/**
 * Minimal system instructions for terse responses
 *
 * Use this when you want the agent to be as brief as possible
 * while still providing accurate answers.
 */
export const MINIMAL_AGENT_INSTRUCTIONS = `You are a CLI agent. Use tools to answer questions. Be concise.`;
