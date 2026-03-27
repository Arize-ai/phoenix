# register() API and Span Processor Configuration

## register()

The main entry point for creating a configured `NodeTracerProvider`.

### RegisterParams

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `projectName` | `string` | `"default"` | Phoenix project name, set as `SEMRESATTRS_PROJECT_NAME` resource attribute |
| `url` | `string` | env `PHOENIX_COLLECTOR_ENDPOINT` | Phoenix server URL for OTLP export |
| `apiKey` | `string` | env `PHOENIX_API_KEY` | Bearer token for authenticated export |
| `headers` | `Record<string, string>` | — | Custom HTTP headers merged into OTLP requests |
| `batch` | `boolean` | `true` | Use batch processor (production) vs simple processor (debugging) |
| `instrumentations` | `Instrumentation[]` | — | Auto-instrumentations to register |
| `spanProcessors` | `SpanProcessor[]` | — | Custom processors (overrides default OTLP processor when provided) |
| `global` | `boolean` | `true` | Attach provider to OTel globals via `attachGlobalTracerProvider()` |
| `diagLogLevel` | `DiagLogLevel` | — | Enable OTel diagnostic logging at this level |

### Execution Flow

1. Set up `DiagConsoleLogger` if `diagLogLevel` provided.
2. Create `NodeTracerProvider` with resource attributes (`projectName`).
3. Configure span processors: use `spanProcessors` param if provided, otherwise `getDefaultSpanProcessor()`.
4. Register instrumentations if provided.
5. If `global: true`: call `attachGlobalTracerProvider()` and bind auto-detach to `shutdown()`.
6. Return the provider.

### Key Behavior: `global: false`

When `global: false`, the provider is **not** attached to OTel globals. Callers can later attach it manually via `attachGlobalTracerProvider()` for fine-grained control. This is how `phoenix-client`'s experiment engine uses it — creating providers with `global: false` and managing attachment explicitly.

## getDefaultSpanProcessor()

Creates an OTLP-backed span processor:

1. **URL normalization:** `ensureCollectorEndpoint(url)` appends `/v1/traces` if missing.
2. **Auth header:** If `apiKey` provided, adds `"authorization": "Bearer ${apiKey}"`.
3. **Header merge:** Combines auth header with user-provided `headers`.
4. **Exporter:** `OTLPTraceExporter` with the normalized URL and merged headers.
5. **Processor selection:**
   - `batch: true` → `OpenInferenceBatchSpanProcessor(exporter)` — buffers spans and exports in batches (production default).
   - `batch: false` → `OpenInferenceSimpleSpanProcessor(exporter)` — exports each span immediately (useful for tests and debugging).

The processors come from `@arizeai/openinference-vercel`, not directly from `@opentelemetry/sdk-trace-base`. These are Phoenix-specific wrappers.

## ensureCollectorEndpoint()

Normalizes a base URL to include the OTLP traces endpoint:

```typescript
ensureCollectorEndpoint("http://localhost:6006")
// → "http://localhost:6006/v1/traces"

ensureCollectorEndpoint("https://app.phoenix.arize.com/s/my-space")
// → "https://app.phoenix.arize.com/s/my-space/v1/traces"

ensureCollectorEndpoint("http://localhost:6006/v1/traces")
// → "http://localhost:6006/v1/traces" (idempotent)
```

Uses the `URL` constructor for safe parsing. Handles trailing slashes correctly.

## createNoOpProvider()

Returns a `NodeTracerProvider` with no span processors. Spans created through it are silently discarded. Used by `phoenix-client` for dry-run experiment mode.

## objectAsAttributes()

Converts a plain object to an OTel-compatible attribute map (`Record<string, AttributeValue>`), filtering out null/undefined values. Used when attaching experiment metadata as span attributes.

## Environment Variable Resolution

Two env vars are read via helpers in `config.ts`:

| Env var | Helper | Used by |
|---------|--------|---------|
| `PHOENIX_COLLECTOR_ENDPOINT` | `getEnvCollectorURL()` | `register()` — fallback URL |
| `PHOENIX_API_KEY` | `getEnvApiKey()` | `register()` — fallback API key |

Explicit params always take precedence over env vars.
