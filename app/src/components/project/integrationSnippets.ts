import { BASE_URL } from "@phoenix/config";

import { HOSTED_PHOENIX_URL } from "./hosting";

// -- Packages for "Trace directly from app" --
export const PYTHON_PACKAGES = ["arize-phoenix-otel"] as const;
export const TYPESCRIPT_PACKAGES = ["@arizeai/phoenix-otel"] as const;

// -- Environment variables --

export function getEnvironmentVariables({
  isAuthEnabled,
  isHosted,
  apiKey,
}: {
  isAuthEnabled: boolean;
  isHosted: boolean;
  apiKey?: string;
}): string {
  const apiKeyValue = apiKey || "<your-api-key>";
  if (isHosted) {
    return `PHOENIX_CLIENT_HEADERS='api_key=${apiKeyValue}'\nPHOENIX_COLLECTOR_ENDPOINT='${HOSTED_PHOENIX_URL}'`;
  } else if (isAuthEnabled) {
    return `PHOENIX_API_KEY='${apiKeyValue}'\nPHOENIX_COLLECTOR_ENDPOINT='${BASE_URL}'`;
  }
  return `PHOENIX_COLLECTOR_ENDPOINT='${BASE_URL}'`;
}

// -- Implementation code --

export function getOtelInitCodePython({
  isHosted,
  projectName,
}: {
  isHosted: boolean;
  projectName: string;
}): string {
  return `from phoenix.otel import register\n
tracer_provider = register(
  project_name="${projectName}",
  endpoint="${isHosted ? HOSTED_PHOENIX_URL : BASE_URL}",
  auto_instrument=True
)`;
}

export function getOtelInitCodeTypescript(projectName: string): string {
  return `import { register } from '@arizeai/phoenix-otel';

register({
  projectName: '${projectName}',
  url: '${BASE_URL}',
  apiKey: process.env.PHOENIX_API_KEY,
});`;
}

export function getVercelAiSdkCodeTypescript(projectName: string): string {
  return `import { register } from "@arizeai/phoenix-otel";

// Must be called before any AI SDK imports
const provider = register({
  projectName: "${projectName}",
});

import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const result = await generateText({
  model: openai("gpt-4o-mini"),
  prompt: "Explain the theory of relativity in simple terms.",
  experimental_telemetry: { isEnabled: true },
});

// Flush pending traces before the process exits
await provider.forceFlush();`;
}
