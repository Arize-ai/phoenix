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
import {
  parseSemanticVersion,
  satisfiesMinVersion,
} from "./utils/semver";
import type { SemanticVersion } from "./utils/semver";

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

  let serverVersion: SemanticVersion | null | undefined;

  const versionMiddleware: Middleware = {
    onResponse({ response }) {
      if (serverVersion === undefined) {
        const header = response.headers.get("x-phoenix-server-version");
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
     * Check if the connected **Phoenix server** meets a minimum version requirement.
     *
     * The server version is detected from the `x-phoenix-server-version` response
     * header. If no response has been seen yet, this method eagerly fetches the
     * version from `GET /arize_phoenix_version`.
     *
     * Returns `true` if the server version is unknown (e.g. the server doesn't
     * report its version), so that older servers are not blocked by default.
     */
    supportsServerVersion: async (
      minVersion: SemanticVersion
    ): Promise<boolean> => {
      if (serverVersion === undefined) {
        // Eagerly fetch version
        try {
          let baseUrl = mergedOptions.baseUrl ?? "";
          while (baseUrl.endsWith("/")) baseUrl = baseUrl.slice(0, -1);
          const headers = mergedOptions.headers
            ? { ...(mergedOptions.headers as Record<string, string>) }
            : {};
          const resp = await fetch(`${baseUrl}/arize_phoenix_version`, {
            headers,
          });
          if (resp.ok) {
            const text = await resp.text();
            serverVersion = parseSemanticVersion(text);
            if (!serverVersion) {
              serverVersion = null;
            }
          } else {
            serverVersion = null;
          }
        } catch {
          serverVersion = null;
        }
      }
      if (serverVersion == null) return true;
      return satisfiesMinVersion(serverVersion, minVersion);
    },
    /**
     * The cached Phoenix server version, if known.
     * Populated from the `x-phoenix-server-version` response header.
     */
    get serverVersion(): SemanticVersion | undefined {
      return serverVersion ?? undefined;
    },
  };
};

/**
 * Resolved type of the Phoenix client
 */
export type PhoenixClient = ReturnType<typeof createClient>;
