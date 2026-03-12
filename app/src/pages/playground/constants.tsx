export const NUM_MAX_PLAYGROUND_INSTANCES = 4;

/**
 * Parsing errors for parsing a span to a playground instance
 */
export const INPUT_MESSAGES_PARSING_ERROR =
  "Unable to parse span input messages, expected messages which include a role and content.";
export const OUTPUT_MESSAGES_PARSING_ERROR =
  "Unable to parse span output messages, expected messages which include a role and content.";
export const OUTPUT_VALUE_PARSING_ERROR =
  "Unable to parse span output expected output.value to be present.";
export const SPAN_ATTRIBUTES_PARSING_ERROR =
  "Unable to parse span attributes, attributes must be valid JSON.";
export const MODEL_CONFIG_PARSING_ERROR =
  "Unable to parse model config, expected llm.model_name to be present.";
export const MODEL_CONFIG_WITH_INVOCATION_PARAMETERS_PARSING_ERROR =
  "Unable to parse model config, expected llm.invocation_parameters JSON string to be present.";
export const MODEL_CONFIG_WITH_RESPONSE_FORMAT_PARSING_ERROR =
  "Unable to parse invocation parameters response_format, expected llm.invocation_parameters.response_format to be a well formed json object or undefined.";
export const TOOLS_PARSING_ERROR =
  "Unable to parse tools, expected tools to be an array of valid tools.";
export const PROMPT_TEMPLATE_VARIABLES_PARSING_ERROR =
  "Unable to parse prompt template variables, expected prompt template variables to be a valid JSON object string.";

export const modelProviderToModelPrefixMap: Record<ModelProvider, string[]> = {
  AZURE_OPENAI: [],
  ANTHROPIC: ["claude"],
  OPENAI: ["gpt", "o1"],
  GOOGLE: ["gemini"],
  DEEPSEEK: ["deepseek"],
  XAI: ["grok"],
  OLLAMA: [],
  AWS: ["nova", "titan"],
  CEREBRAS: [],
  FIREWORKS: [],
  GROQ: [],
  MOONSHOT: ["moonshot", "kimi"],
  PERPLEXITY: ["sonar"],
  TOGETHER: [],
};
