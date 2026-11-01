## Contents

- Installation
- Getting Started
- Configuration
- Real-time state updates
- Environment Variables
- Reference



The Daytona Ruby SDK provides a robust interface for programmatically interacting with Daytona Sandboxes.

## Installation

Install the Daytona Ruby SDK using Bundler by adding it to your Gemfile:

```ruby
gem 'daytona'
```

Then run:

```bash
bundle install
```

Or install it directly:

```bash
gem install daytona
```

## Getting Started

Here's a simple example to help you get started with the Daytona Ruby SDK:

```ruby
require 'daytona'

# Initialize the SDK (uses environment variables by default)
daytona = Daytona::Daytona.new

# Create a new sandbox
sandbox = daytona.create

# Execute a command
response = sandbox.process.exec(command: "echo 'Hello, World!'")
puts response.result

# Clean up
daytona.delete(sandbox)
```

## Configuration

The SDK can be configured using environment variables or by passing options to the constructor:

```ruby
require 'daytona'

# Using environment variables (DAYTONA_API_KEY, DAYTONA_API_URL, DAYTONA_TARGET)
daytona = Daytona::Daytona.new

# Using explicit configuration
config = Daytona::Config.new(
  api_key: 'your-api-key',
  api_url: 'https://app.daytona.io/api',
  target: 'us'
)
daytona = Daytona::Daytona.new(config)
```

## Real-time state updates

Starting with SDK version **0.198.0**, the SDK streams sandbox state changes over a WebSocket (Socket.IO) connection by default. Sandbox lifecycle operations that wait on a state change (start, stop, pause, resize, snapshot, delete with `wait`) complete as soon as the server pushes the new state, instead of waiting for the next polling interval.

Each `Daytona::Daytona` client opens a single WebSocket connection shared by all of its sandboxes. A sparse polling safety net runs alongside the event stream, so a missed event never hangs a waiting operation.

The WebSocket handshake carries `source` and `sdkVersion` query parameters, equivalent to the `X-Daytona-Source` and `X-Daytona-SDK-Version` REST headers. The SDK collects no client-side telemetry.

### Polling fallback

If the WebSocket connection cannot be established, for example when a proxy, firewall, or network policy blocks it, the SDK falls back to polling automatically. Connection setup runs in the background and never raises an error, so no handling is required.

The WebSocket endpoint derives from the configured API URL, including custom base paths, so reverse proxy deployments such as `https://host/prefix/api` work without additional configuration.

### Opt out of event streaming
> **Caution: Deprecated**
> Polling-only mode is deprecated and will be removed in a future release. Because the SDK falls back to polling automatically, opting out is only needed in environments that prohibit WebSocket connections by policy.

In polling-only mode the SDK never opens a WebSocket connection. Sandbox state is observed exclusively by polling the REST API, with the same cadence as SDK versions before event streaming.

To opt out, set the `DAYTONA_USE_DEPRECATED_POLLING` environment variable:

```bash
export DAYTONA_USE_DEPRECATED_POLLING=true
```

Or pass `use_deprecated_polling` when initializing the client. The explicit configuration option always takes precedence over the environment variable; the environment variable applies only when the option is unset.

```ruby
require 'daytona'

config = Daytona::Config.new(use_deprecated_polling: true)
daytona = Daytona::Daytona.new(config)
```

See the [`Config` reference](./config.md) for details.

## Environment Variables

The SDK supports the following environment variables:

| Variable | Description |
|----------|-------------|
| `DAYTONA_API_KEY` | API key for authentication |
| `DAYTONA_API_URL` | URL of the Daytona API (defaults to `https://app.daytona.io/api`) |
| `DAYTONA_TARGET` | Target location for Sandboxes |
| `DAYTONA_JWT_TOKEN` | JWT token for authentication (alternative to API key) |
| `DAYTONA_ORGANIZATION_ID` | Organization ID (required when using JWT token) |

## Reference

The Ruby SDK reference documents the following modules:

- [Chart](./charts.md)
- [ComputerUse](./computer-use.md)
- [Config](./config.md)
- [Daytona](./daytona.md)
- [FileSystem](./file-system.md)
- [Git](./git.md)
- [Image](./image.md)
- [LspServer](./lsp-server.md)
- [ObjectStorage](./object-storage.md)
- [Process](./process.md)
- [Sandbox](./sandbox.md)
- [Secret](./secret.md)
- [SecretService](./secret-service.md)
- [SnapshotService](./snapshot.md)
- [Volume](./volume.md)
- [VolumeService](./volume-service.md)
