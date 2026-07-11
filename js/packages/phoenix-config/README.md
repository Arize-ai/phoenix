<h1 align="center" style="border-bottom: none">
    <div>
        <a href="https://phoenix.arize.com/?utm_medium=github&utm_content=header_img&utm_campaign=phoenix-config">
            <picture>
                <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Arize-ai/phoenix-assets/refs/heads/main/logos/Phoenix/phoenix.svg">
                <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Arize-ai/phoenix-assets/refs/heads/main/logos/Phoenix/phoenix-white.svg">
                <img alt="Arize Phoenix logo" src="https://raw.githubusercontent.com/Arize-ai/phoenix-assets/refs/heads/main/logos/Phoenix/phoenix.svg" width="100" />
            </picture>
        </a>
        <br>
        @arizeai/phoenix-config
    </div>
</h1>

<p align="center">
    <a href="https://www.npmjs.com/package/@arizeai/phoenix-config">
        <img src="https://img.shields.io/npm/v/%40arizeai%2Fphoenix-config" alt="NPM Version">
    </a>
    <a href="https://arize-ai.github.io/phoenix/">
        <img src="https://img.shields.io/badge/docs-blue?logo=typescript&logoColor=white" alt="Documentation">
    </a>
</p>

Shared configuration parsing utilities used across `@arizeai/phoenix-otel` and `@arizeai/phoenix-client`. Provides typed helpers for reading Phoenix environment variables.

## Installation

```bash
npm install @arizeai/phoenix-config
```

## Environment Variables

| Variable                     | Constant                         | Description                                                    |
| ---------------------------- | -------------------------------- | -------------------------------------------------------------- |
| `PHOENIX_HOST`               | `ENV_PHOENIX_HOST`               | Phoenix server host URL (e.g. `http://localhost:6006`)         |
| `PHOENIX_API_KEY`            | `ENV_PHOENIX_API_KEY`            | API key for Phoenix authentication                             |
| `PHOENIX_CLIENT_HEADERS`     | `ENV_PHOENIX_CLIENT_HEADERS`     | JSON-encoded custom headers for client requests                |
| `PHOENIX_COLLECTOR_ENDPOINT` | `ENV_PHOENIX_COLLECTOR_ENDPOINT` | OTel collector endpoint URL                                    |
| `PHOENIX_PORT`               | `ENV_PHOENIX_PORT`               | Phoenix HTTP port (integer)                                    |
| `PHOENIX_GRPC_PORT`          | `ENV_PHOENIX_GRPC_PORT`          | Phoenix gRPC port for OpenTelemetry (integer)                  |
| `PHOENIX_PROJECT`            | `ENV_PHOENIX_PROJECT`            | Default project name for project-scoped operations (canonical) |
| `PHOENIX_PROJECT_NAME`       | `ENV_PHOENIX_PROJECT_NAME`       | Supported alias for `PHOENIX_PROJECT`                          |
| `PHOENIX_LOG_LEVEL`          | `ENV_PHOENIX_LOG_LEVEL`          | Log verbosity: `debug`, `info`, `warn`, `error`, or `silent`   |
| `PHOENIX_DISCOVER_CONFIG`    | `ENV_PHOENIX_DISCOVER_CONFIG`    | Set to `false` to disable `.env.phoenix` file discovery        |

## Credential File Discovery (`.env.phoenix`)

When a Phoenix setting is not set in the process environment, the helpers look
for a `.env.phoenix` file in the current working directory — walking up toward
the filesystem root and stopping at the first match — and read
`PHOENIX_`-prefixed keys from it (dotenv format):

Add `.env.phoenix` to your repository's ignore rules before storing credentials
in this file (the Phoenix repository already ignores it).

```bash
# .env.phoenix
PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006
PHOENIX_API_KEY=your-api-key
```

Process environment variables always take precedence — the file never overrides
anything already set — and keys without a `PHOENIX_` prefix are ignored. Related
settings are resolved as groups: when any credential (`PHOENIX_API_KEY`,
`PHOENIX_CLIENT_HEADERS`) is set in the process environment, the file is ignored
for the whole credential group, so process and file credentials are never mixed.
Set `PHOENIX_DISCOVER_CONFIG=false` to disable discovery entirely.

An endpoint from `.env.phoenix` can still be combined with credentials supplied
explicitly or by the process environment. Consumers emit a one-time warning in
that case naming the credential source, endpoint variable, and discovered file;
credential values are never logged. Source-aware consumers should use
`getStrFromEnvironmentWithSource()` and
`getCredentialsFromEnvironmentWithSource()` rather than reconstructing the
source tier themselves.

Discovery results are cached per working directory for the lifetime of the
process (including the absence of a file). Long-running processes that create
the file after the first configuration lookup can call `clearEnvFileCache()` to
re-discover it.

## Usage

### Reading All Configuration

```typescript
import { getEnvironmentConfig } from "@arizeai/phoenix-config";

const config = getEnvironmentConfig();
// Returns a typed object with all recognized Phoenix env vars:
// {
//   PHOENIX_HOST: "http://localhost:6006",
//   PHOENIX_API_KEY: "my-key",
//   PHOENIX_CLIENT_HEADERS: { "X-Custom": "value" },
//   PHOENIX_COLLECTOR_ENDPOINT: "http://localhost:6006",
//   PHOENIX_PORT: 6006,
//   PHOENIX_GRPC_PORT: 4317,
//   PHOENIX_LOG_LEVEL: "info",
//   PHOENIX_PROJECT: "my-project",
// }
```

### Resolving the Project Name

`PHOENIX_PROJECT` is the canonical project-name variable; `PHOENIX_PROJECT_NAME`
is a supported alias. Use `getProjectFromEnvironment()` to resolve the pair with
the correct precedence (`PHOENIX_PROJECT` wins; a one-time warning is emitted if
both are set to conflicting values):

```typescript
import { getProjectFromEnvironment } from "@arizeai/phoenix-config";

const project = getProjectFromEnvironment();
// Reads PHOENIX_PROJECT, then PHOENIX_PROJECT_NAME, or undefined if neither is set
```

### Reading Individual Values

```typescript
import {
  getStrFromEnvironment,
  getIntFromEnvironment,
  getHeadersFromEnvironment,
  ENV_PHOENIX_HOST,
  ENV_PHOENIX_PORT,
  ENV_PHOENIX_CLIENT_HEADERS,
} from "@arizeai/phoenix-config";

// Read a string environment variable
const host = getStrFromEnvironment(ENV_PHOENIX_HOST);
// Returns "http://localhost:6006" or undefined

// Read an integer environment variable
const port = getIntFromEnvironment(ENV_PHOENIX_PORT);
// Returns 6006 or undefined

// Read and parse a JSON-encoded headers object
const headers = getHeadersFromEnvironment(ENV_PHOENIX_CLIENT_HEADERS);
// Returns { "Authorization": "Bearer token" } or undefined
```

### Using Constants

```typescript
import {
  ENV_PHOENIX_HOST,
  ENV_PHOENIX_API_KEY,
  ENV_PHOENIX_CLIENT_HEADERS,
  ENV_PHOENIX_COLLECTOR_ENDPOINT,
  ENV_PHOENIX_PORT,
  ENV_PHOENIX_GRPC_PORT,
  ENV_PHOENIX_PROJECT_NAME,
  ENV_PHOENIX_PROJECT,
  ENV_PHOENIX_LOG_LEVEL,
} from "@arizeai/phoenix-config";

// Use constants instead of raw strings to avoid typos
const apiKey = process.env[ENV_PHOENIX_API_KEY];
```

## Types

```typescript
import type { EnvironmentConfig } from "@arizeai/phoenix-config";
// Inferred return type of getEnvironmentConfig()
```

## Community

Join our community to connect with thousands of AI builders:

- 🌍 Join our [Slack community](https://join.slack.com/t/arize-ai/shared_invite/zt-3r07iavnk-ammtATWSlF0pSrd1DsMW7g).
- 📚 Read the [Phoenix documentation](https://arize.com/docs/phoenix).
- 💡 Ask questions and provide feedback in the _#phoenix-support_ channel.
- 🌟 Leave a star on our [GitHub](https://github.com/Arize-ai/phoenix).
- 🐞 Report bugs with [GitHub Issues](https://github.com/Arize-ai/phoenix/issues).
- 𝕏 Follow us on [𝕏](https://twitter.com/ArizePhoenix).
- 💼 Follow us on [LinkedIn](https://www.linkedin.com/showcase/113218220).
