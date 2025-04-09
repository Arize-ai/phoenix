import { PhoenixClient } from "@arizeai/phoenix-client";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const parseVariablesMustache = (template: string) => {
  const regex = /\{\{([^{}]+)\}\}/g;
  const variables = [];
  let match;
  while ((match = regex.exec(template))) {
    variables.push(match[1]);
  }
  return variables;
};

const parseArgumentsFString = (template: string) => {
  const regex = /\{([^{}]+)\}/g;
  const variables = [];
  let match;
  while ((match = regex.exec(template))) {
    variables.push(match[1]);
  }
  return variables;
};

export const initializePrompts = async ({
  client,
  server,
}: {
  client: PhoenixClient;
  server: McpServer;
}) => {
  server.server.setRequestHandler(ListPromptsRequestSchema, async () => {
    const promptsResponse = await client.GET("/v1/prompts");

    if (!promptsResponse.data) {
      return {
        prompts: [],
      };
    }

    // Get all the prompts and parse out the arguments
    const prompts = await Promise.all(
      promptsResponse.data.data.map(async (prompt) => {
        const promptVersionResponse = await client.GET(
          "/v1/prompts/{prompt_identifier}/latest",
          {
            params: {
              path: {
                prompt_identifier: prompt.name,
              },
            },
          }
        );

        const args: string[] = [];
        const template = promptVersionResponse.data?.data.template;
        const format = promptVersionResponse.data?.data.template_format;
        const parser =
          format === "F_STRING"
            ? parseArgumentsFString
            : parseVariablesMustache;
        if (template && template.type === "chat") {
          template.messages.forEach((message) => {
            const content = message.content;
            if (typeof content === "string") {
              args.push(...parser(content));
            }
          });
        }
        return {
          name: prompt.name,
          description: prompt.description,
          arguments: args,
        };
      })
    );
    return { prompts };
  });

  server.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    // const args = request.params.arguments || {};
    // Get the latest version of the prompt
    const promptVersionResponse = await client.GET(
      "/v1/prompts/{prompt_identifier}/latest",
      {
        params: {
          path: {
            prompt_identifier: request.params.name,
          },
        },
      }
    );

    const template = promptVersionResponse.data?.data.template;
    let messages: { role: string; content: { type: string; text: string } }[] =
      [];
    if (template && template.type === "chat") {
      messages = template.messages
        .map((message) => {
          if (message.role === "system") {
            return undefined;
          }
          const messageContent = message.content;
          if (typeof messageContent === "string") {
            return {
              role: message.role,
              content: {
                type: "text",
                text: messageContent,
              },
            };
          }
          if (Array.isArray(messageContent)) {
            if (
              messageContent.length === 1 &&
              messageContent[0].type === "text"
            ) {
              const messageContentText = messageContent[0].text;
              return {
                role: message.role,
                content: {
                  type: "text",
                  text: messageContentText,
                },
              };
            }
          }
          return undefined;
        })
        .filter((message) => message !== undefined);
    }
    return {
      description: promptVersionResponse.data?.data.description,
      messages: messages,
    };
  });
};
