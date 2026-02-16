/**
 * Agent Tools
 *
 * This module exports all available tools for the Phoenix documentation assistant.
 * Tools are declarative and can be easily added, removed, or modified.
 *
 * Tool Naming Convention:
 * - All tools should use camelCase with a "Tool" suffix (e.g., dateTimeTool, phoenixDocsTool)
 * - Tool files should match the tool name without the suffix (e.g., datetime.ts, mcp.ts)
 * - Each tool should be exported as a named export with clear JSDoc documentation
 *
 * Adding a New Tool:
 * 1. Create a new file in src/tools/ (e.g., mytool.ts)
 * 2. Export your tool with consistent naming (e.g., export const myTool)
 * 3. Import and re-export here
 * 4. Add to the tools object in src/cli.ts
 */

// Utility tools
export { dateTimeTool } from "./datetime.js";

// MCP (Model Context Protocol) tools
export { phoenixDocsTool } from "./mcp.js";
