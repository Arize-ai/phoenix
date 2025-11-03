const ENV_PHOENIX_COLLECTOR_ENDPOINT = "PHOENIX_COLLECTOR_ENDPOINT";
const ENV_PHOENIX_API_KEY = "PHOENIX_API_KEY";

/**
 * A utility function that gets the configured collector URL
 * @returns the URL for the phoenix collector endpoint if configured
 */
export function getEnvCollectorURL(): string | undefined {
  const phoenixEnvURL = process.env[ENV_PHOENIX_COLLECTOR_ENDPOINT];
  // TODO: support OTEL environment variables
  return phoenixEnvURL;
}

/**
 * A utility function that gets the configured API key for the given phoenix.
 */
export function getEnvApiKey(): string | undefined {
  const phoenixEnvApiKey = process.env[ENV_PHOENIX_API_KEY];
  return phoenixEnvApiKey;
}
