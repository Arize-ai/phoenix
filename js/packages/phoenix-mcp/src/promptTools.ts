import { PhoenixClient } from "@arizeai/phoenix-client";
import { createPrompt, promptVersion } from "@arizeai/phoenix-client/prompts";

import {
  addPromptVersionTagSchema,
  createPromptSchema,
  getLatestPromptSchema,
  getPromptByIdentifierSchema,
  getPromptVersionByTagSchema,
  getPromptVersionSchema,
  listPromptsSchema,
  listPromptVersionsSchema,
  listPromptVersionTagsSchema,
} from "./promptSchemas.js";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Tool descriptions as template literals for better readability
const LIST_PROMPTS_DESCRIPTION = `Get a list of all the prompts.

Prompts (templates, prompt templates) are versioned templates for input messages to an LLM.
Each prompt includes both the input messages, but also the model and invocation parameters
to use when generating outputs.

Returns a list of prompt objects with their IDs, names, and descriptions.

Example usage: 
  List all available prompts

Expected return: 
  Array of prompt objects with metadata. 
  Example:  [{
      "name": "article-summarizer",
      "description": "Summarizes an article into concise bullet points",
      "source_prompt_id": null,
      "id": "promptid1234"
  }]`;

const GET_LATEST_PROMPT_DESCRIPTION = `Get the latest version of a prompt. Returns the prompt version with its template, model configuration, and invocation parameters.

Example usage: 
  Get the latest version of a prompt named 'article-summarizer'

Expected return: 
  Prompt version object with template and configuration. 
  Example: {
    "description": "Initial version",
    "model_provider": "OPENAI",
    "model_name": "gpt-3.5-turbo",
    "template": {
      "type": "chat",
      "messages": [
        {
          "role": "system",
          "content": "You are an expert summarizer. Create clear, concise bullet points highlighting the key information."
        },
        {
          "role": "user",
          "content": "Please summarize the following {{topic}} article:\n\n{{article}}"
        }
      ]
    },
    "template_type": "CHAT",
    "template_format": "MUSTACHE",
    "invocation_parameters": {
      "type": "openai",
      "openai": {}
    },
    "id": "promptversionid1234"
  }`;

const GET_PROMPT_BY_IDENTIFIER_DESCRIPTION = `Get a prompt's latest version by its identifier (name or ID). Returns the prompt version with its template, model configuration, and invocation parameters.

Example usage: 
  Get the latest version of a prompt with name 'article-summarizer'

Expected return: 
  Prompt version object with template and configuration. 
    Example: {
      "description": "Initial version",
      "model_provider": "OPENAI",
      "model_name": "gpt-3.5-turbo",
      "template": {
        "type": "chat",
        "messages": [
          {
            "role": "system",
            "content": "You are an expert summarizer. Create clear, concise bullet points highlighting the key information."
          },
          {
            "role": "user",
            "content": "Please summarize the following {{topic}} article:\n\n{{article}}"
          }
        ]
      },
      "template_type": "CHAT",
      "template_format": "MUSTACHE",
      "invocation_parameters": {
        "type": "openai",
        "openai": {}
      },
      "id": "promptversionid1234"
    }`;

const GET_PROMPT_VERSION_DESCRIPTION = `Get a specific version of a prompt using its version ID. Returns the prompt version with its template, model configuration, and invocation parameters.

Example usage: 
  Get a specific prompt version with ID 'promptversionid1234'

Expected return: 
  Prompt version object with template and configuration. 
  Example: {
    "description": "Initial version",
    "model_provider": "OPENAI",
    "model_name": "gpt-3.5-turbo",
    "template": {
      "type": "chat",
      "messages": [
        {
          "role": "system",
          "content": "You are an expert summarizer. Create clear, concise bullet points highlighting the key information."
        },
        {
          "role": "user",
          "content": "Please summarize the following {{topic}} article:\n\n{{article}}"
        }
      ]
    },
    "template_type": "CHAT",
    "template_format": "MUSTACHE",
    "invocation_parameters": {
      "type": "openai",
      "openai": {}
    },
    "id": "promptversionid1234"
  }`;

const UPSERT_PROMPT_DESCRIPTION = `Create or update a prompt with its template and configuration. Creates a new prompt and its initial version with specified model settings.

Example usage: 
  Create a new prompt named 'email_generator' with a template for generating emails

Expected return: 
  A confirmation message of successful prompt creation`;

const LIST_PROMPT_VERSIONS_DESCRIPTION = `Get a list of all versions for a specific prompt. Returns versions with pagination support.

Example usage: 
  List all versions of a prompt named 'article-summarizer'

Expected return: 
  Array of prompt version objects with IDs and configuration. 
  Example: [
    {
      "description": "Initial version",
      "model_provider": "OPENAI",
      "model_name": "gpt-3.5-turbo",
      "template": {
        "type": "chat",
        "messages": [
          {
            "role": "system",
            "content": "You are an expert summarizer. Create clear, concise bullet points highlighting the key information."
          },
          {
            "role": "user",
            "content": "Please summarize the following {{topic}} article:\n\n{{article}}"
          }
        ]
      },
      "template_type": "CHAT",
      "template_format": "MUSTACHE",
      "invocation_parameters": {
        "type": "openai",
        "openai": {}
      },
      "id": "promptversionid1234"
    }
  ]`;

const GET_PROMPT_VERSION_BY_TAG_DESCRIPTION = `Get a prompt version by its tag name. Returns the prompt version with its template, model configuration, and invocation parameters.

Example usage: 
  Get the 'production' tagged version of prompt 'article-summarizer'

Expected return: 
  Prompt version object with template and configuration. 
  Example: {
      "description": "Initial version",
      "model_provider": "OPENAI",
      "model_name": "gpt-3.5-turbo",
      "template": {
        "type": "chat",
        "messages": [
          {
            "role": "system",
            "content": "You are an expert summarizer. Create clear, concise bullet points highlighting the key information."
          },
          {
            "role": "user",
            "content": "Please summarize the following {{topic}} article:\n\n{{article}}"
          }
        ]
      },
      "template_type": "CHAT",
      "template_format": "MUSTACHE",
      "invocation_parameters": {
        "type": "openai",
        "openai": {}
      },
      "id": "promptversionid1234"
    }`;

const LIST_PROMPT_VERSION_TAGS_DESCRIPTION = `Get a list of all tags for a specific prompt version. Returns tag objects with pagination support.

Example usage: 
  List all tags associated with prompt version 'promptversionid1234'

Expected return: 
  Array of tag objects with names and IDs. 
  Example: [
    {
      "name": "staging",
      "description": "The version deployed to staging",
      "id": "promptversionid1234"
    },
    {
      "name": "development",
      "description": "The version deployed for development",
      "id": "promptversionid1234"
    }
  ]`;

const ADD_PROMPT_VERSION_TAG_DESCRIPTION = `Add a tag to a specific prompt version. The operation returns no content on success (204 status code).

Example usage: 
  Tag prompt version 'promptversionid1234' with the name 'production'

Expected return: 
  Confirmation message of successful tag addition`;

export const initializePromptTools = ({
  client,
  server,
}: {
  client: PhoenixClient;
  server: McpServer;
}) => {
  server.tool(
    "list-prompts",
    LIST_PROMPTS_DESCRIPTION,
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
    GET_LATEST_PROMPT_DESCRIPTION,
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
    GET_PROMPT_BY_IDENTIFIER_DESCRIPTION,
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
    GET_PROMPT_VERSION_DESCRIPTION,
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
    UPSERT_PROMPT_DESCRIPTION,
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

  server.tool(
    "list-prompt-versions",
    LIST_PROMPT_VERSIONS_DESCRIPTION,
    listPromptVersionsSchema.shape,
    async ({ prompt_identifier, limit }) => {
      const response = await client.GET(
        "/v1/prompts/{prompt_identifier}/versions",
        {
          params: {
            path: {
              prompt_identifier,
            },
            query: {
              limit,
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
    "get-prompt-version-by-tag",
    GET_PROMPT_VERSION_BY_TAG_DESCRIPTION,
    getPromptVersionByTagSchema.shape,
    async ({ prompt_identifier, tag_name }) => {
      const response = await client.GET(
        "/v1/prompts/{prompt_identifier}/tags/{tag_name}",
        {
          params: {
            path: {
              prompt_identifier,
              tag_name,
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
    "list-prompt-version-tags",
    LIST_PROMPT_VERSION_TAGS_DESCRIPTION,
    listPromptVersionTagsSchema.shape,
    async ({ prompt_version_id, limit }) => {
      const response = await client.GET(
        "/v1/prompt_versions/{prompt_version_id}/tags",
        {
          params: {
            path: {
              prompt_version_id,
            },
            query: {
              limit,
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
    "add-prompt-version-tag",
    ADD_PROMPT_VERSION_TAG_DESCRIPTION,
    addPromptVersionTagSchema.shape,
    async ({ prompt_version_id, name, description }) => {
      await client.POST("/v1/prompt_versions/{prompt_version_id}/tags", {
        params: {
          path: {
            prompt_version_id,
          },
        },
        body: {
          name,
          description,
        },
      });
      return {
        content: [
          {
            type: "text",
            text: `Successfully added tag "${name}" to prompt version ${prompt_version_id}`,
          },
        ],
      };
    }
  );
};
