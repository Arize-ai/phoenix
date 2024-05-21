---
description: How to configure Phoenix for your needs
---

# Configuration

## Ports

Phoenix is an all-in-one solution that has a tracing UI as well as a trace collector over both HTTP and gRPC.\
\
By default, the container exposes the following ports:

<table><thead><tr><th width="93">Port</th><th width="100">Protocol</th><th width="137">Endpoint</th><th width="259">Function</th><th>Env Var</th></tr></thead><tbody><tr><td>6006</td><td>HTTP</td><td><code>/</code></td><td>User interface (UI) of the web application.</td><td><code>PHOENIX_PORT</code></td></tr><tr><td>6006</td><td>HTTP</td><td><code>/v1/traces</code></td><td>Accepts traces in <a href="https://github.com/open-telemetry/opentelemetry-proto/blob/main/docs/specification.md">OpenTelemetry OTLP format </a> (Protobuf).</td><td><code>PHOENIX_PORT</code></td></tr><tr><td>4317</td><td>gRPC</td><td>n/a</td><td>Accepts traces in <a href="https://github.com/open-telemetry/opentelemetry-proto/blob/main/docs/specification.md">OpenTelemetry OTLP format </a> (Protobuf).</td><td><code>PHOENIX_GRPC_PORT</code></td></tr></tbody></table>

If the above ports need to be modified, consult the [#environment-variables](configuration.md#environment-variables "mention") section below.

## Environment Variables

Phoenix uses environment variables to control how data is sent, received, and stored. Here is the comprehensive list:

### Server Configuration

The following environment variables will control how your phoenix server runs.

* **PHOENIX\_PORT:** The port to run the phoenix web server. Defaults to 6006.
* **PHOENIX\_GRPC\_PORT:** The port to run the gRPC OTLP trace collector. Defaults to 4317.
* **PHOENIX\_HOST:** The host to run the phoenix server. Defaults to 0.0.0.0
* **PHOENIX\_WORKING\_DIR:** The directory in which to save, load, and export datasets. This directory must be accessible by both the Phoenix server and the notebook environment. Defaults to `~/.phoenix/`
* **PHOENIX\_SQL\_DATABASE\_URL:** The SQL database URL to use when logging traces and evals. if you plan on using SQLite, it's advised to to use a persistent volume and simply point the `PHOENIX_WORKING_DIR` to that volume. If URL is not specified, by default Phoenix starts with a file-based SQLite database in a temporary folder, the location of which will be shown at startup. Phoenix also supports PostgresSQL as shown below:
  * PostgreSQL, e.g. `postgresql://@host/dbname?user=user&password=password` or `postgresql://user:password@host/dbname`
  * SQLite, e.g. `sqlite:///path/to/database.db`
* **PHOENIX\_ENABLE\_PROMETHEUS:** Whether to enable Prometheus metrics at port 9090. Defaults to false.
* **PHOENIX\_SERVER\_INSTRUMENTATION\_OTLP\_TRACE\_COLLECTOR\_HTTP\_ENDPOINT:** Specifies an HTTP endpoint for the OTLP trace collector. Specifying this variable enables the OpenTelemetry tracer and exporter for the Phoenix server.
* **PHOENIX\_SERVER\_INSTRUMENTATION\_OTLP\_TRACE\_COLLECTOR\_GRPC\_ENDPOINT:** Specifies an gRPC endpoint for the OTLP trace collector. Specifying this variable enables the OpenTelemetry tracer and exporter for the Phoenix server.

### Notebook Configuration

The following environment variables will control your notebook environment.

* **PHOENIX\_NOTEBOOK\_ENV:** The notebook environment. Typically you do not need to set this but it can be set explicitly (e.x. `sagemaker`)
* **PHOENIX\_COLLECTOR\_ENDPOINT:** The endpoint traces and evals are sent to. This must be set if the Phoenix server is running on a remote instance. For example if phoenix is running at `http://125.2.3.5:4040` , this environment variable must be set where your LLM application is running and being traced. Note that the endpoint should not contain trailing slashes or slugs.
* **PHOENIX\_PROJECT\_NAME:** The project under which traces will be sent. See [projects](../tracing/how-to-tracing/customize-traces.md#log-to-a-specific-project).
