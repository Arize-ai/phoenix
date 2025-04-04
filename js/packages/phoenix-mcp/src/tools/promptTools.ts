import { PhoenixClient } from "@arizeai/phoenix-client";
import { createPrompt, promptVersion } from "@arizeai/phoenix-client/prompts";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  listPromptsSchema,
  getLatestPromptSchema,
  getPromptByIdentifierSchema,
  getPromptVersionSchema,
  createPromptSchema,
  updatePromptSchema,
  deletePromptSchema,
} from "./promptSchemas";

export const initializePromptTools = ({
  client,
  server,
}: {
  client: PhoenixClient;
  server: McpServer;
}) => {
  server.tool(
    "list-prompts",
    "Get a list of all the prompts",
    listPromptsSchema.shape,
    async ({ limit }) => {
      const response = await client.GET("/v1/prompts", {
        params: {
          query: {
            limit,
          },
        },
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.data?.data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "get-latest-prompt",
    "Get the latest prompt",
    getLatestPromptSchema.shape,
    async ({ prompt_identifier }) => {
      const response = await client.GET(
        "/v1/prompts/{prompt_identifier}/latest",
        {
          params: {
            path: {
              prompt_identifier,
            },
          },
        }
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "get-prompt-by-identifier",
    "Get a prompt's latest version by its identifier",
    getPromptByIdentifierSchema.shape,
    async ({ prompt_identifier }) => {
      const response = await client.GET(
        "/v1/prompts/{prompt_identifier}/latest",
        {
          params: {
            path: {
              prompt_identifier,
            },
          },
        }
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "get-prompt-version",
    "Get a specific version of a prompt given a prompt version id",
    getPromptVersionSchema.shape,
    async ({ prompt_version_id }) => {
      const response = await client.GET(
        "/v1/prompt_versions/{prompt_version_id}",
        {
          params: {
            path: {
              prompt_version_id,
            },
          },
        }
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "upsert-prompt",
    "Create or update a prompt",
    createPromptSchema.shape,
    async ({
      name,
      description,
      template,
      model_provider,
      model_name,
      temperature,
    }) => {
      let promptVersionData;

      switch (model_provider) {
        case "OPENAI":
          promptVersionData = promptVersion({
            modelProvider: "OPENAI",
            modelName: model_name,
            description: description || "",
            template: [
              {
                role: "user",
                content: [{ type: "text", text: template }],
              },
            ],
            invocationParameters: {
              temperature: temperature,
            },
          });
          break;
        case "AZURE_OPENAI":
          promptVersionData = promptVersion({
            modelProvider: "AZURE_OPENAI",
            modelName: model_name,
            description: description || "",
            template: [
              {
                role: "user",
                content: [{ type: "text", text: template }],
              },
            ],
            invocationParameters: {
              temperature: temperature,
            },
          });
          break;
        case "ANTHROPIC":
          promptVersionData = promptVersion({
            modelProvider: "ANTHROPIC",
            modelName: model_name,
            description: description || "",
            template: [
              {
                role: "user",
                content: [{ type: "text", text: template }],
              },
            ],
            invocationParameters: {
              temperature: temperature,
              max_tokens: 1000, // Required for Anthropic
            },
          });
          break;
        case "GOOGLE":
          promptVersionData = promptVersion({
            modelProvider: "GOOGLE",
            modelName: model_name,
            description: description || "",
            template: [
              {
                role: "user",
                content: [{ type: "text", text: template }],
              },
            ],
            invocationParameters: {
              temperature: temperature,
            },
          });
          break;
      }

      const response = await createPrompt({
        client: client,
        name: name,
        description: description || "",
        version: promptVersionData,
      });
      return {
        content: [
          {
            type: "text",
            text: `Successfully created prompt "${name}":\n${JSON.stringify(response, null, 2)}`,
          },
        ],
      };
    }
  );
};

//   server.tool(
//     "delete-prompt",
//     "Delete a prompt",
//     deletePromptSchema.shape,
//     async ({ prompt_identifier }) => {
//       const response = await client.DELETE("/v1/prompts/{prompt_identifier}", {
//         params: {
//           path: {
//             prompt_identifier,
//           },
//         },
//       });
//       return {
//         content: [
//           {
//             type: "text",
//             text: "Prompt deleted successfully",
//           },
//         ],
//       };
//     }
//   );
// };
