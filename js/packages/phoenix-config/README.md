# @arizeai/phoenix-config

Shared configuration parsing utilities used by `@arizeai/phoenix-otel` and `@arizeai/phoenix-client`.

## Environment Variables

This package provides centralized access to all Phoenix environment variables:

| Variable                     | Type      | Description                              |
| ---------------------------- | --------- | ---------------------------------------- |
| `PHOENIX_HOST`               | `string`  | Phoenix API endpoint                     |
| `PHOENIX_PORT`               | `number`  | Phoenix HTTP port                        |
| `PHOENIX_GRPC_PORT`          | `number`  | Phoenix gRPC port (for OpenTelemetry)    |
| `PHOENIX_API_KEY`            | `string`  | API key for authentication               |
| `PHOENIX_CLIENT_HEADERS`     | `JSON`    | Custom headers as JSON-encoded object    |
| `PHOENIX_COLLECTOR_ENDPOINT` | `string`  | Collector endpoint for tracing           |
| `PHOENIX_PROJECT`            | `string`  | Default project for project-scoped tools |
| `PHOENIX_LOG_LEVEL`          | `string`  | Log level (debug, info, warn, error)     |

## Usage

```ts
import {
  getEnvironmentConfig,
  getStrFromEnvironment,
  getIntFromEnvironment,
  getHeadersFromEnvironment,
  ENV_PHOENIX_HOST,
  ENV_PHOENIX_API_KEY,
} from "@arizeai/phoenix-config";

// Get all Phoenix config from environment at once
const config = getEnvironmentConfig();
// { PHOENIX_HOST: "http://localhost:6006", PHOENIX_API_KEY: "...", ... }

// Or read individual values
const host = getStrFromEnvironment(ENV_PHOENIX_HOST);
const headers = getHeadersFromEnvironment("PHOENIX_CLIENT_HEADERS");
```
