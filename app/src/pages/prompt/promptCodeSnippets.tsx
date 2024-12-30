import { CodeLanguage } from "@phoenix/components/code";
import { isObject } from "@phoenix/typeUtils";

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

const TABS = "    ";

const jsonFormatter = (json: unknown, level: number) => {
  const tabsWithLevel = TABS.repeat(level);
  let fmt = JSON.stringify(json, null, TABS);
  // add TABS before every line except the first
  // this allows you to add additional indentation to the emitted JSON
  fmt = fmt
    .split("\n")
    .map((line, index) => (index > 0 ? tabsWithLevel + line : line))
    .join("\n");
  return fmt;
};

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
        const fmt = jsonFormatter(prompt.template.messages, 0);
        messages = `${fmt}`;
        args.push(`messages=messages`);
      }
      if (isObject(prompt.tools) && "tools" in prompt.tools) {
        const fmt = jsonFormatter(prompt.tools.tools, 1);
        args.push(`tools=${fmt}`);
      }
      if (prompt.outputSchema) {
        const fmt = jsonFormatter(prompt.outputSchema, 1);
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
    openai: () => {
      return `
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
