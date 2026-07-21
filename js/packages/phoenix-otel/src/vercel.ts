/**
 * Re-exports of `@arizeai/openinference-vercel` — the span processors,
 * `isOpenInferenceSpan` filter, and related types for translating and
 * filtering Vercel AI SDK spans.
 *
 * Exposed as the ESM-only subpath `@arizeai/phoenix-otel/vercel`:
 * `@arizeai/openinference-vercel` ships no CommonJS build, so these
 * re-exports cannot live on the package root without breaking the CJS
 * entry point on Node versions without require(esm).
 */
export * from "@arizeai/openinference-vercel";
