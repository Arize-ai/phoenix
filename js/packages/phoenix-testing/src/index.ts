// Re-export `msw` so workspace consumers can write raw (non-OpenAPI)
// handlers — e.g. for GraphQL or third-party endpoints — without declaring
// their own `msw` dependency and risking a duplicate interceptor version.
// Note: msw's untyped `http` namespace is among these exports; prefer
// `createHttp()` for Phoenix API handlers.
export * from "msw";

export { DEFAULT_MOCK_BASE_URL } from "./constants.js";
export { createOpenApiHandlers, getOpenApiDocument } from "./openApi.js";
export { createHttp } from "./http.js";
export type {
  paths as pathsV1,
  components as componentsV1,
  operations as operationsV1,
} from "./__generated__/api/v1.js";
