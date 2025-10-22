const ENV_PHOENIX_COLLECTOR_ENDPOINT = "PHOENIX_COLLECTOR_ENDPOINT";
/**
 * A utility function that gets the configured collector URL
 * @returns the URL for the phoenix collector endpoint
 */
export function getEnvCollectorURL(): string | undefined {
  const phoenixEnvURL = process.env[ENV_PHOENIX_COLLECTOR_ENDPOINT];
  // TODO: support OTEL environment variables
  return phoenixEnvURL;
}
