# Phoenix Tracing: Projects (TypeScript)

**Organize traces by application using projects (Phoenix's top-level grouping).**

## Overview

Projects group traces for a single application or experiment.

**Use for:** Environments (dev/staging/prod), A/B testing, versioning

## Setup

### Environment Variable (Recommended)

```bash
export PHOENIX_PROJECT="my-app-prod"  # PHOENIX_PROJECT_NAME is a supported alias
```

```typescript
process.env.PHOENIX_PROJECT = "my-app-prod";
import { register } from "@arizeai/phoenix-otel";
register();  // Uses "my-app-prod"
```

`PHOENIX_PROJECT` is canonical and takes precedence over the `PHOENIX_PROJECT_NAME`
alias when both are set.

### Code

```typescript
import { register } from "@arizeai/phoenix-otel";
register({ projectName: "my-app-prod" });
```

## Use Cases

**Environments:**
```typescript
// Dev, staging, prod
register({ projectName: "my-app-dev" });
register({ projectName: "my-app-staging" });
register({ projectName: "my-app-prod" });
```

**A/B Testing:**
```typescript
// Compare models
register({ projectName: "chatbot-gpt4" });
register({ projectName: "chatbot-claude" });
```

**Versioning:**
```typescript
// Track versions
register({ projectName: "my-app-v1" });
register({ projectName: "my-app-v2" });
```

## Listing Projects Programmatically

`@arizeai/phoenix-client` exposes a `projects` subpath export. `getProjects`
pages through the REST API for you and returns every project:

```typescript
import { getProjects } from "@arizeai/phoenix-client/projects";

const projects = await getProjects();
for (const project of projects) {
  console.log(`Project: ${project.name} (${project.id})`);
}
```

Pass `nameContains` to filter on a case-insensitive substring of the project
name. The match runs server-side and requires Phoenix server >= 17.16.0:

```typescript
const agentProjects = await getProjects({ nameContains: "agent" });
```

`getProjects` accepts `client` alongside `nameContains` (it extends `ClientFn`),
so a client built with an explicit endpoint or headers can be threaded through.

## Assigning a Retention Policy

`setProjectRetentionPolicy` points a project at an existing trace retention
policy, or resets it to the default. It only changes the assignment — it does
not create, read, update, or delete policies, so the policy must already exist
and you need its GlobalID in hand.

```typescript
import { setProjectRetentionPolicy } from "@arizeai/phoenix-client/projects";

// Assign an existing policy
await setProjectRetentionPolicy({
  projectName: "support-bot",
  policyId: "UHJvamVjdFRyYWNlUmV0ZW50aW9uUG9saWN5OjI=",
});

// Reset to the default policy
await setProjectRetentionPolicy({
  projectId: "UHJvamVjdDox",
  policyId: null,
});
```

The project is identified the same way as elsewhere in the client — pass
`projectName`, `projectId`, or `project` (a name or GlobalID). Passing
`policyId: null` is how you reset to the default; leaving `policyId` out
entirely is a type error. The call returns the project's resulting assignment.

## Moving Traces Between Projects

`transferTraces` re-parents traces into another project. It is a move, not a
copy — after the call the traces no longer appear in their original project.

```typescript
import { transferTraces } from "@arizeai/phoenix-client/traces";

const result = await transferTraces({
  traceIdentifiers: ["8f3a...", "VHJhY2U6Mg=="],
  destinationProjectIdentifier: "production",
});

console.log(result.transferredTraceCount);
console.log(result.destinationProjectId);
```

`traceIdentifiers` accepts Trace GlobalIDs or raw OpenTelemetry trace IDs, and
every trace in the batch must currently live in the same source project — a
mixed batch fails rather than partially moving. An empty array throws
`RangeError` before any request is made. Requires Phoenix server >= 20.4.0.

## Via HTTP Header (OTEL Collector / config-based tools)

If you cannot set resource attributes in code (e.g. when using an OTEL Collector or another configuration-driven pipeline), set the `x-project-name` HTTP header on OTLP HTTP exports. The header takes precedence over the `openinference.project.name` resource attribute; every span in the request is routed to that project.

```bash
# Via OTEL_EXPORTER_OTLP_HEADERS environment variable
export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:6006"
export OTEL_EXPORTER_OTLP_HEADERS="x-project-name=my-project"
```

```yaml
# OTEL Collector otlphttp exporter
exporters:
  otlphttp:
    endpoint: "http://phoenix:6006"
    headers:
      x-project-name: "my-project"
```

> **Note:** `x-project-name` is only supported by the **HTTP** OTLP endpoint (`/v1/traces`). For gRPC, use the `openinference.project.name` resource attribute instead.
