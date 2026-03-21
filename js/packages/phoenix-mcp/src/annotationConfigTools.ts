import type { PhoenixClient } from "@arizeai/phoenix-client";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";

import { MAX_LIST_LIMIT } from "./constants.js";
import { fetchAllPages } from "./pagination.js";
import { getResponseData } from "./responseUtils.js";
import { jsonResponse } from "./toolResults.js";

// ---------------------------------------------------------------------------
// Tool descriptions
// ---------------------------------------------------------------------------

const LIST_ANNOTATION_CONFIGS_DESCRIPTION = `List Phoenix annotation configs.

Annotation configs define the available human or automated labels, scores, and freeform annotation types.

Example usage:
  Show me all annotation configs

Expected return:
  Array of annotation config objects.`;

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

/**
 * Register annotation-config-related MCP tools on the given server.
 */
export const initializeAnnotationConfigTools = ({
  client,
  server,
}: {
  client: PhoenixClient;
  server: McpServer;
}) => {
  server.tool(
    "list-annotation-configs",
    LIST_ANNOTATION_CONFIGS_DESCRIPTION,
    {
      limit: z.number().min(1).max(MAX_LIST_LIMIT).default(100).optional(),
    },
    async ({ limit = 100 }) => {
      const configs = await fetchAllPages({
        limit,
        fetchPage: async (cursor, pageSize) => {
          const response = await client.GET("/v1/annotation_configs", {
            params: { query: { cursor, limit: pageSize } },
          });
          const data = getResponseData({
            response,
            errorPrefix: "Failed to fetch annotation configs",
          });
          return { data: data.data, nextCursor: data.next_cursor || undefined };
        },
      });

      return jsonResponse(configs);
    }
  );
};
