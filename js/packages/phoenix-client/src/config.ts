import {
  DEFAULT_PHOENIX_BASE_URL,
  getBaseUrlFromEnvironment,
  getCredentialsFromEnvironment,
} from "@arizeai/phoenix-config";
import type { ClientOptions } from "openapi-fetch";

/**
 * Convert resolved Phoenix credentials into a ClientOptions object.
 *
 * @param credentials - The API key and headers resolved from the environment.
 * @returns The converted ClientOptions object.
 */
const phoenixCredentialsToClientOptions = (
  credentials: ReturnType<typeof getCredentialsFromEnvironment>
): Partial<ClientOptions> => {
  const options: Partial<ClientOptions> = {
    headers: {
      ...(credentials.headers ?? {}),
      ...(credentials.apiKey
        ? { Authorization: `Bearer ${credentials.apiKey}` }
        : {}),
    },
  };

  // if headers is an empty object, delete it
  if (options.headers && Object.keys(options.headers).length === 0) {
    delete options.headers;
  }

  // filter out undefined values
  // this will prevent clobbering over default values when merging
  return Object.fromEntries(
    Object.entries(options).filter(([_, v]) => v !== undefined)
  );
};

/**
 * Where a client's base URL came from: an explicit `baseUrl` option
 * (`"explicit"`), a Phoenix environment variable (`"environment"`), or the
 * built-in localhost default (`"default"`).
 *
 * Explicit configuration outranks the ambient environment, so this is what
 * decides whether an environment variable may retarget the client's trace
 * export.
 */
export type BaseUrlSource = "default" | "environment" | "explicit";

/**
 * Get the environment options from the environment.
 *
 * @returns The environment options as a Partial<ClientOptions> object.
 */
export const defaultGetEnvironmentOptions = (): Partial<ClientOptions> => {
  // feature detect process and process.env
  if (typeof process !== "object" || typeof process.env !== "object") {
    return {};
  }
  const options = phoenixCredentialsToClientOptions(
    getCredentialsFromEnvironment()
  );
  // The base URL resolves as a tier group (PHOENIX_ENDPOINT first, inferring
  // from the trace-export variables, then legacy PHOENIX_HOST) rather than
  // variable by variable.
  const baseUrl = getBaseUrlFromEnvironment();
  return baseUrl !== undefined ? { ...options, baseUrl } : options;
};

/**
 * Make the default client options.
 *
 * @returns The default client options as a Partial<ClientOptions> object.
 */
export const makeDefaultClientOptions = (): Partial<ClientOptions> => {
  return {
    baseUrl: DEFAULT_PHOENIX_BASE_URL,
  };
};
