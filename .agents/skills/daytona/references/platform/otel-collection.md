## Contents

- Configure sandbox collection
- Organization metrics
- SDK tracing
- Example
- Traced operations
- Troubleshooting
- See Also




OpenTelemetry collection exports distributed traces, logs, and metrics from Daytona SDK operations and sandbox runtimes to your observability stack. Data is sent over the OpenTelemetry Protocol (OTLP) to any OTLP-compatible collector or backend.

Daytona supports two independent telemetry paths:

- [**Sandbox telemetry**](#configure-sandbox-collection): collects traces, logs, and metrics from inside sandboxes, including CPU, memory, and filesystem metrics, application logs, and HTTP spans
- [**SDK tracing**](#sdk-tracing): instruments Daytona API operations and SDK calls in your application process

You can enable one or both. SDK tracing covers the control path from your application into Daytona. Sandbox telemetry covers what runs inside the sandbox. Together they provide end-to-end visibility across both sides.
> **Note: Sandbox telemetry data retention**
> Daytona retains sandbox telemetry data for **3 days**. To keep data longer, connect your own OTLP-compatible collector using the [sandbox collection configuration](#configure-sandbox-collection).

## Configure sandbox collection

Configure a sandbox collection endpoint.

1. Go to [Daytona Dashboard ↗](https://app.daytona.io/dashboard/settings)
2. Navigate to **OpenTelemetry** section (visible to organization owners)
3. Configure the following fields:

    - **OTLP Endpoint**: OpenTelemetry collector endpoint

        Example: **`https://otel-collector.example.com`**
    - **Headers**: authentication headers as key/value pairs

        Example: **`api-key` = `YOUR_API_KEY`**

**API:**

```bash
curl 'https://app.daytona.io/api/organizations/ORGANIZATION_ID/otel-config' \
  --request PUT \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --data '{
  "endpoint": "https://otel-collector.example.com",
  "headers": {
    "api-key": "YOUR_COLLECTOR_API_KEY"
  }
}'
```

All sandboxes automatically export their telemetry data to the specified OTLP endpoint.

### Collected data

View collected telemetry for a sandbox.

1. Go to [Daytona Dashboard ↗](https://app.daytona.io/dashboard)
2. Navigate to **Sandboxes** section
3. Open the **Sandbox Details** sheet for any sandbox
4. Use the **Logs**, **Traces**, and **Metrics** tabs to inspect the collected telemetry data

**Python:**

```python
# Historical resource metrics (CPU, memory, disk)
samples = sandbox.get_metrics()
for s in samples:
    print(f"{s.timestamp}: CPU {s.cpu_used_pct}%")
```

**TypeScript:**

```typescript
// Historical resource metrics (CPU, memory, disk)
const samples = await sandbox.getMetrics()
for (const s of samples) {
  console.log(`${s.timestamp.toISOString()} CPU: ${s.cpuUsedPct}%`)
}
```

**Ruby:**

```ruby
# Historical resource metrics (CPU, memory, disk)
sandbox.get_metrics.each { |m| puts "#{m.timestamp}: #{m.cpu_used_pct}%" }
```

**Go:**

```go
// Historical resource metrics (CPU, memory, disk)
samples, err := sandbox.GetMetrics(ctx, nil, nil)
if err != nil {
    return err
}
for _, m := range samples {
    fmt.Printf("%s CPU: %.1f%%\n", m.Timestamp.Format(time.RFC3339), m.CPUUsedPct)
}
```

**Java:**

```java
// Historical resource metrics (CPU, memory, disk)
List<SandboxMetrics> samples = sandbox.getMetrics(null, null);
for (SandboxMetrics s : samples) {
    System.out.println(s.getTimestamp() + " CPU: " + s.getCpuUsedPct() + "%");
}
```

**API:**

```bash
# Logs
curl 'https://app.daytona.io/api/sandbox/{sandboxId}/telemetry/logs?from=2026-01-01T00:00:00Z&to=2026-01-02T00:00:00Z' \
  --header 'Authorization: Bearer YOUR_API_KEY'

# Traces
curl 'https://app.daytona.io/api/sandbox/{sandboxId}/telemetry/traces?from=2026-01-01T00:00:00Z&to=2026-01-02T00:00:00Z' \
  --header 'Authorization: Bearer YOUR_API_KEY'

# Metrics
curl 'https://app.daytona.io/api/sandbox/{sandboxId}/telemetry/metrics?from=2026-01-01T00:00:00Z&to=2026-01-02T00:00:00Z' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

**Metrics:**

- `daytona.sandbox.cpu.utilization`: CPU usage percentage (0-100%)
- `daytona.sandbox.cpu.limit`: CPU cores limit
- `daytona.sandbox.memory.utilization`: Memory usage percentage (0-100%)
- `daytona.sandbox.memory.usage`: Memory used in bytes
- `daytona.sandbox.memory.limit`: Memory limit in bytes
- `daytona.sandbox.filesystem.utilization`: Disk usage percentage (0-100%)
- `daytona.sandbox.filesystem.usage`: Disk space used in bytes
- `daytona.sandbox.filesystem.available`: Disk space available in bytes
- `daytona.sandbox.filesystem.total`: Total disk space in bytes

**Traces:**

- HTTP requests and responses
- Custom spans from your application code

**Logs:**

- Application logs (stdout/stderr)
- System logs
- Runtime errors and warnings

### Resource labels

All sandbox telemetry is automatically annotated with the following OTel resource attributes:

- **`service.name`**: **`sandbox-<id>`** by default. See [service name](#service-name) to override it.
- **`service.instance.id`**: the sandbox ID
- **`daytona_organization_id`**: the organization the sandbox belongs to
- **`daytona_region_id`**: the region the sandbox is running in
- **`daytona_snapshot`**: the snapshot used to create the sandbox

### Custom resource labels

Attach custom resource labels on a sandbox. Labels are a comma-separated list of `key=value` pairs. The labels are added as OTel resource attributes to all traces, logs, and metrics emitted by the sandbox. Use them to filter and group telemetry by custom dimensions in your observability platform.


1. Set the **`DAYTONA_SANDBOX_OTEL_EXTRA_LABELS`** environment variable on a sandbox:

```bash
DAYTONA_SANDBOX_OTEL_EXTRA_LABELS="team=backend,env=staging,app=my-service"
```

### Service name

Override the `service.name` resource attribute on sandbox telemetry. By default, each sandbox reports `service.name` as `sandbox-<id>`. Most observability backends treat every distinct `service.name` as a separate service, so a fleet of sandboxes appears as one service per sandbox. Set a shared name to group all sandboxes under a single service in your backend. Each sandbox stays identifiable through the `service.instance.id` attribute, which holds the sandbox ID.

1. Set the **`DAYTONA_SANDBOX_OTEL_SERVICE_NAME`** [environment variable](../python-sdk/sandboxes.md#environment-variables) when creating a sandbox:

```bash
DAYTONA_SANDBOX_OTEL_SERVICE_NAME="my-agents"
```

The sandbox reads the variable once at startup. Changing it inside a running sandbox has no effect.

The override applies to the telemetry forwarded to your [configured OTLP endpoint](#configure-sandbox-collection). Telemetry stored by Daytona and shown in the Dashboard keeps the default `sandbox-<id>` name. Leading and trailing whitespace is trimmed. An empty or whitespace-only value is treated as unset.

## Organization metrics

In addition to per-sandbox telemetry, Daytona exports organization-level resource metrics to your configured OTLP endpoint. These metrics are pushed every 60 seconds and provide a high-level view of resource consumption and quotas across your organization.

Organization metrics are exported automatically when you have a [sandbox collection endpoint configured](#configure-sandbox-collection). No additional setup is required. The same OTLP endpoint receives both sandbox telemetry and organization metrics.

### Exported metrics

| **Metric**                          | **Unit**  | **Description**                                        |
| ----------------------------------- | --------- | ------------------------------------------------------ |
| **`daytona.sandbox.used_cpu`**      | CPU cores | Total CPU currently consumed by active sandboxes       |
| **`daytona.sandbox.used_ram`**      | GiB       | Total memory currently consumed by active sandboxes    |
| **`daytona.sandbox.used_storage`**  | GiB       | Total disk currently consumed by sandboxes             |
| **`daytona.sandbox.total_cpu`**     | CPU cores | Total CPU quota for the organization                   |
| **`daytona.sandbox.total_ram`**     | GiB       | Total memory quota for the organization                |
| **`daytona.sandbox.total_storage`** | GiB       | Total disk quota for the organization                  |
| **`daytona.sandbox.used_gpu`**      | GPU units | Total GPU units currently consumed by active sandboxes |
| **`daytona.sandbox.total_gpu`**     | GPU units | Total GPU quota for the organization                   |

### Metric attributes

Each metric includes the following attributes for filtering and grouping:

- **`organization.id`** (resource attribute): the organization the metrics belong to
- **`region.id`** (data point attribute): the region the resource usage and quota applies to
- **`sandbox.class`** (data point attribute): the sandbox class the resource usage and quota applies to

GPU metrics for shared regions are exported under the [earth region](../python-sdk/regions.md#earth-region): one data point per sandbox class with `region.id` set to `earth` aggregates the shared GPU usage and quota. Data points for shared regions report `0` for `daytona.sandbox.used_gpu` and omit `daytona.sandbox.total_gpu`. Dedicated and custom regions keep their own GPU data points.

## SDK tracing

SDK tracing instruments Daytona SDK operations in your application process and exports them as OpenTelemetry traces. When enabled, the SDK creates spans for calls your application makes into Daytona, then sends those traces over OTLP to your observability backend.

Send traces to any OTLP-compatible backend:

- [New Relic](#new-relic)
- [Jaeger](#jaeger-local)
- [Grafana Cloud](#grafana-cloud)
- [Datadog](#datadog)

1. Pass the **`otelEnabled`** flag when initializing the Daytona client, or set the **`DAYTONA_OTEL_ENABLED`** environment variable to **`true`**:

```bash
export DAYTONA_OTEL_ENABLED=true
```

**Python:**

```python
from daytona import AsyncDaytona, DaytonaConfig

# Using async context manager (recommended)
async with AsyncDaytona(DaytonaConfig(otel_enabled=True)) as daytona:
    sandbox = await daytona.create()
    # All operations will be traced
# OpenTelemetry traces are flushed on close
```

Or without context manager:

```python
from daytona import AsyncDaytona, DaytonaConfig

daytona = AsyncDaytona(DaytonaConfig(otel_enabled=True))
try:
    sandbox = await daytona.create()
    # All operations will be traced
finally:
    await daytona.close()  # Flushes traces
```

**TypeScript:**

```typescript
import { Daytona } from '@daytona/sdk'

// Using async dispose (recommended)
await using daytona = new Daytona({ otelEnabled: true })

const sandbox = await daytona.create()
// All operations will be traced
// Traces are automatically flushed on dispose
```

Or with explicit disposal:

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona({ otelEnabled: true })

try {
  const sandbox = await daytona.create()
  // All operations will be traced
} finally {
  await daytona[Symbol.asyncDispose]()  // Flushes traces
}
```

**Ruby:**

```ruby
require 'daytona'

config = Daytona::Config.new(otel_enabled: true)
daytona = Daytona::Daytona.new(config)

sandbox = daytona.create
# All operations will be traced

daytona.close # Flushes traces
```

Or with `ensure` block:

```ruby
daytona = Daytona::Daytona.new(
  Daytona::Config.new(otel_enabled: true)
)
begin
  sandbox = daytona.create
  # All operations will be traced
ensure
  daytona.close # Flushes traces
end
```

**Go:**

```go
import (
    "context"
    "log"

    "github.com/daytona/clients/sdk-go/pkg/daytona"
    "github.com/daytona/clients/sdk-go/pkg/types"
)

client, err := daytona.NewClientWithConfig(&types.DaytonaConfig{
    OtelEnabled: true,
})
if err != nil {
    log.Fatal(err)
}
defer client.Close(context.Background()) // Flushes traces

sandbox, err := client.Create(context.Background(), nil)
// All operations will be traced
```

### Configure OTLP exporter

The SDK uses standard OpenTelemetry environment variables for configuration.

```bash
# OTLP endpoint (without the /v1/traces path)
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp.nr-data.net:4317

# Authentication headers (format: key1=value1,key2=value2)
OTEL_EXPORTER_OTLP_HEADERS="api-key=your-api-key-here"
```

### New Relic

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp.nr-data.net:4317
OTEL_EXPORTER_OTLP_HEADERS="api-key=YOUR_NEW_RELIC_LICENSE_KEY"
```

See the [New Relic dashboard example](https://github.com/daytona/clients/tree/main/examples/otel-dashboards/new-relic) for detailed setup steps.

### Jaeger (local)

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

### Grafana Cloud

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-prod-<region>.grafana.net/otlp
OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic <BASE64_ENCODED_CREDENTIALS>"
```

1. Go to [Grafana Cloud Portal](https://grafana.com)
2. Open **Connections**
3. Click <Button>Add new connection</Button>
4. Search for **OpenTelemetry (OTLP)**
5. Follow the wizard to create an access token. The endpoint and headers are provided in the instrumentation instructions. See the [Grafana dashboard example](https://github.com/daytona/clients/tree/main/examples/otel-dashboards/grafana) for detailed setup steps.

### Datadog

Datadog exposes a native OTLP intake endpoint, so you can send telemetry directly to Datadog without a Datadog Agent.

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp.datadoghq.com
OTEL_EXPORTER_OTLP_HEADERS="dd-api-key=YOUR_DATADOG_API_KEY"
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
```

1. Enter the OTLP endpoint for your Datadog site and add a single header **`dd-api-key`** with your Datadog API key:

| **Datadog Site**          | **OTLP Endpoint**                    |
| ------------------------- | ------------------------------------ |
| US1 (**`datadoghq.com`**) | **`https://otlp.datadoghq.com`**     |
| EU (**`datadoghq.eu`**)   | **`https://otlp.datadoghq.eu`**      |
| US3                       | **`https://otlp.us3.datadoghq.com`** |
| US5                       | **`https://otlp.us5.datadoghq.com`** |
| AP1                       | **`https://otlp.ap1.datadoghq.com`** |

Use the base endpoint without a `/v1/...` path. The path is appended automatically.

2. Generate an API key under **Datadog** > **Organization Settings** > **API Keys**. See the [Datadog dashboard example](https://github.com/daytona/clients/tree/main/examples/otel-dashboards/datadog) for an importable dashboard and verification steps.

Metrics appear under **Metrics** > **Summary** (search for `daytona.sandbox`), where you can also confirm the exact tag keys (for example, `service`, `region.id`).
> **Caution: Datadog OTLP intake limitations**
> **Traces are in Preview** (not GA). Metrics and logs are generally available, but trace ingestion via OTLP may need to be enabled for your account by Datadog. Contact your Datadog account team if traces do not appear.
>
> **Direct OTLP intake uses HTTP/protobuf only** (no gRPC). Do not append a gRPC port such as `:4317` to the endpoint.
>
> **Host metadata is not populated** in the Datadog Infrastructure Host List when sending directly to the OTLP intake endpoint.

### Parseable

Parseable exposes a native OTLP HTTP endpoint, so you can send SDK traces directly to a Parseable dataset.

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=https://parseable.example.com
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer <parseable-api-key>,X-P-Stream=daytona-sdk-traces"
```

1. Enter the base URL of your Parseable instance as the OTLP endpoint. Do not append **`/v1/traces`**. The path is appended automatically.
2. Replace **`<parseable-api-key>`** with a Parseable API key that has ingest access.

    The **`X-P-Stream`** header sets the Parseable dataset that receives the traces.

See the [Parseable x Daytona integration guide](https://www.parseable.com/docs/ingest-data/ai-agents/daytona) for detailed setup steps, including routing sandbox telemetry to Parseable through an OpenTelemetry Collector.

## Example

Complete example of OpenTelemetry tracing with the Daytona SDK:

**Python:**

```python
import asyncio
import os
from daytona import AsyncDaytona, DaytonaConfig

# Set OTEL configuration
os.environ["OTEL_EXPORTER_OTLP_ENDPOINT"] = "https://otlp.nr-data.net:4317"
os.environ["OTEL_EXPORTER_OTLP_HEADERS"] = "api-key=YOUR_API_KEY"

async def main():
    # Initialize Daytona with OTEL enabled
    async with AsyncDaytona(DaytonaConfig(otel_enabled=True)) as daytona:

        # Create a sandbox - this operation will be traced
        sandbox = await daytona.create()
        print(f"Created sandbox: {sandbox.id}")

        # Execute code - this operation will be traced
        result = await sandbox.process.code_run("""
import numpy as np
print(f"NumPy version: {np.__version__}")
""")
        print(f"Execution result: {result.result}")

        # Upload a file - this operation will be traced
        await sandbox.fs.upload_file("local.txt", "/home/daytona/remote.txt")

        # Delete sandbox - this operation will be traced
        await daytona.delete(sandbox)

    # Traces are automatically flushed when exiting the context manager

if __name__ == "__main__":
    asyncio.run(main())
```

**TypeScript:**

```typescript
// Set OTEL configuration
process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "https://otlp.nr-data.net:4317"
process.env.OTEL_EXPORTER_OTLP_HEADERS = "api-key=YOUR_API_KEY"

import { Daytona } from '@daytona/sdk'

async function main() {
  // Initialize Daytona with OTEL enabled
  await using daytona = new Daytona({ otelEnabled: true })

  // Create a sandbox - this operation will be traced
  const sandbox = await daytona.create()
  console.log(`Created sandbox: ${sandbox.id}`)

  // Execute code - this operation will be traced
  const result = await sandbox.process.codeRun(`
import numpy as np
print(f"NumPy version: {np.__version__}")
  `)
  console.log(`Execution result: ${result.result}`)

  // Upload a file - this operation will be traced
  await sandbox.fs.uploadFile('local.txt', '/home/daytona/remote.txt')

  // Delete sandbox - this operation will be traced
  await daytona.delete(sandbox)

  // Traces are automatically flushed when the daytona instance is disposed
}

main().catch(console.error)
```

**Ruby:**

```ruby
require 'daytona'

# Set OTEL configuration
ENV["OTEL_EXPORTER_OTLP_ENDPOINT"] = "https://otlp.nr-data.net:4317"
ENV["OTEL_EXPORTER_OTLP_HEADERS"] = "api-key=YOUR_API_KEY"

# Initialize Daytona with OTEL enabled
config = Daytona::Config.new(otel_enabled: true)
daytona = Daytona::Daytona.new(config)

begin
  # Create a sandbox - this operation will be traced
  sandbox = daytona.create
  puts "Created sandbox: #{sandbox.id}"

  # Execute code - this operation will be traced
  result = sandbox.process.code_run(code: "
import numpy as np
print(f'NumPy version: {np.__version__}')
  ")
  puts "Execution result: #{result.result}"

  # Upload a file - this operation will be traced
  sandbox.fs.upload_file("local.txt", "/home/daytona/remote.txt")

  # Delete sandbox - this operation will be traced
  daytona.delete(sandbox)
ensure
  daytona.close # Flushes traces
end
```

**Go:**

```go
package main

import (
    "context"
    "fmt"
    "log"
    "os"

    "github.com/daytona/clients/sdk-go/pkg/daytona"
    "github.com/daytona/clients/sdk-go/pkg/types"
)

func main() {
    // Set OTEL configuration
    os.Setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "https://otlp.nr-data.net:4317")
    os.Setenv("OTEL_EXPORTER_OTLP_HEADERS", "api-key=YOUR_API_KEY")

    ctx := context.Background()

    // Initialize Daytona with OTEL enabled
    client, err := daytona.NewClientWithConfig(&types.DaytonaConfig{
        OtelEnabled: true,
    })
    if err != nil {
      log.Fatal(err)
    }
    defer client.Close(ctx) // Flushes traces on exit

    // Create a sandbox - this operation will be traced
    sandbox, err := client.Create(ctx, nil)
    if err != nil {
      log.Fatal(err)
    }
    fmt.Printf("Created sandbox: %s\n", sandbox.ID)

    // Execute code - this operation will be traced
    result, err := sandbox.Process.CodeRun(ctx, `
import numpy as np
print(f"NumPy version: {np.__version__}")
`)
    if err != nil {
      log.Fatal(err)
    }
    fmt.Printf("Execution result: %s\n", result.Result)

    // Upload a file - this operation will be traced
    err = sandbox.FileSystem.UploadFile(ctx, "local.txt", "/home/daytona/remote.txt")
    if err != nil {
      log.Fatal(err)
    }

    // Delete sandbox - this operation will be traced
    err = sandbox.Delete(ctx)
    if err != nil {
      log.Fatal(err)
    }

    // Traces are flushed when client.Close is called via defer
}
```

## Traced operations

The Daytona SDK automatically instruments the following operations:

### SDK operations

- `create()`: sandbox creation and initialization
- `get()`: retrieving sandbox instances
- `list()`: listing sandboxes
- `start()`: starting sandboxes
- `stop()`: stopping sandboxes
- `delete()`: deleting sandboxes
- All sandbox, snapshot and volume operations

### HTTP requests

- All API calls to the Daytona backend
- Request duration and response status codes
- Error information for failed requests

### Trace attributes

Each trace includes the following metadata:

- Service name and version
- HTTP method, URL, and status code
- Request and response duration
- Error details (if applicable)

## Troubleshooting

Verify the exporter before digging into application code:

1. Check that environment variables are set correctly
2. Verify your OTLP endpoint is reachable
3. Confirm API keys and headers are valid
4. Check your observability platform for incoming traces
5. Look for connection errors in application logs

**Traces not appearing:**

**Symptom:** SDK operations run successfully, but no traces appear in the observability backend.

**Cause:** Tracing is disabled, the OTLP endpoint or headers are wrong, or the Daytona client exits without flushing pending spans.

**Solution:**

1. Ensure **`otelEnabled: true`** is set in the Daytona client configuration, or set **`DAYTONA_OTEL_ENABLED=true`**
2. Verify the OTLP endpoint and headers match your backend
3. Close or dispose the Daytona instance so traces flush before the process exits

See <u>[**SDK tracing**](#sdk-tracing)</u>.

**Connection refused:**

**Symptom:** The application logs connection errors when exporting traces. The OTLP exporter cannot reach the collector.

**Cause:** The OTLP endpoint URL is incorrect, the collector is unreachable from the application host, or a firewall blocks outbound traffic to the collector.

**Solution:**

1. Verify the OTLP endpoint URL is correct
2. Ensure the endpoint is accessible from your application
3. Check firewall rules if running in a restricted environment

See <u>[**configure OTLP exporter**](#configure-otlp-exporter)</u>.

**Authentication:**

**Symptom:** Trace export fails with authentication or authorization errors from the OTLP backend.

**Cause:** The API key or header format does not match what the provider expects. `OTEL_EXPORTER_OTLP_HEADERS` must be a comma-separated list of `key=value` pairs.

**Solution:**

1. Verify the API key format matches your provider's requirements
2. Check that **`OTEL_EXPORTER_OTLP_HEADERS`** uses the correct `key=value` format

See the backend guides under <u>[**SDK tracing**](#sdk-tracing)</u>.

## See Also

- [Python SDK](../python-sdk/README.md)
- [TypeScript SDK](../typescript-sdk/README.md)
- [Java SDK](../java-sdk/README.md)
- [Go SDK](../go-sdk/README.md)
- [Ruby SDK](../ruby-sdk/README.md)
