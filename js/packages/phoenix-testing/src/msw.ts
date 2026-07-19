/**
 * Re-export of the underlying `msw` package so workspace consumers can write
 * raw (non-OpenAPI) handlers — e.g. for GraphQL or third-party endpoints —
 * without declaring their own `msw` dependency and risking a duplicate
 * interceptor version.
 */
export * from "msw";
