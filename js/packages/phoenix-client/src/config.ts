import {
  DEFAULT_PHOENIX_BASE_URL,
  EnvironmentConfig,
  getEnvironmentConfig,
} from "@arizeai/phoenix-config";

import type { ClientOptions } from "openapi-fetch";

/**
 * Convert a EnvironmentConfig object into a ClientOptions object.
 *
 * @param environment - The EnvironmentConfig object to convert.
 * @returns The converted ClientOptions object.
 */
const phoenixEnvironmentToClientOptions = (
  environment: EnvironmentConfig
): Partial<ClientOptions> => {
  const options: Partial<ClientOptions> = {
    baseUrl: environment.PHOENIX_HOST,
    headers: {
      ...(environment.PHOENIX_CLIENT_HEADERS ?? {}),
      ...(environment.PHOENIX_API_KEY
        ? { Authorization: `Bearer ${environment.PHOENIX_API_KEY}` }
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
 * Get the environment options from the environment.
 *
 * @returns The environment options as a Partial<ClientOptions> object.
 */
export const defaultGetEnvironmentOptions = (): Partial<ClientOptions> => {
  // feature detect process and process.env
  if (typeof process !== "object" || typeof process.env !== "object") {
    return {};
  }
  return phoenixEnvironmentToClientOptions(getEnvironmentConfig());
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
