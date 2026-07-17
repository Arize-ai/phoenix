import { DEFAULT_PHOENIX_BASE_URL } from "@arizeai/phoenix-config";

/**
 * The base URL that mock handlers are registered against by default. This
 * matches the default base URL of `@arizeai/phoenix-client`, so tests that
 * point the client at a local Phoenix server work without extra wiring.
 */
export const DEFAULT_MOCK_BASE_URL = DEFAULT_PHOENIX_BASE_URL;
