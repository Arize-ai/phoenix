import type { PhoenixClient } from "@arizeai/phoenix-client";
import type { ExecutionMode } from "../modes/types.js";
import { withErrorHandling, extractData } from "./client.js";

interface FetchPromptsOptions {
  limit?: number;
}

/**
 * Converts an array to JSONL format
 */
function toJSONL(items: unknown[]): string {
  if (items.length === 0) {
    return "";
  }
  return items.map((item) => JSON.stringify(item)).join("\n");
}

/**
 * Converts a prompt template to markdown format
 */
function templateToMarkdown(template: any, templateFormat: string): string {
  // Handle string template
  if (templateFormat === "STRING") {
    if (typeof template === "string") {
      return template;
    }
    // It might be wrapped in an object with type
    if (template?.template && typeof template.template === "string") {
      return template.template;
    }
    return JSON.stringify(template, null, 2);
  }

  // Handle chat template
  const messages = template?.messages || [];
  const lines: string[] = ["# Chat Template", ""];

  for (const message of messages) {
    lines.push(`## ${message.role}`);
    lines.push("");

    if (typeof message.content === "string") {
      lines.push(message.content);
    } else if (Array.isArray(message.content)) {
      // Handle multi-part content
      for (const part of message.content) {
        if (part.type === "text" && part.text) {
          lines.push(part.text);
        } else {
          // For non-text parts, show as JSON
          lines.push("```json");
          lines.push(JSON.stringify(part, null, 2));
          lines.push("```");
        }
      }
    } else {
      // If content is not string or array, show as JSON
      lines.push("```json");
      lines.push(JSON.stringify(message.content, null, 2));
      lines.push("```");
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Creates a markdown representation of a prompt version
 */
function createVersionMarkdown(version: any): string {
  const lines: string[] = [];

  // Add metadata header
  lines.push("---");
  lines.push(`id: ${version.id}`);
  if (version.model_name) lines.push(`model_name: ${version.model_name}`);
  if (version.model_provider)
    lines.push(`model_provider: ${version.model_provider}`);
  if (version.template_format)
    lines.push(`template_format: ${version.template_format}`);
  if (version.description) lines.push(`description: ${version.description}`);
  lines.push("---");
  lines.push("");

  // Add template content
  if (version.template) {
    lines.push(
      templateToMarkdown(version.template, version.template_format || "STRING")
    );
    lines.push("");
  }

  // Add invocation parameters if present
  if (version.invocation_parameters) {
    lines.push("## Invocation Parameters");
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(version.invocation_parameters, null, 2));
    lines.push("```");
    lines.push("");
  }

  // Add tools if present
  if (version.tools) {
    lines.push("## Tools");
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(version.tools, null, 2));
    lines.push("```");
    lines.push("");
  }

  // Add response format if present
  if (version.response_format) {
    lines.push("## Response Format");
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(version.response_format, null, 2));
    lines.push("```");
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Fetches all prompts and their versions from Phoenix
 */
export async function fetchPrompts(
  client: PhoenixClient,
  mode: ExecutionMode,
  options: FetchPromptsOptions = {}
): Promise<void> {
  const { limit = 100 } = options;

  // Fetch all prompts with pagination
  const prompts: any[] = [];
  let cursor: string | null = null;

  while (prompts.length < limit) {
    const query: Record<string, unknown> = {
      limit: Math.min(limit - prompts.length, 100),
    };
    if (cursor) {
      query.cursor = cursor;
    }

    const response = await withErrorHandling(
      () => client.GET("/v1/prompts", { params: { query } }),
      "fetching prompts"
    );

    const data = extractData(response);
    prompts.push(...data.data);
    cursor = data.next_cursor;

    // Stop if no more data
    if (!cursor || data.data.length === 0) {
      break;
    }
  }

  // Write prompts index
  await mode.writeFile("/phoenix/prompts/index.jsonl", toJSONL(prompts));

  // Fetch versions for each prompt
  for (const prompt of prompts) {
    const safePromptName = prompt.name.replace(/[^a-zA-Z0-9-_]/g, "_");

    // Write prompt metadata
    await mode.writeFile(
      `/phoenix/prompts/${safePromptName}/metadata.json`,
      JSON.stringify(
        {
          id: prompt.id,
          name: prompt.name,
          description: prompt.description || null,
          metadata: prompt.metadata || {},
          source_prompt_id: prompt.source_prompt_id || null,
          snapshot_timestamp: new Date().toISOString(),
        },
        null,
        2
      )
    );

    // Fetch all versions for this prompt
    const versions: any[] = [];
    let versionCursor: string | null = null;

    while (true) {
      const versionQuery: Record<string, unknown> = {
        limit: 100,
      };
      if (versionCursor) {
        versionQuery.cursor = versionCursor;
      }

      const versionsResponse = await withErrorHandling(
        () =>
          client.GET("/v1/prompts/{prompt_identifier}/versions", {
            params: {
              path: { prompt_identifier: prompt.id },
              query: versionQuery,
            },
          }),
        `fetching versions for prompt ${prompt.name}`
      );

      const versionsData = extractData(versionsResponse);
      versions.push(...versionsData.data);
      versionCursor = versionsData.next_cursor;

      // Stop if no more data
      if (!versionCursor || versionsData.data.length === 0) {
        break;
      }
    }

    // Write versions index as JSONL
    await mode.writeFile(
      `/phoenix/prompts/${safePromptName}/versions/index.jsonl`,
      toJSONL(versions)
    );

    // Write each version as markdown
    for (const version of versions) {
      const versionId = version.id.replace(/[^a-zA-Z0-9-_]/g, "_");
      const markdownContent = createVersionMarkdown(version);

      await mode.writeFile(
        `/phoenix/prompts/${safePromptName}/versions/${versionId}.md`,
        markdownContent
      );
    }

    // Fetch and save the latest version separately for convenience
    try {
      const latestResponse = await withErrorHandling(
        () =>
          client.GET("/v1/prompts/{prompt_identifier}/latest", {
            params: {
              path: { prompt_identifier: prompt.id },
            },
          }),
        `fetching latest version for prompt ${prompt.name}`
      );

      const latestData = extractData(latestResponse);
      if (latestData.data) {
        const latestMarkdownContent = createVersionMarkdown(latestData.data);

        await mode.writeFile(
          `/phoenix/prompts/${safePromptName}/latest.md`,
          latestMarkdownContent
        );
      }
    } catch (error) {
      // If there's no latest version, that's okay - just skip it
      console.warn(
        `No latest version available for prompt ${prompt.name}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
