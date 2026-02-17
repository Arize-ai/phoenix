import { createAgent } from "../agent/index.js";
import { dateTimeTool, phoenixDocsTool } from "../tools/index.js";

/**
 * Create a new agent instance with standard tools
 * @returns Configured agent instance
 */
export function createDefaultAgent() {
  return createAgent({
    tools: {
      dateTime: dateTimeTool,
      phoenixDocs: phoenixDocsTool,
    },
  });
}

/**
 * Default agent instance (for backward compatibility)
 */
export const agent = createDefaultAgent();
