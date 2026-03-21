import type { PhoenixClient } from "@arizeai/phoenix-client";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";

import { getResponseData } from "./responseUtils.js";
import { jsonResponse } from "./toolResults.js";

const LIST_ANNOTATION_CONFIGS_DESCRIPTION = `List Phoenix annotation configs.

Annotation configs define the available human or automated labels, scores, and freeform annotation types.

Example usage:
  Show me all annotation configs

Expected return:
  Array of annotation config objects.`;

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
      limit: z.number().min(1).max(500).default(100).optional(),
    },
    async ({ limit = 100 }) => {
      const configs: unknown[] = [];
      let cursor: string | undefined;

      do {
        const pageLimit = Math.min(limit - configs.length, 100);
        const response = await client.GET("/v1/annotation_configs", {
          params: {
            query: {
              cursor,
              limit: pageLimit,
            },
          },
        });
        const data = getResponseData({
          response,
          errorPrefix: "Failed to fetch annotation configs",
        });

        configs.push(...data.data);
        cursor = data.next_cursor || undefined;
      } while (cursor && configs.length < limit);

      return jsonResponse(configs.slice(0, limit));
    }
  );
};
