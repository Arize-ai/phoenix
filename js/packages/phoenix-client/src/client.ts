import createOpenApiClient, { type ClientOptions } from "openapi-fetch";
import type {
  paths as oapiPathsV1,
  components as oapiComponentsV1,
  operations as oapiOperationsV1,
} from "./__generated__/api/v1.d.ts";
import {
  defaultGetEnvironmentOptions,
  makeDefaultClientOptions,
} from "./config";

type pathsV1 = oapiPathsV1;
type componentsV1 = oapiComponentsV1;
type operationsV1 = oapiOperationsV1;

/**
 * Generated openapi types for the Phoenix client, by API version.
 */
export type Types = {
  V1: {
    paths: pathsV1;
    components: componentsV1;
    operations: operationsV1;
  };
};

/**
 * Merge all configuration options according to priority:
 * defaults < environment < explicit options
 *
 * Headers are simply replaced, not merged.
 *
 * You can call this function before instantiating the client if you need to retain access
 * to the options that were passed in to the client.
 */
export const getMergedOptions = ({
  options = {},
  getEnvironmentOptions = defaultGetEnvironmentOptions,
}: {
  options?: Partial<ClientOptions>;
  getEnvironmentOptions?: () => Partial<ClientOptions>;
} = {}): ClientOptions => {
  const defaultOptions = makeDefaultClientOptions();
  const environmentOptions = getEnvironmentOptions();
  return {
    ...defaultOptions,
    ...environmentOptions,
    ...options,
  };
};

/**
 * Create a Phoenix client.
 *
 * The client is strongly typed and uses generated openapi types.
 *
 * @example
 * ```ts
 * import { createClient } from "@arize/phoenix-client";
 *
 * const client = createClient();
 *
 * const response = await client.GET("/v1/traces");
 * // ^ path string is strongly typed, and completion works with autocomplete
 * // path parameters, query parameters, and request body are also strongly typed based on the openapi spec,
 * // the path, and the method.
 * ```
 *
 * @param config - The configuration to use for the client.
 * @param config.options - The options to use for [openapi-fetch.createOpenApiClient](https://github.com/openapi-ts/openapi-typescript/tree/main/packages/openapi-fetch).
 * @param config.getEnvironmentOptions - The function to use to get the environment options. By default, a function that
 * returns `process.env` is used.
 * @returns The Phoenix client as a strongly typed [openapi-fetch](https://github.com/openapi-ts/openapi-typescript/tree/main/packages/openapi-fetch) client.
 */
export const createClient = (
  config: {
    options?: Partial<ClientOptions>;
    getEnvironmentOptions?: () => Partial<ClientOptions>;
  } = {}
) => {
  const mergedOptions = getMergedOptions(config);
  return {
    ...createOpenApiClient<pathsV1>(mergedOptions),
    config: mergedOptions,
  };
};

/**
 * Resolved type of the Phoenix client
 */
export type PhoenixClient = ReturnType<typeof createClient>;
