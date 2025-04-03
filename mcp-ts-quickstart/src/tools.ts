import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { fetchStory, fetchTopStories } from "./data.ts";
import { objectToMessage } from "./util.ts";

type ToolTuple = Extract<Parameters<McpServer["tool"]>, { length: 4 }>;

export const topStories = [
  "topStories",
  "Get the top stories from Hacker News",
  {},
  async (args, extra) => {
    const stories = await fetchTopStories()
      .then((storyIds) => storyIds.slice(0, 10))
      .then((storyIds) => Promise.all(storyIds.map((id) => fetchStory(id))))
      .then((stories) => {
        return {
          content: [
            {
              type: "text",
              text: "Top stories",
            },
            ...stories.map(
              (story) =>
                ({
                  type: "text",
                  text: objectToMessage(story),
                }) satisfies CallToolResult["content"][number],
            ),
          ],
        } satisfies CallToolResult;
      })
      .catch(() => {
        return {
          content: [
            {
              type: "text",
              text: "Error fetching top stories",
            },
          ],
        } satisfies CallToolResult;
      });
    return stories;
  },
] satisfies ToolTuple;
