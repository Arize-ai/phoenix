const ENV_PHOENIX_COLLECTOR_ENDPOINT = "PHOENIX_COLLECTOR_ENDPOINT";
const ENV_PHOENIX_API_KEY = "PHOENIX_API_KEY";
const ENV_PHOENIX_PROJECT_NAME = "PHOENIX_PROJECT_NAME";
const ENV_PHOENIX_PROJECT = "PHOENIX_PROJECT";

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
 * Reads the Phoenix API key from the `PHOENIX_API_KEY` environment variable.
 *
 * @returns The API key if the environment variable is set, otherwise `undefined`.
 */
export function getEnvApiKey(): string | undefined {
  const phoenixEnvApiKey = process.env[ENV_PHOENIX_API_KEY];
  return phoenixEnvApiKey;
}

/**
 * Tracks whether the one-time conflict warning has already been emitted so that
 * repeated calls to {@link getEnvProjectName} do not spam the console.
 */
let hasWarnedProjectConflict = false;

/**
 * Resolves the Phoenix project name from the environment.
 *
 * Reads both `PHOENIX_PROJECT_NAME` (canonical) and `PHOENIX_PROJECT`
 * (supported alias), with `PHOENIX_PROJECT_NAME` taking precedence. An explicit
 * `projectName` passed to `register()` still wins over both; this only covers
 * the environment fallback. When both variables are set to *different* values,
 * the canonical value wins and a one-time warning naming both values is emitted.
 *
 * @returns The resolved project name, or `undefined` if neither variable is set.
 */
export function getEnvProjectName(): string | undefined {
  const canonical = process.env[ENV_PHOENIX_PROJECT_NAME];
  const alias = process.env[ENV_PHOENIX_PROJECT];

  if (canonical && alias && canonical !== alias && !hasWarnedProjectConflict) {
    hasWarnedProjectConflict = true;
    // eslint-disable-next-line no-console
    console.warn(
      `Both ${ENV_PHOENIX_PROJECT_NAME} ("${canonical}") and ${ENV_PHOENIX_PROJECT} ("${alias}") ` +
        `are set to different values. Using ${ENV_PHOENIX_PROJECT_NAME} ("${canonical}"). ` +
        `${ENV_PHOENIX_PROJECT} is a supported alias for ${ENV_PHOENIX_PROJECT_NAME}.`
    );
  }

  return canonical || alias || undefined;
}
