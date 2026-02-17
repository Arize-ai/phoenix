import { createAgent } from "../agent/index.js";
import { dateTimeTool, phoenixDocsTool } from "../tools/index.js";

/**
 * Default agent instance with standard tools
 */
export const agent = createAgent({
  tools: {
    dateTime: dateTimeTool,
    phoenixDocs: phoenixDocsTool,
  },
});
