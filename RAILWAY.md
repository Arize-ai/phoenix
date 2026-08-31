# Deploy and Host arize-phoenix on Railway

Phoenix is an open-source AI observability platform for tracing, evaluating, and troubleshooting LLM and agent applications. It ingests OpenTelemetry traces, then adds LLM-as-a-judge evals, versioned datasets, experiments, and a prompt playground in one UI. Phoenix is vendor and language agnostic, working with any OTLP-compatible framework or provider.

## About Hosting arize-phoenix

Phoenix runs from a prebuilt Docker image, so Railway deploys it with no build step. The container serves its UI and API on port 6006 and accepts OTLP/gRPC spans on 4317. Set `PHOENIX_PORT` explicitly — Phoenix reads it rather than Railway's injected `PORT`. Railway's filesystem is ephemeral, so attach a Postgres service and point `PHOENIX_SQL_DATABASE_URL` at it; Phoenix migrates on startup. Enable authentication with `PHOENIX_ENABLE_AUTH` and a `PHOENIX_SECRET` of at least 32 characters including a digit and a lowercase letter.

## Common Use Cases

- Tracing LLM and agent applications to debug latency, token spend, and tool-call failures
- Running evals over real traffic to find where an application actually goes wrong
- Iterating on prompts in the playground and testing changes against versioned datasets

## Dependencies for arize-phoenix Hosting

- A PostgreSQL database for durable storage — without one, Phoenix uses SQLite on the ephemeral disk and loses data on redeploy
- OpenTelemetry instrumentation in your application to send spans, via [OpenInference](https://github.com/Arize-ai/openinference) or any OTLP exporter

## Implementation Details

| Variable | Value |
| --- | --- |
| `PHOENIX_PORT` | `6006` |
| `PHOENIX_SQL_DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `PHOENIX_ENABLE_AUTH` | `true` |
| `PHOENIX_SECRET` | 32+ chars, with a digit and a lowercase letter |

Use `/healthz` as the healthcheck path. The first login is `admin@localhost` / `admin`, and you are required to change it. Point your application at the deployment:

```python
from phoenix.otel import register

tracer_provider = register(
    endpoint="https://<your-app>.up.railway.app/v1/traces",
    auto_instrument=True,
)
```

See the [self-hosting documentation](https://arize.com/docs/phoenix/self-hosting) for the full configuration reference.

## Why Deploy arize-phoenix on Railway?

Railway is a singular platform to deploy your infrastructure stack. Railway will host your infrastructure so you don't have to deal with configuration, while allowing you to vertically and horizontally scale it.

By deploying arize-phoenix on Railway, you are one step closer to supporting a complete full-stack application with minimal burden. Host your servers, databases, AI agents, and more on Railway.
