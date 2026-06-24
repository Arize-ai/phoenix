const DEFAULT_PHOENIX_BASE_URL = "http://localhost:6006";
const DEFAULT_MODEL_PROVIDER = "OPENAI";
const DEFAULT_MODEL_NAME = "gpt-4.1";
const DEFAULT_PORT = 8787;

export interface BridgeConfig {
  phoenixAuthToken?: string;
  phoenixBaseUrl: string;
  phoenixModelName: string;
  phoenixModelProvider: string;
  port: number;
  slackBotToken: string;
  slackSigningSecret: string;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (value == null || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getOptionalEnv(name: string): string | undefined {
  const value = process.env[name];
  if (value == null || value.trim() === "") {
    return undefined;
  }
  return value;
}

function getPort(): number {
  const rawPort = getOptionalEnv("PORT");
  if (rawPort == null) {
    return DEFAULT_PORT;
  }
  const port = Number.parseInt(rawPort, 10);
  const isValidPort = Number.isInteger(port) && port > 0 && port < 65_536;
  if (!isValidPort) {
    throw new Error(
      `PORT must be an integer from 1 to 65535. Received: ${rawPort}`
    );
  }
  return port;
}

export function loadBridgeConfig(): BridgeConfig {
  return {
    phoenixAuthToken: getOptionalEnv("PHOENIX_AUTH_TOKEN"),
    phoenixBaseUrl:
      getOptionalEnv("PHOENIX_BASE_URL") ?? DEFAULT_PHOENIX_BASE_URL,
    phoenixModelName:
      getOptionalEnv("PHOENIX_AGENT_MODEL_NAME") ?? DEFAULT_MODEL_NAME,
    phoenixModelProvider:
      getOptionalEnv("PHOENIX_AGENT_MODEL_PROVIDER") ?? DEFAULT_MODEL_PROVIDER,
    port: getPort(),
    slackBotToken: getRequiredEnv("SLACK_BOT_TOKEN"),
    slackSigningSecret: getRequiredEnv("SLACK_SIGNING_SECRET"),
  };
}
