import createOpenApiClient, { ClientOptions } from "openapi-fetch";
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
 * @param configuration - The configuration to use for the client.
 * @param configuration.options - The options to use for the client's OpenAPI Fetch wrapper.
 * @returns The Phoenix client.
 */
export const createClient = (
  config: {
    options?: Partial<ClientOptions>;
    getEnvironmentOptions?: () => Partial<ClientOptions>;
  } = {},
) => {
  const mergedOptions = getMergedOptions(config);
  return createOpenApiClient<pathsV1>(mergedOptions);
};

export type PhoenixClient = ReturnType<typeof createClient>;
