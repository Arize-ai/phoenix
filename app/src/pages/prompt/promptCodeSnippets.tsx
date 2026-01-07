import { template } from "lodash";

import {
  fromOpenAIMessage,
  OpenAIMessage,
  promptMessageToOpenAI,
} from "@phoenix/schemas/messageSchemas";
import { ProgrammingLanguage } from "@phoenix/types/code";
import { isObject } from "@phoenix/typeUtils";

import type { PromptCodeExportCard__main$data as PromptVersion } from "./__generated__/PromptCodeExportCard__main.graphql";

export type PromptToSDKSnippetFn = ({
  invocationParameters,
  modelName,
  modelProvider,
  responseFormat,
  tools,
  template,
}: Pick<
  PromptVersion,
  | "invocationParameters"
  | "modelName"
  | "modelProvider"
  | "responseFormat"
  | "tools"
> & {
  template: {
    messages: unknown[];
  };
}) => string;

export type PromptToClientSnippetFn = (prompt: { versionId: string }) => string;

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

type LanguageConfig = {
  assignmentOperator: string;
  removeKeyQuotes: boolean;
  stringQuote: string;
  sdkTemplate: (params: {
    tab: string;
    args: string[];
    messages: string;
  }) => string;
  /**
   * A function that generates a string on how to pull the prompt using the phoenix client
   */
  clientTemplate: (params: { versionId: string; tab: string }) => string;
};

const openaiSDKTemplatePython = template(
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

const openaiSDKTemplateTypeScript = template(
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

const openaiClientTemplatePython = template(
  `
from openai import OpenAI
from phoenix.client import Client

prompt = Client().prompts.get(prompt_version_id="<%= versionId %>")

# Format the prompt template with the appropriate variables
response = OpenAI().chat.completions.create(**prompt.format(variables={ "variable": "value" }))
print(response.choices[0].message.content)
  `.trim()
);

const openaiClientTemplateTypeScript = template(
  `
import { Client } from "@arizeai/phoenix-client";
import { toSDK, getPrompt } from "@arizeai/phoenix-client/prompts";

const client = new Client();
const openai = new OpenAI();

const prompt = await getPrompt({
  client,
  prompt: {
    versionId: "<%= versionId %>",
  },
});

const openAIParams = toSDK({
  prompt,
  sdk: "openai",
  // Apply the prompt template variables
  variables: {
    key: "value",
  },
});

const response = await openai.chat.completions.create({
  ...openAIParams,
});

console.log(response.choices[0]?.message.content);
`.trim()
);

const anthropicSDKTemplatePython = template(
  `
from anthropic import Anthropic

client = Anthropic()

messages=<%= messages %>
# ^ apply additional templating to messages if needed

completion = client.messages.create(
<% _.forEach(args, function(arg) { %><%= tab %><%= arg %>,
<% }); %>)

print(completion.content)
`.trim()
);

const anthropicSDKTemplateTypeScript = template(
  `
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const messages = <%= messages %>;
// ^ apply additional templating to messages if needed

const response = await client.messages.create({
<% _.forEach(args, function(arg) { %><%= tab %><%= arg %>,
<% }); %>});

console.log(response.content);
`.trim()
);

const anthropicClientTemplatePython = template(
  `
from anthropic import Anthropic
from phoenix.client import Client

prompt = Client().prompts.get(prompt_version_id="<%= versionId %>")
# Format the prompt template with the appropriate variables
resp = Anthropic().messages.create(**prompt.format(variables={ "variable": "value" }))
  `.trim()
);

const anthropicClientTemplateTypeScript = template(
  `
import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@arizeai/phoenix-client";
import { toSDK, getPrompt } from "@arizeai/phoenix-client/prompts";

const client = new Client();
const anthropic = new Anthropic();

const prompt = await getPrompt({
  client,
  prompt: {
    versionId: "<%= versionId %>",
  },
});

const anthropicParams = toSDK({
  prompt,
  sdk: "anthropic",
  // Apply the prompt template variables
  variables: {
    key: "value",
  },
});

const response = await anthropic.messages.create({
  ...anthropicParams,
});

console.log(response.content);
`.trim()
);

const languageConfigs: Record<string, Record<string, LanguageConfig>> = {
  python: {
    openai: {
      assignmentOperator: "=",
      removeKeyQuotes: false,
      stringQuote: '"',
      sdkTemplate: openaiSDKTemplatePython,
      clientTemplate: openaiClientTemplatePython,
    },
    anthropic: {
      assignmentOperator: "=",
      removeKeyQuotes: false,
      stringQuote: '"',
      sdkTemplate: anthropicSDKTemplatePython,
      clientTemplate: anthropicClientTemplatePython,
    },
  },
  typescript: {
    openai: {
      assignmentOperator: ": ",
      removeKeyQuotes: true,
      stringQuote: '"',
      sdkTemplate: openaiSDKTemplateTypeScript,
      clientTemplate: openaiClientTemplateTypeScript,
    },
    anthropic: {
      assignmentOperator: ": ",
      removeKeyQuotes: true,
      stringQuote: '"',
      sdkTemplate: anthropicSDKTemplateTypeScript,
      clientTemplate: anthropicClientTemplateTypeScript,
    },
  },
};

const preparePromptData = (
  prompt: Parameters<PromptToSDKSnippetFn>[0],
  config: LanguageConfig
) => {
  if (!("messages" in prompt.template)) {
    throw new Error("Prompt template does not contain messages");
  }

  const args: string[] = [];
  const { assignmentOperator, removeKeyQuotes, stringQuote } = config;

  if (prompt.modelName) {
    args.push(
      `model${assignmentOperator}${stringQuote}${prompt.modelName}${stringQuote}`
    );
  }

  if (prompt.invocationParameters) {
    const invocationArgs = Object.entries(prompt.invocationParameters).map(
      ([key, value]) =>
        typeof value === "string"
          ? `${key}${assignmentOperator}${stringQuote}${value}${stringQuote}`
          : isObject(value)
            ? `${key}${assignmentOperator}${jsonFormatter({
                json: value,
                level: 1,
                removeKeyQuotes,
              })}`
            : `${key}${assignmentOperator}${value}`
    );
    args.push(...invocationArgs);
  }

  let messages = "";
  if (prompt.template.messages.length > 0) {
    const fmt = jsonFormatter({
      json: prompt.template.messages,
      level: 0,
      removeKeyQuotes,
    });
    messages = fmt;
    args.push(assignmentOperator === "=" ? "messages=messages" : "messages");
  }

  if (prompt.tools && prompt.tools.length > 0) {
    const fmt = jsonFormatter({
      json: prompt.tools.map((tool) => tool.definition),
      level: 1,
      removeKeyQuotes,
    });
    args.push(`tools${assignmentOperator}${fmt}`);
  }

  if (prompt.responseFormat && "definition" in prompt.responseFormat) {
    const fmt = jsonFormatter({
      json: prompt.responseFormat.definition,
      level: 1,
      removeKeyQuotes,
    });
    args.push(`response_format${assignmentOperator}${fmt}`);
  }

  return { args, messages };
};

/**
 * Convert OpenAI messages to OpenAI SDK messages, for use in the native SDK
 *
 * @todo The playground really needs to manage messages fully in Phoenix Prompt format, or, in
 * native SDK format. This in-between format is a mess.
 *
 * @param message the message to convert
 * @returns the converted message
 */
const convertOpenAIMessageToOpenAISDKMessage = (message: OpenAIMessage) => {
  if ("tool_calls" in message && message.tool_calls) {
    return {
      ...message,
      tool_calls: message.tool_calls.map((toolCall) => ({
        ...toolCall,
        function: {
          ...toolCall.function,
          arguments: JSON.stringify(toolCall.function.arguments),
        },
      })),
    };
  } else {
    return message;
  }
};

export const promptSDKCodeSnippets: Record<
  string,
  Record<string, PromptToSDKSnippetFn>
> = {
  python: {
    openai: (prompt) => {
      const config = languageConfigs.python.openai;
      const convertedPrompt = {
        ...prompt,
        template: {
          ...prompt.template,
          messages: prompt.template.messages.map((m) =>
            convertOpenAIMessageToOpenAISDKMessage(m as OpenAIMessage)
          ),
        },
      };
      const { args, messages } = preparePromptData(convertedPrompt, config);
      return config.sdkTemplate({
        tab: TAB,
        args,
        messages,
      });
    },
    anthropic: (prompt) => {
      const config = languageConfigs.python.anthropic;
      const { args, messages } = preparePromptData(prompt, config);
      return config.sdkTemplate({
        tab: TAB,
        args,
        messages,
      });
    },
  },
  typescript: {
    openai: (prompt) => {
      const config = languageConfigs.typescript.openai;
      const convertedPrompt = {
        ...prompt,
        template: {
          ...prompt.template,
          messages: prompt.template.messages.map((m) =>
            convertOpenAIMessageToOpenAISDKMessage(m as OpenAIMessage)
          ),
        },
      };
      const { args, messages } = preparePromptData(convertedPrompt, config);
      return config.sdkTemplate({
        tab: TAB,
        args,
        messages,
      });
    },
    anthropic: (prompt) => {
      const config = languageConfigs.typescript.anthropic;
      const { args, messages } = preparePromptData(prompt, config);
      return config.sdkTemplate({
        tab: TAB,
        args,
        messages,
      });
    },
  },
};

export const promptClientCodeSnippets: Record<
  string,
  Record<string, PromptToClientSnippetFn>
> = {
  python: {
    openai: (prompt) => {
      const config = languageConfigs.python.openai;
      return config.clientTemplate({
        tab: TAB,
        versionId: prompt.versionId,
      });
    },
    anthropic: (prompt) => {
      const config = languageConfigs.python.openai;
      return config.clientTemplate({
        tab: TAB,
        versionId: prompt.versionId,
      });
    },
  },
  typescript: {
    openai: (prompt) => {
      const config = languageConfigs.typescript.openai;
      return config.clientTemplate({
        tab: TAB,
        versionId: prompt.versionId,
      });
    },
    anthropic: (prompt) => {
      const config = languageConfigs.typescript.anthropic;
      return config.clientTemplate({
        tab: TAB,
        versionId: prompt.versionId,
      });
    },
  },
};

export const mapPromptToSDKSnippet = ({
  promptVersion,
  language,
}: {
  promptVersion: Omit<PromptVersion, " $fragmentType">;
  language: ProgrammingLanguage;
}) => {
  const generator =
    promptSDKCodeSnippets[language.toLocaleLowerCase()][
      promptVersion.modelProvider?.toLocaleLowerCase()
    ];
  if (!generator) {
    return null;
  }

  if (!("messages" in promptVersion.template)) {
    return null;
  }

  const convertedPrompt = {
    ...promptVersion,
    template: {
      ...promptVersion.template,
      messages: promptVersion.template.messages
        .map((message) => {
          try {
            return fromOpenAIMessage({
              message: promptMessageToOpenAI.parse(message),
              targetProvider: promptVersion.modelProvider as ModelProvider,
            });
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn("Cannot convert message");
            // eslint-disable-next-line no-console
            console.error(e);
            return null;
          }
        })
        .filter(Boolean),
    },
  };
  return generator(convertedPrompt);
};

export function mapPromptToClientSnippet({
  promptVersion,
  language,
}: {
  promptVersion: Omit<PromptVersion, " $fragmentType">;
  language: ProgrammingLanguage;
}) {
  const generator =
    promptClientCodeSnippets[language.toLocaleLowerCase()][
      promptVersion.modelProvider?.toLocaleLowerCase()
    ];
  if (!generator) {
    return null;
  }

  const promptParams = {
    versionId: promptVersion.id,
  };
  return generator(promptParams);
}
