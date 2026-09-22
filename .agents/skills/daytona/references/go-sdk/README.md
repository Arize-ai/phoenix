## Contents

- Installation
- Getting Started
- Configuration
- Real-time state updates
- Reference



The Daytona Go SDK provides a powerful interface for programmatically interacting with Daytona Sandboxes. It requires Go 1.25 or later.

## Installation

Install the Daytona Go SDK using go get:

```bash
go get github.com/daytona/clients/sdk-go
```

## Getting Started

### Create a Sandbox

Create a Daytona Sandbox to run your code securely in an isolated environment. The following snippet is an example "Hello World" program that runs securely inside a Daytona Sandbox.

```go
package main

import (
	"context"
	"fmt"
	"log"

	"github.com/daytona/clients/sdk-go/pkg/daytona"
)

func main() {
	// Initialize the SDK (uses environment variables by default)
	client, err := daytona.NewClient()
	if err != nil {
		log.Fatal(err)
	}

	// Create a new sandbox
	sandbox, err := client.Create(context.Background(), nil)
	if err != nil {
		log.Fatal(err)
	}

	// Execute a command
	response, err := sandbox.Process.ExecuteCommand(context.Background(), "echo 'Hello, World!'")
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(response.Result)
}
```

## Configuration

The Daytona SDK can be configured using environment variables or by passing options to the constructor:

```go
package main

import (
	"github.com/daytona/clients/sdk-go/pkg/daytona"
	"github.com/daytona/clients/sdk-go/pkg/types"
)

func main() {
	// Using environment variables (DAYTONA_API_KEY, DAYTONA_API_URL, DAYTONA_TARGET)
	client, _ := daytona.NewClient()

	// Using explicit configuration
	config := &types.DaytonaConfig{
		APIKey: "YOUR_API_KEY",
		APIUrl: "https://app.daytona.io/api",
		Target: "us",
	}
	client, _ = daytona.NewClientWithConfig(config)
}
```

For more information on configuring the Daytona SDK, see [API keys](../../SKILL.md#authentication#authentication).

## Real-time state updates

Starting with SDK version **0.198.0**, the SDK streams sandbox state changes over a WebSocket (Socket.IO) connection by default. Sandbox lifecycle operations that wait on a state change (start, stop, pause, resize, snapshot, `DeleteAndWait`) complete as soon as the server pushes the new state, instead of waiting for the next polling interval.

Each `Client` opens a single WebSocket connection shared by all of its sandboxes. A sparse polling safety net runs alongside the event stream, so a missed event never hangs a waiting operation.

The WebSocket handshake carries `source` and `sdkVersion` query parameters, equivalent to the `X-Daytona-Source` and `X-Daytona-SDK-Version` REST headers. The SDK collects no client-side telemetry.

### Polling fallback

If the WebSocket connection cannot be established, for example when a proxy, firewall, or network policy blocks it, the SDK falls back to polling automatically. Connection setup runs in the background and never returns an error, so no handling is required.

The WebSocket endpoint derives from the configured API URL, including custom base paths, so reverse proxy deployments such as `https://host/prefix/api` work without additional configuration.

### Opt out of event streaming
> **Caution: Deprecated**
> Polling-only mode is deprecated and will be removed in a future release. Because the SDK falls back to polling automatically, opting out is only needed in environments that prohibit WebSocket connections by policy.

In polling-only mode the SDK never opens a WebSocket connection. Sandbox state is observed exclusively by polling the REST API, with the same cadence as SDK versions before event streaming.

To opt out, set the `DAYTONA_USE_DEPRECATED_POLLING` environment variable:

```bash
export DAYTONA_USE_DEPRECATED_POLLING=true
```

Or set `UseDeprecatedPolling` when initializing the client. The explicit configuration option always takes precedence over the environment variable; the environment variable applies only when the option is unset.

```go
useDeprecatedPolling := true
config := &types.DaytonaConfig{
	UseDeprecatedPolling: &useDeprecatedPolling,
}
client, err := daytona.NewClientWithConfig(config)
```

See the [**`DaytonaConfig`** reference](./types.md#type-daytonaconfig) for details.

## Reference

The Go SDK reference documents the following modules:

- [daytona](./daytona.md)
- [errors](./errors.md)
- [options](./options.md)
- [types](./types.md)
