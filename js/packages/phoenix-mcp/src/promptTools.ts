import type { PhoenixClient } from "@arizeai/phoenix-client";
import { createPrompt, promptVersion } from "@arizeai/phoenix-client/prompts";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { ANTHROPIC_DEFAULT_MAX_TOKENS } from "./constants.js";
import { fetchAllPages } from "./pagination.js";
import {
  addPromptVersionTagSchema,
  createPromptSchema,
  getLatestPromptSchema,
  getPromptSchema,
  getPromptByIdentifierSchema,
  getPromptVersionByTagSchema,
  getPromptVersionSchema,
  listPromptsSchema,
  listPromptVersionsSchema,
  listPromptVersionTagsSchema,
} from "./promptSchemas.js";
import { getResponseData } from "./responseUtils.js";
import { jsonResponse, textResponse } from "./toolResults.js";

// ---------------------------------------------------------------------------
// Tool descriptions
// ---------------------------------------------------------------------------

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
          "content": "Please summarize the following {{topic}} article:\\n\\n{{article}}"
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
  Prompt version object with template and configuration.`;

const GET_PROMPT_VERSION_DESCRIPTION = `Get a specific version of a prompt using its version ID. Returns the prompt version with its template, model configuration, and invocation parameters.

Example usage:
  Get a specific prompt version with ID 'promptversionid1234'

Expected return:
  Prompt version object with template and configuration.`;

const GET_PROMPT_DESCRIPTION = `Get a prompt using a single MCP-native interface.

Provide a prompt identifier to fetch the latest version, or add a tag or versionId to select a specific version.

Example usage:
  Get prompt "article-summarizer"
  Get prompt "article-summarizer" with tag "production"
  Get prompt "article-summarizer" using version "promptversionid1234"

Expected return:
  Prompt version object with template and configuration.`;

const UPSERT_PROMPT_DESCRIPTION = `Create or update a prompt with its template and configuration. Creates a new prompt and its initial version with specified model settings.

Example usage:
  Create a new prompt named 'email_generator' with a template for generating emails

Expected return:
  A confirmation message of successful prompt creation`;

const LIST_PROMPT_VERSIONS_DESCRIPTION = `Get a list of all versions for a specific prompt. Returns versions with pagination support.

Example usage:
  List all versions of a prompt named 'article-summarizer'

Expected return:
  Array of prompt version objects with IDs and configuration.`;

const GET_PROMPT_VERSION_BY_TAG_DESCRIPTION = `Get a prompt version by its tag name. Returns the prompt version with its template, model configuration, and invocation parameters.

Example usage:
  Get the 'production' tagged version of prompt 'article-summarizer'

Expected return:
  Prompt version object with template and configuration.`;

const LIST_PROMPT_VERSION_TAGS_DESCRIPTION = `Get a list of all tags for a specific prompt version. Returns tag objects with pagination support.

Example usage:
  List all tags associated with prompt version 'promptversionid1234'

Expected return:
  Array of tag objects with names and IDs.`;

const ADD_PROMPT_VERSION_TAG_DESCRIPTION = `Add a tag to a specific prompt version. The operation returns no content on success (204 status code).

Example usage:
  Tag prompt version 'promptversionid1234' with the name 'production'

Expected return:
  Confirmation message of successful tag addition`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fetch a prompt version by the most specific selector available:
 * versionId > tag > latest.
 */
async function fetchPromptVersionBySelection({
  client,
  promptIdentifier,
  tag,
  versionId,
}: {
  client: PhoenixClient;
  promptIdentifier?: string;
  tag?: string;
  versionId?: string;
}) {
  if (versionId) {
    const response = await client.GET(
      "/v1/prompt_versions/{prompt_version_id}",
      {
        params: {
          path: {
            prompt_version_id: versionId,
          },
        },
      }
    );
    return getResponseData({
      response,
      errorPrefix: `Failed to fetch prompt version "${versionId}"`,
    }).data;
  }

  if (!promptIdentifier) {
    throw new Error(
      "promptIdentifier is required when versionId is not provided"
    );
  }

  if (tag) {
    const response = await client.GET(
      "/v1/prompts/{prompt_identifier}/tags/{tag_name}",
      {
        params: {
          path: {
            prompt_identifier: promptIdentifier,
            tag_name: tag,
          },
        },
      }
    );
    return getResponseData({
      response,
      errorPrefix: `Failed to fetch prompt "${promptIdentifier}" with tag "${tag}"`,
    }).data;
  }

  const response = await client.GET("/v1/prompts/{prompt_identifier}/latest", {
    params: {
      path: {
        prompt_identifier: promptIdentifier,
      },
    },
  });
  return getResponseData({
    response,
    errorPrefix: `Failed to fetch prompt "${promptIdentifier}"`,
  }).data;
}

/**
 * Build a single-message chat template for prompt version creation.
 */
function buildChatTemplate(templateText: string) {
  return [
    {
      role: "user" as const,
      content: [{ type: "text" as const, text: templateText }],
    },
  ];
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

/**
 * Register all prompt-related MCP tools on the given server.
 */
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
      const prompts = await fetchAllPages({
        limit,
        fetchPage: async (cursor, pageSize) => {
          const response = await client.GET("/v1/prompts", {
            params: { query: { cursor, limit: pageSize } },
          });
          const data = getResponseData({
            response,
            errorPrefix: "Failed to fetch prompts",
          });
          return { data: data.data, nextCursor: data.next_cursor || undefined };
        },
      });

      return jsonResponse(prompts);
    }
  );

  server.tool(
    "get-prompt",
    GET_PROMPT_DESCRIPTION,
    getPromptSchema.shape,
    async ({ prompt_identifier, tag, version_id }) => {
      const prompt = await fetchPromptVersionBySelection({
        client,
        promptIdentifier: prompt_identifier,
        tag,
        versionId: version_id,
      });
      return jsonResponse(prompt);
    }
  );

  server.tool(
    "get-latest-prompt",
    GET_LATEST_PROMPT_DESCRIPTION,
    getLatestPromptSchema.shape,
    async ({ prompt_identifier }) => {
      const prompt = await fetchPromptVersionBySelection({
        client,
        promptIdentifier: prompt_identifier,
      });
      return jsonResponse(prompt);
    }
  );

  server.tool(
    "get-prompt-by-identifier",
    GET_PROMPT_BY_IDENTIFIER_DESCRIPTION,
    getPromptByIdentifierSchema.shape,
    async ({ prompt_identifier }) => {
      const prompt = await fetchPromptVersionBySelection({
        client,
        promptIdentifier: prompt_identifier,
      });
      return jsonResponse(prompt);
    }
  );

  server.tool(
    "get-prompt-version",
    GET_PROMPT_VERSION_DESCRIPTION,
    getPromptVersionSchema.shape,
    async ({ prompt_version_id }) => {
      const prompt = await fetchPromptVersionBySelection({
        client,
        versionId: prompt_version_id,
      });
      return jsonResponse(prompt);
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
      const chatTemplate = buildChatTemplate(template);
      const versionDescription = description || "";

      let promptVersionData;
      switch (model_provider) {
        case "OPENAI":
          promptVersionData = promptVersion({
            modelProvider: "OPENAI",
            modelName: model_name,
            description: versionDescription,
            template: chatTemplate,
            invocationParameters: { temperature },
          });
          break;
        case "AZURE_OPENAI":
          promptVersionData = promptVersion({
            modelProvider: "AZURE_OPENAI",
            modelName: model_name,
            description: versionDescription,
            template: chatTemplate,
            invocationParameters: { temperature },
          });
          break;
        case "ANTHROPIC":
          promptVersionData = promptVersion({
            modelProvider: "ANTHROPIC",
            modelName: model_name,
            description: versionDescription,
            template: chatTemplate,
            invocationParameters: {
              temperature,
              max_tokens: ANTHROPIC_DEFAULT_MAX_TOKENS,
            },
          });
          break;
        case "GOOGLE":
          promptVersionData = promptVersion({
            modelProvider: "GOOGLE",
            modelName: model_name,
            description: versionDescription,
            template: chatTemplate,
            invocationParameters: { temperature },
          });
          break;
      }

      const response = await createPrompt({
        client,
        name,
        description: versionDescription,
        version: promptVersionData,
      });
      return textResponse(
        `Successfully created prompt "${name}":\n${JSON.stringify(response, null, 2)}`
      );
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
            path: { prompt_identifier },
            query: { limit },
          },
        }
      );
      const promptVersions = getResponseData({
        response,
        errorPrefix: `Failed to fetch prompt versions for "${prompt_identifier}"`,
      });

      return jsonResponse(promptVersions);
    }
  );

  server.tool(
    "get-prompt-version-by-tag",
    GET_PROMPT_VERSION_BY_TAG_DESCRIPTION,
    getPromptVersionByTagSchema.shape,
    async ({ prompt_identifier, tag_name }) => {
      const prompt = await fetchPromptVersionBySelection({
        client,
        promptIdentifier: prompt_identifier,
        tag: tag_name,
      });
      return jsonResponse(prompt);
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
            path: { prompt_version_id },
            query: { limit },
          },
        }
      );
      const tags = getResponseData({
        response,
        errorPrefix: `Failed to fetch tags for prompt version "${prompt_version_id}"`,
      });

      return jsonResponse(tags);
    }
  );

  server.tool(
    "add-prompt-version-tag",
    ADD_PROMPT_VERSION_TAG_DESCRIPTION,
    addPromptVersionTagSchema.shape,
    async ({ prompt_version_id, name, description }) => {
      await client.POST("/v1/prompt_versions/{prompt_version_id}/tags", {
        params: {
          path: { prompt_version_id },
        },
        body: { name, description },
      });
      return textResponse(
        `Successfully added tag "${name}" to prompt version ${prompt_version_id}`
      );
    }
  );
};
