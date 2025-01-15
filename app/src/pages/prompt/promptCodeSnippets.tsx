import { template } from "lodash";

import { CodeLanguage } from "@phoenix/components/code";

import type { PromptCodeExportCard__main$data as PromptVersion } from "./__generated__/PromptCodeExportCard__main.graphql";

export type PromptToSnippetParams = ({
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

const TAB = "  ";

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
  const tabsWithLevel = TAB.repeat(level);
  let fmt = JSON.stringify(json, null, TAB);
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

const openaiTemplatePython = template(
  `
from openai import OpenAI

client = OpenAI()

messages=<%= messages %>
# ^ apply additional templating to messages if needed

completion = client.chat.completions.create(
<% _.forEach(args, function(arg) { %><%= tab %><%= arg %>,
<% }); %>)

print(completion.choices[0].message)
`.trim()
);

const openaiTemplateTypeScript = template(
  `
import OpenAI from "openai";

const openai = new OpenAI();

const messages = <%= messages %>;
// ^ apply additional templating to messages if needed

const response = openai.chat.completions.create({
<% _.forEach(args, function(arg) { %><%= tab %><%= arg %>,
<% }); %>});

response.then((completion) => console.log(completion.choices[0].message));
`.trim()
);

/**
 * A map of languages to model providers to code snippets
 *
 * @todo when we implement more langs / providers, replace with a react-like DSL, for example something like the following:
 * @example
 * ```tsx
 * code(
 *   { language, provider },
 *   [
 *     providerSetup(),
 *     messages({messages}),
 *     providerCompletion(null, [argument({messages}), argument({tools}), argument({response_format})])
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
  Record<string, PromptToSnippetParams>
> = {
  Python: {
    openai: (prompt) => {
      if (!("messages" in prompt.template)) {
        throw new Error("Prompt template does not contain messages");
      }
      // collect args to the provider completion fn call from the incoming template
      const args: string[] = [];
      if (prompt.modelName) {
        args.push(`model="${prompt.modelName}"`);
      }
      if (prompt.invocationParameters) {
        const invocationArgs = Object.entries(prompt.invocationParameters).map(
          ([key, value]) => `${key}=${value}`
        );
        args.push(...invocationArgs);
      }
      // messages are special, they are passed as a kwarg to the provider completion fn
      // but defined in the template as a top level variable first
      let messages = "";
      if (prompt.template.messages.length > 0) {
        const fmt = jsonFormatter({
          json: prompt.template.messages,
          level: 0,
        });
        messages = `${fmt}`;
        args.push(`messages=messages`);
      }
      if (prompt.tools && prompt.tools.length > 0) {
        const fmt = jsonFormatter({
          json: prompt.tools.map((tool) => tool.definition),
          level: 1,
        });
        args.push(`tools=${fmt}`);
      }
      if (prompt.outputSchema && "definition" in prompt.outputSchema) {
        const fmt = jsonFormatter({
          json: prompt.outputSchema.definition,
          level: 1,
        });
        args.push(`response_format=${fmt}`);
      }

      // now emit the template with the collected args and messages
      return openaiTemplatePython({
        tab: TAB,
        args,
        messages,
      });
    },
  },
  TypeScript: {
    openai: (prompt) => {
      if (!("messages" in prompt.template)) {
        throw new Error("Prompt template does not contain messages");
      }
      // collect args to the provider completion fn call from the incoming template
      const args: string[] = [];
      if (prompt.modelName) {
        args.push(`model: "${prompt.modelName}"`);
      }
      if (prompt.invocationParameters) {
        const invocationArgs = Object.entries(prompt.invocationParameters).map(
          ([key, value]) => `${key}: ${value}`
        );
        args.push(...invocationArgs);
      }
      // messages are special, they are passed as a kwarg to the provider completion fn
      // but defined in the template as a top level variable first
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
      if (prompt.tools && prompt.tools.length > 0) {
        const fmt = jsonFormatter({
          json: prompt.tools.map((tool) => tool.definition),
          level: 1,
          removeKeyQuotes: true,
        });
        args.push(`tools: ${fmt}`);
      }
      if (prompt.outputSchema && "definition" in prompt.outputSchema) {
        const fmt = jsonFormatter({
          json: prompt.outputSchema.definition,
          level: 1,
          removeKeyQuotes: true,
        });
        args.push(`response_format: ${fmt}`);
      }

      // now emit the template with the collected args and messages
      return openaiTemplateTypeScript({
        tab: TAB,
        args,
        messages,
      });
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
  const generator =
    promptCodeSnippets[language][
      promptVersion.modelProvider?.toLocaleLowerCase()
    ];
  if (!generator) {
    return `We do not have a code snippet for ${language} + ${promptVersion.modelProvider}`;
  }
  return generator(promptVersion);
};
