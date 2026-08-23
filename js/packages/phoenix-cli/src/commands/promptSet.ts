import type { componentsV1 } from "@arizeai/phoenix-client";

import { InvalidArgumentError } from "../exitCodes";

type PromptData = componentsV1["schemas"]["PromptData"];
type PromptVersion = componentsV1["schemas"]["PromptVersion"];
type PromptVersionData = componentsV1["schemas"]["PromptVersionData"];
type PromptMessage = componentsV1["schemas"]["PromptMessage"];
type PromptChatTemplate = componentsV1["schemas"]["PromptChatTemplate"];
type PromptStringTemplate = componentsV1["schemas"]["PromptStringTemplate"];
type ModelProvider = componentsV1["schemas"]["ModelProvider"];
type PromptTemplateFormat = componentsV1["schemas"]["PromptTemplateFormat"];
type InvocationParameters = PromptVersionData["invocation_parameters"];

export const MODEL_PROVIDERS: readonly ModelProvider[] = [
  "OPENAI",
  "AZURE_OPENAI",
  "ANTHROPIC",
  "GOOGLE",
  "DEEPSEEK",
  "XAI",
  "OLLAMA",
  "AWS",
  "CEREBRAS",
  "FIREWORKS",
  "GROQ",
  "MOONSHOT",
  "PERPLEXITY",
  "TOGETHER",
];

export const TEMPLATE_FORMATS: readonly PromptTemplateFormat[] = [
  "MUSTACHE",
  "F_STRING",
  "NONE",
];

export const PROMPT_MESSAGE_ROLES: readonly PromptMessage["role"][] = [
  "user",
  "assistant",
  "model",
  "ai",
  "tool",
  "system",
  "developer",
];

/**
 * Prompt names (and version tags) must match the server Identifier pattern:
 * lowercase letters, digits, hyphens, and underscores, starting and ending
 * with an alphanumeric character.
 */
export const PROMPT_IDENTIFIER_PATTERN = /^[a-z0-9]([_a-z0-9-]*[a-z0-9])?$/;

const DEFAULT_MODEL_PROVIDER: ModelProvider = "OPENAI";
const DEFAULT_TEMPLATE_FORMAT: PromptTemplateFormat = "MUSTACHE";

export const PROMPT_SET_USAGE_HINT =
  'px prompt set <name> --template "..." --model gpt-4o';

/**
 * Fields parsed from `--file` (or stdin). Flags overlay these; a latest
 * version, when one exists, fills anything still missing.
 */
export interface PromptSetFileContents {
  promptDescription?: string | null;
  promptMetadata?: Record<string, unknown> | null;
  version?: Partial<PromptVersionData>;
  templateText?: string;
  messages?: PromptMessage[];
}

/**
 * Flag-level inputs after JSON / enum / `--message` parsing. Undefined means
 * the user did not pass that flag.
 */
export interface PromptSetParsedFlags {
  template?: string;
  messages?: PromptMessage[];
  model?: string;
  modelProvider?: ModelProvider;
  templateFormat?: PromptTemplateFormat;
  description?: string;
  versionDescription?: string;
  invocationParameters?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  tag?: string;
}

export interface BuildPromptSetRequestInput {
  /**
   * Prompt name written to `prompt.name`. Must already be a valid Identifier.
   */
  name: string;
  flags: PromptSetParsedFlags;
  file?: PromptSetFileContents;
  /**
   * Latest version of an existing prompt, used so `set` can change one field
   * without respecifying the rest.
   */
  existing?: PromptVersion;
}

/**
 * True when the user supplied at least one field that belongs on a new
 * prompt version. `--description`, `--metadata`, and `--tag` alone do not
 * qualify — description/metadata only apply when creating the prompt, and
 * `--tag` labels the version that `set` writes, it does not retag latest.
 */
export function hasPromptVersionInput(options: {
  template?: string;
  message?: string[];
  file?: string;
  model?: string;
  modelProvider?: string;
  templateFormat?: string;
  versionDescription?: string;
  invocationParameters?: string;
}): boolean {
  return (
    options.template !== undefined ||
    (options.message !== undefined && options.message.length > 0) ||
    options.file !== undefined ||
    options.model !== undefined ||
    options.modelProvider !== undefined ||
    options.templateFormat !== undefined ||
    options.versionDescription !== undefined ||
    options.invocationParameters !== undefined
  );
}

export function assertPromptIdentifier(value: string, flag: string): string {
  if (!PROMPT_IDENTIFIER_PATTERN.test(value)) {
    throw new InvalidArgumentError(
      `${flag} '${value}' is not a valid prompt identifier. Use lowercase letters, digits, hyphens, and underscores (e.g. my-prompt)`
    );
  }
  return value;
}

/**
 * Parse repeatable `--message <role:content>` values. Split is on the first
 * colon so the content may contain more colons.
 */
export function parsePromptMessages(values: string[]): PromptMessage[] {
  return values.map((value) => {
    const separatorIndex = value.indexOf(":");
    if (separatorIndex === -1) {
      throw new InvalidArgumentError(
        `Invalid --message '${value}'. Expected role:content, e.g. user:Hello`
      );
    }
    const role = value.slice(0, separatorIndex).trim().toLowerCase();
    const content = value.slice(separatorIndex + 1);
    if (!isPromptMessageRole(role)) {
      throw new InvalidArgumentError(
        `Invalid --message role '${role}'. Must be one of: ${PROMPT_MESSAGE_ROLES.join(", ")}`
      );
    }
    return { role, content };
  });
}

export function parseModelProvider(value: string): ModelProvider {
  const provider = value.toUpperCase() as ModelProvider;
  if (!MODEL_PROVIDERS.includes(provider)) {
    throw new InvalidArgumentError(
      `Invalid --model-provider '${value}'. Must be one of: ${MODEL_PROVIDERS.join(", ")}`
    );
  }
  return provider;
}

export function parseTemplateFormat(value: string): PromptTemplateFormat {
  const format = value.toUpperCase() as PromptTemplateFormat;
  if (!TEMPLATE_FORMATS.includes(format)) {
    throw new InvalidArgumentError(
      `Invalid --template-format '${value}'. Must be one of: ${TEMPLATE_FORMATS.join(", ")}`
    );
  }
  return format;
}

/**
 * Parse the CLI flags that can fail without talking to the server.
 */
export function parsePromptSetFlags(options: {
  template?: string;
  message?: string[];
  model?: string;
  modelProvider?: string;
  templateFormat?: string;
  description?: string;
  versionDescription?: string;
  invocationParameters?: string;
  metadata?: string;
  tag?: string;
}): PromptSetParsedFlags {
  if (options.template !== undefined && options.template.trim() === "") {
    throw new InvalidArgumentError("--template must not be empty");
  }
  const hasMessages =
    options.message !== undefined && options.message.length > 0;
  if (options.template !== undefined && hasMessages) {
    throw new InvalidArgumentError(
      "--template and --message cannot be used together. Pass a string template or chat messages, not both"
    );
  }

  const flags: PromptSetParsedFlags = {};
  if (options.template !== undefined) {
    flags.template = options.template;
  }
  if (hasMessages) {
    flags.messages = parsePromptMessages(options.message ?? []);
  }
  if (options.model !== undefined) {
    if (options.model.trim() === "") {
      throw new InvalidArgumentError("--model must not be empty");
    }
    flags.model = options.model;
  }
  if (options.modelProvider !== undefined) {
    flags.modelProvider = parseModelProvider(options.modelProvider);
  }
  if (options.templateFormat !== undefined) {
    flags.templateFormat = parseTemplateFormat(options.templateFormat);
  }
  if (options.description !== undefined) {
    flags.description = options.description;
  }
  if (options.versionDescription !== undefined) {
    flags.versionDescription = options.versionDescription;
  }
  if (options.invocationParameters !== undefined) {
    flags.invocationParameters = parseObjectFlag(
      "--invocation-parameters",
      options.invocationParameters
    );
  }
  if (options.metadata !== undefined) {
    flags.metadata = parseObjectFlag("--metadata", options.metadata);
  }
  if (options.tag !== undefined) {
    flags.tag = assertPromptIdentifier(options.tag, "--tag");
  }
  return flags;
}

/**
 * Parse a `--file` payload. Accepts the POST /v1/prompts body, a
 * `PromptVersion` (including `px prompt get --format raw` output), a
 * `{ data: PromptVersion }` wrapper, a `{ messages: [...] }` chat template,
 * or a JSON string treated as a user-message template.
 */
export function parsePromptSetFile(contents: string): PromptSetFileContents {
  const trimmed = contents.trim();
  if (trimmed === "") {
    throw new InvalidArgumentError(
      "--file is empty. Pass a JSON prompt body or the output of px prompt get --format raw"
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new InvalidArgumentError(
      "--file must be valid JSON. Use --template for a plain-text prompt"
    );
  }

  if (typeof parsed === "string") {
    if (parsed.trim() === "") {
      throw new InvalidArgumentError("--file JSON string must not be empty");
    }
    return { templateText: parsed };
  }

  if (!isRecord(parsed)) {
    throw new InvalidArgumentError(
      "--file must be a JSON object (prompt version, {prompt, version}, or {messages})"
    );
  }

  const unwrapped = unwrapPromptVersionRecord(parsed);
  const file: PromptSetFileContents = {};

  if (isRecord(unwrapped.prompt)) {
    if (typeof unwrapped.prompt.description === "string") {
      file.promptDescription = unwrapped.prompt.description;
    }
    if (isRecord(unwrapped.prompt.metadata)) {
      file.promptMetadata = unwrapped.prompt.metadata;
    }
  }

  const versionRecord = isRecord(unwrapped.version)
    ? unwrapped.version
    : hasVersionShape(unwrapped)
      ? unwrapped
      : undefined;

  if (versionRecord !== undefined) {
    file.version = promptVersionDataFromRecord(versionRecord);
    if (
      typeof versionRecord.template === "string" &&
      versionRecord.template.trim() !== ""
    ) {
      file.templateText = versionRecord.template;
    }
  }

  if (
    Array.isArray(unwrapped.messages) &&
    file.version?.template === undefined
  ) {
    file.messages = parseFileMessages(unwrapped.messages);
  }

  const hasContent =
    file.version !== undefined ||
    file.templateText !== undefined ||
    file.messages !== undefined ||
    file.promptDescription !== undefined ||
    file.promptMetadata !== undefined;
  if (!hasContent) {
    throw new InvalidArgumentError(
      "--file JSON must include a prompt version (template / messages) or {prompt, version}"
    );
  }

  return file;
}

export function buildPromptSetRequest({
  name,
  flags,
  file,
  existing,
}: BuildPromptSetRequestInput): {
  prompt: PromptData;
  version: PromptVersionData;
} {
  const template = resolveChatTemplate({ flags, file, existing });
  const modelName = resolveModelName({ flags, file, existing });
  const modelProvider = resolveModelProvider({ flags, file, existing });
  const templateFormat =
    flags.templateFormat ??
    file?.version?.template_format ??
    existing?.template_format ??
    DEFAULT_TEMPLATE_FORMAT;
  const versionDescription =
    flags.versionDescription ??
    file?.version?.description ??
    existing?.description ??
    undefined;
  const invocationParameters = resolveInvocationParameters({
    flags,
    file,
    existing,
    modelProvider,
  });
  const tools = file?.version?.tools ?? existing?.tools ?? undefined;
  const responseFormat =
    file?.version?.response_format ?? existing?.response_format ?? undefined;

  const prompt: PromptData = { name };
  const description = flags.description ?? file?.promptDescription;
  if (description !== undefined && description !== null) {
    prompt.description = description;
  }
  const metadata = flags.metadata ?? file?.promptMetadata;
  if (metadata !== undefined && metadata !== null) {
    prompt.metadata = metadata;
  }

  const version: PromptVersionData = {
    model_provider: modelProvider,
    model_name: modelName,
    template,
    template_type: "CHAT",
    template_format: templateFormat,
    invocation_parameters: invocationParameters,
  };
  if (versionDescription !== undefined && versionDescription !== null) {
    version.description = versionDescription;
  }
  if (tools !== undefined && tools !== null) {
    version.tools = tools;
  }
  if (responseFormat !== undefined && responseFormat !== null) {
    version.response_format = responseFormat;
  }

  return { prompt, version };
}

function resolveChatTemplate({
  flags,
  file,
  existing,
}: {
  flags: PromptSetParsedFlags;
  file?: PromptSetFileContents;
  existing?: PromptVersion;
}): PromptChatTemplate {
  if (flags.messages !== undefined) {
    return { type: "chat", messages: flags.messages };
  }
  if (flags.template !== undefined) {
    return userMessageTemplate(flags.template);
  }
  if (file?.messages !== undefined) {
    return { type: "chat", messages: file.messages };
  }
  if (file?.templateText !== undefined) {
    return userMessageTemplate(file.templateText);
  }
  if (file?.version?.template !== undefined) {
    return toChatTemplate(file.version.template);
  }
  if (existing?.template !== undefined) {
    return toChatTemplate(existing.template);
  }
  throw new InvalidArgumentError(
    "Missing prompt template. Pass --template, --message, or --file"
  );
}

function resolveModelName({
  flags,
  file,
  existing,
}: {
  flags: PromptSetParsedFlags;
  file?: PromptSetFileContents;
  existing?: PromptVersion;
}): string {
  const modelName =
    flags.model ?? file?.version?.model_name ?? existing?.model_name;
  if (modelName === undefined || modelName.trim() === "") {
    throw new InvalidArgumentError("Missing required flag --model");
  }
  return modelName;
}

function resolveModelProvider({
  flags,
  file,
  existing,
}: {
  flags: PromptSetParsedFlags;
  file?: PromptSetFileContents;
  existing?: PromptVersion;
}): ModelProvider {
  return (
    flags.modelProvider ??
    file?.version?.model_provider ??
    existing?.model_provider ??
    DEFAULT_MODEL_PROVIDER
  );
}

function resolveInvocationParameters({
  flags,
  file,
  existing,
  modelProvider,
}: {
  flags: PromptSetParsedFlags;
  file?: PromptSetFileContents;
  existing?: PromptVersion;
  modelProvider: ModelProvider;
}): InvocationParameters {
  if (flags.invocationParameters !== undefined) {
    return buildInvocationParameters(modelProvider, flags.invocationParameters);
  }
  if (
    file?.version?.invocation_parameters !== undefined &&
    invocationParametersMatchProvider(
      file.version.invocation_parameters,
      modelProvider
    )
  ) {
    return file.version.invocation_parameters;
  }
  if (
    existing?.invocation_parameters !== undefined &&
    existing.model_provider === modelProvider
  ) {
    return existing.invocation_parameters;
  }
  return buildInvocationParameters(modelProvider, {});
}

function userMessageTemplate(template: string): PromptChatTemplate {
  return { type: "chat", messages: [{ role: "user", content: template }] };
}

function toChatTemplate(
  template: PromptChatTemplate | PromptStringTemplate
): PromptChatTemplate {
  if (template.type === "string") {
    return userMessageTemplate(template.template);
  }
  return template;
}

/**
 * Build the provider-discriminated invocation-parameters object. Anthropic
 * requires `max_tokens`; every other provider accepts an empty object.
 */
export function buildInvocationParameters(
  provider: ModelProvider,
  content: Record<string, unknown>
): InvocationParameters {
  const unwrapped = unwrapInvocationContent(content, provider);
  if (provider === "ANTHROPIC" && typeof unwrapped.max_tokens !== "number") {
    throw new InvalidArgumentError(
      "ANTHROPIC prompts require max_tokens in --invocation-parameters, e.g. '{\"max_tokens\":1024}'"
    );
  }
  const key = provider.toLowerCase();
  return {
    type: key,
    [key]: unwrapped,
  } as InvocationParameters;
}

function unwrapInvocationContent(
  content: Record<string, unknown>,
  provider: ModelProvider
): Record<string, unknown> {
  const key = provider.toLowerCase();
  if (content.type === key && isRecord(content[key])) {
    return content[key];
  }
  return content;
}

function invocationParametersMatchProvider(
  parameters: InvocationParameters,
  provider: ModelProvider
): boolean {
  return parameters.type === provider.toLowerCase();
}

function parseObjectFlag(flag: string, raw: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new InvalidArgumentError(`${flag} must be valid JSON`);
  }
  if (!isRecord(parsed)) {
    throw new InvalidArgumentError(`${flag} must be a JSON object`);
  }
  return parsed;
}

function unwrapPromptVersionRecord(
  parsed: Record<string, unknown>
): Record<string, unknown> {
  if (isRecord(parsed.data) && !isRecord(parsed.version)) {
    return parsed.data;
  }
  return parsed;
}

function hasVersionShape(value: Record<string, unknown>): boolean {
  return (
    value.template !== undefined ||
    value.model_name !== undefined ||
    value.model_provider !== undefined ||
    value.template_type !== undefined ||
    value.invocation_parameters !== undefined
  );
}

function promptVersionDataFromRecord(
  record: Record<string, unknown>
): Partial<PromptVersionData> {
  const version: Partial<PromptVersionData> = {};
  if (typeof record.description === "string") {
    version.description = record.description;
  }
  if (typeof record.model_name === "string") {
    version.model_name = record.model_name;
  }
  if (typeof record.model_provider === "string") {
    version.model_provider = parseModelProvider(record.model_provider);
  }
  if (typeof record.template_format === "string") {
    version.template_format = parseTemplateFormat(record.template_format);
  }
  if (isPromptTemplate(record.template)) {
    version.template = record.template;
  }
  if (
    isRecord(record.invocation_parameters) &&
    record.invocation_parameters.type
  ) {
    version.invocation_parameters =
      record.invocation_parameters as InvocationParameters;
  }
  if (record.tools !== undefined) {
    version.tools = record.tools as PromptVersionData["tools"];
  }
  if (record.response_format !== undefined) {
    version.response_format =
      record.response_format as PromptVersionData["response_format"];
  }
  return version;
}

function isPromptTemplate(
  value: unknown
): value is PromptChatTemplate | PromptStringTemplate {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }
  if (value.type === "string") {
    return typeof value.template === "string";
  }
  if (value.type === "chat") {
    return Array.isArray(value.messages);
  }
  return false;
}

function parseFileMessages(values: unknown[]): PromptMessage[] {
  const messages: PromptMessage[] = [];
  for (const value of values) {
    if (!isRecord(value) || typeof value.role !== "string") {
      throw new InvalidArgumentError(
        "--file messages must be objects with a role and content"
      );
    }
    const role = value.role.toLowerCase();
    if (!isPromptMessageRole(role)) {
      throw new InvalidArgumentError(
        `Invalid message role '${value.role}' in --file. Must be one of: ${PROMPT_MESSAGE_ROLES.join(", ")}`
      );
    }
    if (typeof value.content !== "string" && !Array.isArray(value.content)) {
      throw new InvalidArgumentError(
        "--file messages must include string or content-part content"
      );
    }
    messages.push({
      role,
      content: value.content as PromptMessage["content"],
    });
  }
  if (messages.length === 0) {
    throw new InvalidArgumentError("--file messages must not be empty");
  }
  return messages;
}

function isPromptMessageRole(value: string): value is PromptMessage["role"] {
  return (PROMPT_MESSAGE_ROLES as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
