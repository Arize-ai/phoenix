import { randomUUID } from "node:crypto";
import { Command } from "commander";

import type { PhoenixConfig } from "../config";
import { getConfigErrorMessage, resolveConfig } from "../config";
import { renderCurlCommand } from "../curl";
import {
  ExitCode,
  getExitCodeForError,
  InvalidArgumentError,
} from "../exitCodes";
import { writeError, writeOutput } from "../io";

const MODEL_PROVIDERS = [
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
] as const;

const OPENAI_API_TYPES = ["responses", "chat_completions"] as const;

type ModelProvider = (typeof MODEL_PROVIDERS)[number];
type OpenAIApiType = (typeof OPENAI_API_TYPES)[number];

type ChatContext =
  | {
      type: "app";
      currentDateTime: string;
      timeZone: string;
    }
  | {
      type: "graphql";
      mutationsEnabled: boolean;
    }
  | {
      type: "web_access";
      enabled: boolean;
    }
  | {
      type: "subagents";
      enabled: boolean;
    };

interface ChatRequest {
  id: string;
  trigger: "submit-message";
  messages: Array<{
    id: string;
    role: "user";
    parts: Array<{
      type: "text";
      text: string;
    }>;
  }>;
  contexts: ChatContext[];
  editPermission: "manual";
  ingestTraces: boolean;
  exportRemoteTraces: boolean;
  requestedSkills: string[];
  model: {
    providerType: "builtin";
    provider: ModelProvider;
    modelName: string;
    openaiApiType: OpenAIApiType;
  };
}

interface AssistantMessageMetadata {
  sessionId: string;
  trace?: {
    traceId: string;
    rootSpanId: string;
  } | null;
  usage?: {
    tokens: {
      prompt: number;
      completion: number;
      total: number;
    };
    promptDetails?: {
      cacheRead: number;
      cacheWrite: number;
    } | null;
  } | null;
}

class AgentHttpError extends Error {
  readonly exitCode: ExitCode;

  constructor({ message, exitCode }: { message: string; exitCode: ExitCode }) {
    super(message);
    this.name = "AgentHttpError";
    this.exitCode = exitCode;
  }
}

interface AgentRunOptions {
  endpoint?: string;
  apiKey?: string;
  profile?: string;
  provider?: string;
  model?: string;
  openaiApiType?: string;
  sessionId?: string;
  format?: string;
  curl?: boolean;
  showToken?: boolean;
}

export interface AgentRunRequest {
  url: string;
  method: "POST";
  headers: Record<string, string>;
  body: string;
}

export interface AgentRunResult {
  text: string;
  sessionId: string;
  usage: AssistantMessageMetadata["usage"] | null;
  trace: AssistantMessageMetadata["trace"] | null;
}

interface BuildAgentRunRequestOptions {
  prompt: string;
  config: PhoenixConfig;
  provider: ModelProvider;
  modelName: string;
  openaiApiType: OpenAIApiType;
  sessionId: string;
  messageId: string;
  now?: Date;
  timeZone?: string;
}

interface AgentStreamChunk {
  type?: string;
  delta?: unknown;
  errorText?: unknown;
  messageMetadata?: unknown;
}

interface ParsedAgentStreamEvent {
  data: string;
}

interface ReadAgentStreamOptions {
  stream: ReadableStream<Uint8Array>;
  onTextDelta?: (delta: string) => void;
}

function getCurrentTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function buildCurrentDateTime({
  now,
  timeZone,
}: {
  now: Date;
  timeZone: string;
}): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((partsByType, part) => {
      if (part.type !== "literal") {
        partsByType[part.type] = part.value;
      }
      return partsByType;
    }, {});

  let { year, month, day } = parts;
  let hour = parts.hour;
  if (hour === "24") {
    hour = "00";
    const nextDay = new Date(`${year}-${month}-${day}T00:00:00Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    year = String(nextDay.getUTCFullYear());
    month = String(nextDay.getUTCMonth() + 1).padStart(2, "0");
    day = String(nextDay.getUTCDate()).padStart(2, "0");
  }

  const datePart = `${year}-${month}-${day}`;
  const timePart = `${hour}:${parts.minute}:${parts.second}`;
  const wallAsUtc = new Date(`${datePart}T${timePart}Z`).getTime();
  const totalMinutes = Math.round((wallAsUtc - now.getTime()) / 60_000);
  const sign = totalMinutes >= 0 ? "+" : "-";
  const absMinutes = Math.abs(totalMinutes);
  const offsetHours = String(Math.floor(absMinutes / 60)).padStart(2, "0");
  const offsetMinutes = String(absMinutes % 60).padStart(2, "0");

  return `${datePart}T${timePart}${sign}${offsetHours}:${offsetMinutes}`;
}

function buildDefaultContexts({
  now = new Date(),
  timeZone = getCurrentTimeZone(),
}: {
  now?: Date;
  timeZone?: string;
} = {}): ChatContext[] {
  return [
    {
      type: "app",
      currentDateTime: buildCurrentDateTime({ now, timeZone }),
      timeZone,
    },
    {
      type: "graphql",
      mutationsEnabled: false,
    },
    {
      type: "web_access",
      enabled: false,
    },
    {
      type: "subagents",
      enabled: false,
    },
  ];
}

function parseModelProvider({ value }: { value: string | undefined }): {
  provider: ModelProvider;
} {
  if (!value) {
    throw new InvalidArgumentError(
      "Missing required --provider. Expected one of: " +
        MODEL_PROVIDERS.join(", ")
    );
  }

  if (!MODEL_PROVIDERS.includes(value as ModelProvider)) {
    throw new InvalidArgumentError(
      `Invalid value for --provider: ${value}. Expected one of: ${MODEL_PROVIDERS.join(
        ", "
      )}.`
    );
  }

  return { provider: value as ModelProvider };
}

function parseModelName({ value }: { value: string | undefined }): {
  modelName: string;
} {
  if (!value) {
    throw new InvalidArgumentError(
      "Missing required --model. Expected a non-empty model name."
    );
  }
  return { modelName: value };
}

function parseOpenAIApiType({ value }: { value: string | undefined }): {
  openaiApiType: OpenAIApiType;
} {
  const openaiApiType = value ?? "responses";
  if (!OPENAI_API_TYPES.includes(openaiApiType as OpenAIApiType)) {
    throw new InvalidArgumentError(
      `Invalid value for --openai-api-type: ${openaiApiType}. Expected one of: ${OPENAI_API_TYPES.join(
        ", "
      )}.`
    );
  }
  return { openaiApiType: openaiApiType as OpenAIApiType };
}

function parseFormat({ value }: { value: string | undefined }): {
  format: "text" | "json";
} {
  const format = value ?? "text";
  if (format !== "text" && format !== "json") {
    throw new InvalidArgumentError(
      `Invalid value for --format: ${format}. Expected one of: text, json.`
    );
  }
  return { format };
}

function getRequiredEndpoint({ config }: { config: PhoenixConfig }): string {
  if (!config.endpoint) {
    throw new InvalidArgumentError(
      getConfigErrorMessage({
        errors: [
          "Phoenix endpoint not configured. Set PHOENIX_HOST environment variable or use --endpoint flag.",
        ],
      })
    );
  }
  return config.endpoint.replace(/\/$/, "");
}

/**
 * Builds the exact outbound server-agent request used by both live execution
 * and `--curl` preview mode so the two paths cannot drift apart.
 */
export function buildAgentRunRequest({
  prompt,
  config,
  provider,
  modelName,
  openaiApiType,
  sessionId,
  messageId,
  now,
  timeZone,
}: BuildAgentRunRequestOptions): AgentRunRequest {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
    ...(config.headers ?? {}),
  };
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  const body: ChatRequest = {
    id: sessionId,
    trigger: "submit-message",
    messages: [
      {
        id: messageId,
        role: "user",
        parts: [
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ],
    contexts: buildDefaultContexts({ now, timeZone }),
    editPermission: "manual",
    ingestTraces: false,
    exportRemoteTraces: false,
    requestedSkills: [],
    model: {
      providerType: "builtin",
      provider,
      modelName,
      openaiApiType,
    },
  };

  return {
    url: `${getRequiredEndpoint({ config })}/agents/server/sessions/${encodeURIComponent(
      sessionId
    )}/chat`,
    method: "POST",
    headers,
    body: JSON.stringify(body),
  };
}

async function* readSseEvents({
  stream,
}: {
  stream: ReadableStream<Uint8Array>;
}): AsyncGenerator<ParsedAgentStreamEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

      let separatorIndex = buffer.indexOf("\n\n");
      while (separatorIndex !== -1) {
        const block = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);
        const data = block
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice("data:".length).trimStart())
          .join("\n");
        if (data) {
          yield { data };
        }
        separatorIndex = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }

  const remaining = `${buffer}${decoder.decode()}`.trim();
  if (remaining) {
    const data = remaining
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trimStart())
      .join("\n");
    if (data) {
      yield { data };
    }
  }
}

function parseAgentStreamChunk({ data }: { data: string }): AgentStreamChunk {
  try {
    return JSON.parse(data) as AgentStreamChunk;
  } catch (error) {
    throw new Error(
      `Failed to parse agent stream event as JSON: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

function getMessageMetadata({
  chunk,
}: {
  chunk: AgentStreamChunk;
}): AssistantMessageMetadata | null {
  if (
    typeof chunk.messageMetadata === "object" &&
    chunk.messageMetadata !== null
  ) {
    return chunk.messageMetadata as AssistantMessageMetadata;
  }
  return null;
}

export async function readAgentStream({
  stream,
  onTextDelta,
}: ReadAgentStreamOptions): Promise<AgentRunResult> {
  let text = "";
  let metadata: AssistantMessageMetadata | null = null;

  for await (const event of readSseEvents({ stream })) {
    if (event.data === "[DONE]") {
      break;
    }

    const chunk = parseAgentStreamChunk({ data: event.data });
    if (chunk.type === "text-delta" && typeof chunk.delta === "string") {
      text += chunk.delta;
      onTextDelta?.(chunk.delta);
      continue;
    }

    if (chunk.type === "message-metadata") {
      metadata = getMessageMetadata({ chunk }) ?? metadata;
      continue;
    }

    if (chunk.type === "error") {
      const errorText =
        typeof chunk.errorText === "string"
          ? chunk.errorText
          : "Unknown agent stream error.";
      throw new Error(errorText);
    }
  }

  return {
    text,
    sessionId: metadata?.sessionId ?? "",
    usage: metadata?.usage ?? null,
    trace: metadata?.trace ?? null,
  };
}

async function agentRunHandler(
  prompt: string,
  options: AgentRunOptions
): Promise<void> {
  try {
    if (options.showToken && !options.curl) {
      throw new InvalidArgumentError(
        "--show-token can only be used with --curl."
      );
    }

    const { provider } = parseModelProvider({ value: options.provider });
    const { modelName } = parseModelName({ value: options.model });
    const { openaiApiType } = parseOpenAIApiType({
      value: options.openaiApiType,
    });
    const { format } = parseFormat({ value: options.format });
    const config = resolveConfig({
      cliOptions: { endpoint: options.endpoint, apiKey: options.apiKey },
      profileName: options.profile,
    });
    const sessionId = options.sessionId ?? randomUUID();
    const messageId = randomUUID();
    const request = buildAgentRunRequest({
      prompt,
      config,
      provider,
      modelName,
      openaiApiType,
      sessionId,
      messageId,
    });

    if (options.curl) {
      writeOutput({
        message: renderCurlCommand({
          method: request.method,
          url: request.url,
          headers: request.headers,
          body: request.body,
          maskTokens: !options.showToken,
        }),
      });
      return;
    }

    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    if (!response.ok) {
      throw new AgentHttpError({
        message: `HTTP ${response.status} ${response.statusText} from ${request.url}`,
        exitCode:
          response.status === 401 || response.status === 403
            ? ExitCode.AUTH_REQUIRED
            : ExitCode.FAILURE,
      });
    }

    if (!response.body) {
      throw new Error("Agent response did not include a readable stream body.");
    }

    const result = await readAgentStream({
      stream: response.body,
      onTextDelta:
        format === "text"
          ? (delta) => {
              process.stdout.write(delta);
            }
          : undefined,
    });

    if (format === "json") {
      writeOutput({
        message: JSON.stringify(
          {
            text: result.text,
            sessionId: result.sessionId || sessionId,
            usage: result.usage,
            trace: result.trace,
          },
          null,
          2
        ),
      });
    }
  } catch (error) {
    writeError({
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
    if (error instanceof AgentHttpError) {
      process.exit(error.exitCode);
    }
    process.exit(getExitCodeForError(error));
  }
}

function createAgentRunCommand(): Command {
  return new Command("run")
    .description(
      "Run the Phoenix server agent for a single prompt.\n" +
        "\n" +
        "  Examples:\n" +
        "\n" +
        '    px agent run "Summarize recent trace failures" --provider OPENAI --model gpt-4.1\n' +
        "\n" +
        '    px agent run "Inspect project health" --provider ANTHROPIC --model claude-sonnet-4-5 --format json\n' +
        "\n" +
        '    px agent run "Show me the request" --provider OPENAI --model gpt-4.1 --curl\n' +
        "\n" +
        "  The command streams assistant text to stdout by default. Use --format json\n" +
        "  to emit the final text plus session, usage, and trace metadata."
    )
    .argument("<prompt>", "Prompt to send to the Phoenix server agent")
    .option(
      "--provider <provider>",
      `Built-in Phoenix model provider (${MODEL_PROVIDERS.join(", ")})`
    )
    .option("--model <modelName>", "Model name to use for the agent")
    .option(
      "--openai-api-type <type>",
      "OpenAI/Azure API type (responses or chat_completions)",
      "responses"
    )
    .option("--session-id <id>", "Reuse a server-agent session identifier")
    .option("--format <format>", "Output format (text or json)", "text")
    .option("--endpoint <url>", "Phoenix API endpoint (or set PHOENIX_HOST)")
    .option("--api-key <key>", "Phoenix API key (or set PHOENIX_API_KEY)")
    .option("--profile <name>", "Named Phoenix CLI profile to use")
    .option(
      "--curl",
      "Print the equivalent curl command instead of executing the request"
    )
    .option(
      "--show-token",
      "Show the raw Authorization token in curl output (requires --curl)"
    )
    .action(agentRunHandler);
}

export function createAgentCommand(): Command {
  const command = new Command("agent");
  command.description("Run Phoenix agents from the CLI");
  command.addCommand(createAgentRunCommand());
  return command;
}
