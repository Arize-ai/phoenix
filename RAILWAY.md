# Deploy and Host arize-phoenix on Railway

Phoenix is an open-source AI observability platform designed for experimentation, evaluation, and troubleshooting. It ingests OpenTelemetry traces from your LLM and agent applications, then adds LLM-as-a-judge evaluations, versioned datasets, experiments, a prompt playground, and prompt management — all in one UI. Phoenix is vendor and language agnostic, with out-of-the-box support for popular frameworks and LLM providers.

## About Hosting arize-phoenix

Phoenix ships as a prebuilt image on [Docker Hub](https://hub.docker.com/r/arizephoenix/phoenix), so Railway deploys it without a build step. The container serves the UI and REST API on port `6006` and accepts OTLP/gRPC spans on `4317`, binding to `0.0.0.0` by default. Railway's filesystem is ephemeral, so attach a Postgres service and point `PHOENIX_SQL_DATABASE_URL` at it — Phoenix runs its own migrations on startup. Enable authentication with `PHOENIX_ENABLE_AUTH` and a `PHOENIX_SECRET` of at least 32 characters containing a digit and a lowercase letter. Span-heavy queries want memory, so avoid the smallest instance sizes.

## Common Use Cases

- Tracing LLM and agent applications in development and production, with a searchable span view for debugging latency, token spend, and tool-call failures
- Running evaluations over real traffic — LLM-as-a-judge evals on traced spans, then building a failure taxonomy from what you find
- Prompt engineering and regression testing — iterate in the playground, version prompts, and run experiments against versioned datasets

## Dependencies for arize-phoenix Hosting

- A PostgreSQL database for durable storage (Railway's Postgres works out of the box). Without one, Phoenix falls back to SQLite on the container's ephemeral disk and your traces disappear on redeploy.
- The public `arizephoenix/phoenix` Docker image — no source build or private registry required.
- OpenTelemetry instrumentation in your application to send spans, via [OpenInference](https://github.com/Arize-ai/openinference) or any OTLP-compatible exporter.
- An LLM provider API key (for example `OPENAI_API_KEY`), only if you plan to use evals, the playground, or PXI.

## Implementation Details

Phoenix reads its own `PHOENIX_PORT` rather than Railway's injected `PORT`, so set it explicitly and match Railway's target port to it.

| Variable | Value | Notes |
| --- | --- | --- |
| `PHOENIX_PORT` | `6006` | HTTP port for the UI and REST API |
| `PHOENIX_SQL_DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Reference the Postgres service so data survives redeploys |
| `PHOENIX_ENABLE_AUTH` | `true` | Requires a login for the UI and API |
| `PHOENIX_SECRET` | 32+ chars, ≥1 digit, ≥1 lowercase | Signs auth tokens; the container refuses to start on an invalid value |
| `PHOENIX_USE_SECURE_COOKIES` | `true` | Recommended — Railway serves over HTTPS |

Use `/healthz` as the healthcheck path. The first login uses `admin@localhost` with password `admin` unless you set `PHOENIX_DEFAULT_ADMIN_INITIAL_PASSWORD`; either way you are required to change it on first login.

Point your application at the deployment:

```python
from phoenix.otel import register

tracer_provider = register(
    project_name="my-app",
    endpoint="https://<your-app>.up.railway.app/v1/traces",
    auto_instrument=True,
)
```

With auth enabled, create an API key in the UI and export it as `PHOENIX_API_KEY` so the exporter can authenticate. See the [self-hosting documentation](https://arize.com/docs/phoenix/self-hosting) for the full configuration reference.

## Why Deploy arize-phoenix on Railway?

Railway is a singular platform to deploy your infrastructure stack. Railway will host your infrastructure so you don't have to deal with configuration, while allowing you to vertically and horizontally scale it.

By deploying arize-phoenix on Railway, you are one step closer to supporting a complete full-stack application with minimal burden. Host your servers, databases, AI agents, and more on Railway.
