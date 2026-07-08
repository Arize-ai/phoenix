import createOpenApiClient, {
  type ClientOptions,
  type Middleware,
} from "openapi-fetch";

import type {
  components as oapiComponentsV1,
  operations as oapiOperationsV1,
  paths as oapiPathsV1,
} from "./__generated__/api/v1.d.ts";
import {
  defaultGetEnvironmentOptions,
  makeDefaultClientOptions,
} from "./config";
import type { SemanticVersion } from "./types/semver";
import { parseSemanticVersion } from "./utils/semverUtils";

/**
 * The HTTP response header that carries the Phoenix server version string.
 */
export const PHOENIX_SERVER_VERSION_HEADER = "x-phoenix-server-version";

export type pathsV1 = oapiPathsV1;
export type componentsV1 = oapiComponentsV1;
export type operationsV1 = oapiOperationsV1;

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
 * Middleware to take non-successful API calls throw instead of being swallowed
 */
const middleware: Middleware = {
  onResponse({ response }) {
    if (!response.ok) {
      // Will produce error messages like "https://example.org/api/v1/example: 404 Not Found".
      throw new Error(
        `${response.url}: ${response.status} ${response.statusText}`
      );
    }
  },
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
  const openApiClient = createOpenApiClient<pathsV1>(mergedOptions);

  // Lazily populated by versionMiddleware from the x-phoenix-server-version
  // response header on the first successful API call. Read via getServerVersion().
  let serverVersion: SemanticVersion | null | undefined;

  const versionMiddleware: Middleware = {
    onResponse({ response }) {
      if (serverVersion === undefined) {
        const header = response.headers.get(PHOENIX_SERVER_VERSION_HEADER);
        if (header) {
          serverVersion = parseSemanticVersion(header);
        }
      }
    },
  };

  openApiClient.use(versionMiddleware);
  openApiClient.use(middleware);

  return {
    ...openApiClient,
    config: mergedOptions,
    /**
     * Get the Phoenix server version, returning a cached value if available.
     *
     * The version is first populated from the `x-phoenix-server-version`
     * response header on any API call. If no version has been seen yet,
     * this method fetches `GET /arize_phoenix_version` to populate the cache.
     *
     * @throws {Error} If the server version cannot be determined (e.g. the
     * server is unreachable or returned an unparseable version string).
     */
    getServerVersion: async (): Promise<SemanticVersion> => {
      if (serverVersion != null) return serverVersion;
      try {
        const baseUrl = mergedOptions.baseUrl ?? "";
        const headers = mergedOptions.headers
          ? { ...(mergedOptions.headers as Record<string, string>) }
          : {};
        const resp = await fetch(`${baseUrl}/arize_phoenix_version`, {
          headers,
        });
        if (resp.ok) {
          const text = await resp.text();
          const parsed = parseSemanticVersion(text);
          if (parsed) {
            serverVersion = parsed;
            return serverVersion;
          }
        }
      } catch {
        // fall through to throw below
      }
      throw new Error(
        "Phoenix server version could not be determined. " +
          "Please ensure you are connecting to a supported Phoenix server."
      );
    },
  };
};

/**
 * Resolved type of the Phoenix client
 */
export type PhoenixClient = ReturnType<typeof createClient>;
