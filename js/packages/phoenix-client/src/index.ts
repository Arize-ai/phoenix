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
 * Create a Phoenix client.
 *
 * @param configuration - The configuration to use for the client.
 * @param configuration.options - The options to use for the client's OpenAPI Fetch wrapper.
 * @returns The Phoenix client.
 */
export const createClient = ({
  options = {},
}: {
  options?: Partial<ClientOptions>;
  getEnvironmentOptions?: () => Partial<ClientOptions>;
} = {}) => {
  const defaultOptions = makeDefaultClientOptions();
  // we could potentially inject an "environment" object from configuration here
  // in the future, but for now, we'll just use process.env if it exists
  const environmentOptions = defaultGetEnvironmentOptions();
  const mergedOptions = {
    ...defaultOptions,
    ...environmentOptions,
    ...options,
  };
  console.dir(mergedOptions, { depth: null });
  return createOpenApiClient<pathsV1>(mergedOptions);
};
