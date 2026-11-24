# OpenTelemetry (TypeScript SDK)

Export logs, traces, and metrics from sandboxes and from the Daytona SDKs over OpenTelemetry.

OpenTelemetry for sandboxes covers two independent paths. Sandbox telemetry is the logs, traces, and metrics produced inside a sandbox, which are collected and can be forwarded to your own OpenTelemetry collector. SDK tracing is the client spans that the SDKs emit in your application, one for each request that they send.

Every sandbox reports its own telemetry without setup: traces of toolbox requests, the output of its processes, and resource metrics. Programs you run in a sandbox send telemetry only when you point them at the sandbox telemetry endpoint. Daytona does not point any program at the endpoint, including instrumented services an image starts on its own, such as Docker.

SDK tracing is off by default. When it is on, each SDK request runs in a client span in your application's trace and carries W3C trace context headers. The SDKs do not install an OpenTelemetry tracer provider or exporter; your application configures both.

| **Concept**                | **Description**                                                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Sandbox telemetry**      | Logs, traces, and metrics produced in a sandbox, by the sandbox itself and by programs configured to send them.         |
| **Telemetry endpoint**     | The OTLP/HTTP endpoint inside each sandbox, at the address in the DAYTONA_OTEL_ENDPOINT environment variable.           |
| **Telemetry forwarding**   | The organization setting that forwards sandbox telemetry to your OpenTelemetry collector.                               |
| **SDK tracing**            | Client spans that the Python and TypeScript SDKs emit for each request to Daytona.                                      |

## Contents

- [Send telemetry from a program](#send-telemetry-from-a-program)
- [Forward sandbox telemetry](#forward-sandbox-telemetry)
- [Trace SDK requests](#trace-sdk-requests)
- [Permissions](#permissions)

## Send telemetry from a program

Point a program in a sandbox at the telemetry endpoint to send its logs, traces, and metrics. Every process in the sandbox sees the endpoint address in the DAYTONA_OTEL_ENDPOINT environment variable. Daytona does not set the standard OpenTelemetry exporter variables, so set both of them when you start the program. Telemetry that the program sends is collected with the sandbox's own telemetry and forwarded to your collector when [telemetry forwarding](#forward-sandbox-telemetry) is set.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create()

const response = await sandbox.process.run(
  'OTEL_EXPORTER_OTLP_ENDPOINT=$DAYTONA_OTEL_ENDPOINT ' +
    'OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf ' +
    'node app.js',
)
```

> **Notes:**
>
> - **Prerequisites:** The program must use an OpenTelemetry SDK or another OTLP exporter. Set OTEL_EXPORTER_OTLP_ENDPOINT to `$DAYTONA_OTEL_ENDPOINT` and OTEL_EXPORTER_OTLP_PROTOCOL to `http/protobuf` in the program's start command.
> - **Compatibility:** The endpoint accepts only uncompressed OTLP/HTTP with protobuf bodies.
> - **Behaviour:** A sandbox started before Daytona stopped setting the standard exporter variables passes them to new processes until you [unset them](./process-execution.md#update-the-environment) or stop and start the sandbox.

## Forward sandbox telemetry

Forward the sandbox telemetry of an organization to your OpenTelemetry collector. Daytona forwards the logs, traces, and metrics of every sandbox in the organization to the OTLP/HTTP endpoint in the forwarding configuration. A forwarding configuration that was set before a plan change keeps forwarding until the configuration is deleted.

### Get the configuration

Get the telemetry forwarding configuration. The response lists the names of the configured request headers; header values are write-only and never returned.

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/otel-config' \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

**Response:**

```json
{
  "endpoint": "https://otel.example.com",
  "header_names": ["Authorization"],
  "created_at": "2026-09-10T12:00:00Z",
  "updated_at": "2026-09-10T12:00:00Z"
}
```

| **Field** | **Description** |
| --- | --- |
| `org_id` | Sets the organization to read.<br />**Format:** an organization ID |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

### Set the configuration

Set telemetry forwarding. Each write replaces the whole configuration, including headers.

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/otel-config' \
  --request PUT \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
  "endpoint": "https://otel.example.com",
  "headers": { "Authorization": "Bearer YOUR_COLLECTOR_TOKEN" }
}'
```

| **Field** | **Description** |
| --- | --- |
| `endpoint` | Sets the OTLP/HTTP endpoint that sandbox telemetry is forwarded to.<br />**Required**<br />**Maximum:** 2048 bytes<br />**Format:** an https URL without user info, query, or fragment that resolves only to public IP addresses<br />**Example:** `"https://otel.example.com"` |
| `headers` | Sets the request headers sent to the endpoint.<br />**Default:** no headers<br />**Maximum:** 16 headers and 16 KiB of names and values<br />**Format:** a map of header names of 1 to 128 bytes, other than transport headers, User-Agent, and names that start with Proxy-, to values of 1 to 4096 bytes of visible ASCII, space, or tab<br />**Value:** `"********"` for the stored value of the header<br />**Example:** `{"Authorization": "Bearer YOUR_COLLECTOR_TOKEN"}` |
| `org_id` | Sets the organization to configure.<br />**Format:** an organization ID |

> **Notes:**
>
> - **Prerequisites:** The request requires the Enterprise [plan](../platform/billing.md#get-the-plan). The request requires a signed-in user token, not an API key.
> - **Behaviour:** Daytona appends /v1/logs, /v1/traces, or /v1/metrics to the endpoint for each signal.

### Delete the configuration

Delete the telemetry forwarding configuration. Sandbox telemetry stops being forwarded.

**API:**

```bash
curl 'https://api.daytona.com/orgs/ORGANIZATION_ID/otel-config' \
  --request DELETE \
  --header 'Authorization: Bearer YOUR_OIDC_TOKEN'
```

| **Field** | **Description** |
| --- | --- |
| `org_id` | Sets the organization to stop forwarding for.<br />**Format:** an organization ID |

> **Notes:**
>
> - **Prerequisites:** The request requires a signed-in user token, not an API key.

## Trace SDK requests

Turn on SDK tracing to emit a client span for each request the SDK sends to Daytona. Each span is named after the HTTP method and the route template, such as daytona.post /sandboxes for a create request, and the SDK adds W3C trace context headers to the request. The spans go to the tracer provider that your application registers; without one, they are not exported.

```bash
npm install @daytona/sdk@2 @opentelemetry/sdk-node @opentelemetry/exporter-trace-otlp-proto
```

```typescript
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { Daytona } from '@daytona/sdk'

const otel = new NodeSDK({ traceExporter: new OTLPTraceExporter() })
otel.start()

const daytona = new Daytona({ otelEnabled: true })
const sandbox = await daytona.v2.create()

// Export the buffered spans before the process exits
await otel.shutdown()
```

| **Parameter** | **Description** |
| --- | --- |
| `otelApi` | Passes the @opentelemetry/api module of the application.<br />**Default:** the @opentelemetry/api module that the SDK loads in Node.js<br />**Example:** `api` |
| `otelEnabled` | Emits a client span for each SDK request.<br />**Default:** `false`, or `true` when DAYTONA_OTEL_ENABLED is `1` or `true` |

> **Notes:**
>
> - **Prerequisites:** The application must install @opentelemetry/api.
> - **Clients:** In a bundled browser app, pass `import * as api from '@opentelemetry/api'` as otelApi.

Each span has the following attributes:

| **Attribute**               | **Description**                                                       |
| --------------------------- | --------------------------------------------------------------------- |
| `http.request.method`       | HTTP method of the request                                            |
| `url.template`              | Route template of the request, such as `/sandboxes/{id}`               |
| `server.address`            | Host name of the server the request goes to, such as the Daytona API or the toolbox |
| `daytona.sandbox_id`        | ID of the sandbox the request targets, when the request has one       |
| `http.response.status_code` | HTTP status code of the response. A status of 400 or higher marks the span as an error. |

## Permissions

Telemetry forwarding is configured per organization and is governed by organization permissions, which you can grant through an [organization role](./organizations.md#roles). Sending telemetry from a program and SDK tracing require no permissions beyond those of the requests they run. The [audit logs](./audit-logs.md) record changes to the forwarding configuration.

| **Permission**           | **Grants**                                      |
| ------------------------ | ----------------------------------------------- |
| **`read:organization`**  | Get the telemetry forwarding configuration      |
| **`write:organization`** | Set and delete the telemetry forwarding configuration |
