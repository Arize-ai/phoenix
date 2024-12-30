import { CodeLanguage } from "@phoenix/components/code";

import type { PromptCodeExportCard__main$data as PromptVersion } from "./__generated__/PromptCodeExportCard__main.graphql";

export type PromptToSnippet = ({
  invocationParameters,
  modelName,
  modelProvider,
  outputSchema,
  tools,
  template,
}: Pick<
  PromptVersion,
  | "invocationParameters"
  | "modelName"
  | "modelProvider"
  | "outputSchema"
  | "tools"
  | "template"
>) => string;

const TABS = "  ";

/**
 * Indentation-aware JSON formatter
 *
 * @returns The formatted JSON string
 */
const jsonFormatter = ({
  json,
  level,
  removeKeyQuotes = false,
}: {
  /**
   * The JSON object to format
   */
  json: unknown;
  /**
   * The indentation level
   */
  level: number;
  /**
   * Whether to remove quotes from keys
   */
  removeKeyQuotes?: boolean;
}) => {
  const tabsWithLevel = TABS.repeat(level);
  let fmt = JSON.stringify(json, null, TABS);
  // add TABS before every line except the first
  // this allows you to add additional indentation to the emitted JSON
  fmt = fmt
    .split("\n")
    .map((line, index) => (index > 0 ? tabsWithLevel + line : line))
    .join("\n");

  if (removeKeyQuotes) {
    // Replace quoted keys with unquoted keys, but only when they're valid identifiers
    fmt = fmt.replace(/"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, "$1:");
  }

  return fmt;
};

/**
 * A map of languages to model providers to code snippets
 *
 * @todo replace with a react-like DSL, for example something like the following:
 * @example
 * ```tsx
 * code(
 *   { language, provider },
 *   [
 *     openai(),
 *     messages({messages}),
 *     completion(null, [argument(null, tools({ tools }))
 *   ]
 * )
 * ```
 * where each function takes a props object and optional children, and returns a string.
 *
 * That way, each component can manage how to emit its portion of the string based on language and model provider,
 * accessible via context from the top level code component.
 */
export const promptCodeSnippets: Record<
  CodeLanguage,
  Record<string, PromptToSnippet>
> = {
  Python: {
    openai: (prompt) => {
      if (!("messages" in prompt.template)) {
        throw new Error("Prompt template does not contain messages");
      }
      const args: string[] = [];
      if (prompt.modelName) {
        args.push(`model="${prompt.modelName}"`);
      }
      if (prompt.invocationParameters) {
        const invocationArgs = Object.entries(prompt.invocationParameters).map(
          ([key, value]) => `${key}=${value}`
        );
        args.push(`${invocationArgs.join(",\n")}`);
      }
      let messages = "";
      if (prompt.template.messages.length > 0) {
        const fmt = jsonFormatter({
          json: prompt.template.messages,
          level: 0,
        });
        messages = `${fmt}`;
        args.push(`messages=messages`);
      }
      if (prompt.tools) {
        const fmt = jsonFormatter({
          json: prompt.tools.map((tool) => tool.definition),
          level: 1,
        });
        args.push(`tools=${fmt}`);
      }
      if (prompt.outputSchema && "schema" in prompt.outputSchema) {
        const fmt = jsonFormatter({
          json: prompt.outputSchema.schema,
          level: 1,
        });
        args.push(`response_format=${fmt}`);
      }

      return `
from openai import OpenAI

client = OpenAI()
${
  messages
    ? `
messages=${messages}
# ^ apply additional templating to messages if needed
`
    : ""
}
completion = client.chat.completions.create(
${TABS}${args.join(",\n" + TABS)}
)

print(completion.choices[0].message)
`.trim();
    },
  },
  TypeScript: {
    openai: (prompt) => {
      if (!("messages" in prompt.template)) {
        throw new Error("Prompt template does not contain messages");
      }
      const args: string[] = [];
      if (prompt.modelName) {
        args.push(`model: "${prompt.modelName}"`);
      }
      if (prompt.invocationParameters) {
        const invocationArgs = Object.entries(prompt.invocationParameters).map(
          ([key, value]) => `${key}: ${value}`
        );
        args.push(`${invocationArgs.join(",\n")}`);
      }
      let messages = "";
      if (prompt.template.messages.length > 0) {
        const fmt = jsonFormatter({
          json: prompt.template.messages,
          level: 0,
          removeKeyQuotes: true,
        });
        messages = `${fmt}`;
        args.push(`messages`);
      }
      if (prompt.tools) {
        const fmt = jsonFormatter({
          json: prompt.tools.map((tool) => tool.definition),
          level: 1,
          removeKeyQuotes: true,
        });
        args.push(`tools: ${fmt}`);
      }
      if (prompt.outputSchema && "schema" in prompt.outputSchema) {
        const fmt = jsonFormatter({
          json: prompt.outputSchema.schema,
          level: 1,
          removeKeyQuotes: true,
        });
        args.push(`response_format: ${fmt}`);
      }

      return `
import OpenAI from "openai";

const openai = new OpenAI();
${
  messages
    ? `
const messages = ${messages};
// ^ apply additional templating to messages if needed
`
    : ""
}
const response = openai.chat.completions.create({
${TABS}${args.join(",\n" + TABS)}
});

response.then((completion) => console.log(completion.choices[0].message));
`.trim();
    },
  },
};

export const mapPromptToSnippet = ({
  promptVersion,
  language,
}: {
  promptVersion: PromptVersion;
  language: CodeLanguage;
}) => {
  const generator = promptCodeSnippets[language][promptVersion.modelProvider];
  if (!generator) {
    return `We do not have a code snippet for ${language} and ${promptVersion.modelProvider}`;
  }
  return generator(promptVersion);
};
