## Contents

- Installation
- Getting Started
- Configuration
- Real-time state updates
- Reference



The Daytona Java SDK provides a robust interface for programmatically interacting with Daytona Sandboxes. It targets Java 11+ and uses OkHttp and Jackson.

## Installation

### Gradle

Add the Daytona SDK dependency to your `build.gradle.kts`:

```kotlin
dependencies {
    implementation("io.daytona:sdk:x.y.z")
}
```

### Maven

Add the Daytona SDK dependency to your `pom.xml`:

```xml
<dependency>
  <groupId>io.daytona</groupId>
  <artifactId>sdk</artifactId>
  <version>x.y.z</version>
</dependency>
```

## Getting Started

### Create a Sandbox

Create a Daytona Sandbox to run your code securely in an isolated environment. The following snippet is an example "Hello World" program that runs securely inside a Daytona Sandbox.

```java
import io.daytona.sdk.Daytona;
import io.daytona.sdk.Sandbox;
import io.daytona.sdk.model.ExecuteResponse;

public class Main {
    public static void main(String[] args) {
        // Initialize the SDK (uses environment variables by default)
        try (Daytona daytona = new Daytona()) {
            // Create a new sandbox
            Sandbox sandbox = daytona.create();

            // Execute a command
            ExecuteResponse response = sandbox.getProcess().executeCommand("echo 'Hello, World!'");
            System.out.println(response.getResult());

            // Clean up
            sandbox.delete();
        }
    }
}
```

## Configuration

The Daytona SDK can be configured using environment variables or by passing a configuration object:

```java
// Using environment variables (DAYTONA_API_KEY, DAYTONA_API_URL, DAYTONA_TARGET)
Daytona daytona = new Daytona();
```

```java
// Using explicit configuration
DaytonaConfig config = new DaytonaConfig.Builder()
    .apiKey("YOUR_API_KEY")
    .apiUrl("YOUR_API_URL")
    .target("us")
    .build();
Daytona daytona = new Daytona(config);
```

For more information on configuring the Daytona SDK, see [API keys](../../SKILL.md#authentication#authentication).

## Real-time state updates

Starting with SDK version **0.198.0**, the SDK streams sandbox state changes over a WebSocket (Socket.IO) connection by default. Sandbox lifecycle operations that wait on a state change (start, stop, pause, resize, snapshot, delete with `wait`) complete as soon as the server pushes the new state, instead of waiting for the next polling interval.

Each `Daytona` client opens a single WebSocket connection shared by all of its sandboxes. A sparse polling safety net runs alongside the event stream, so a missed event never hangs a waiting operation.

The WebSocket handshake carries `source` and `sdkVersion` query parameters, equivalent to the `X-Daytona-Source` and `X-Daytona-SDK-Version` REST headers. The SDK collects no client-side telemetry.

### Polling fallback

If the WebSocket connection cannot be established, for example when a proxy, firewall, or network policy blocks it, the SDK falls back to polling automatically. Connection setup runs in the background and never throws, so no error handling is required.

The WebSocket endpoint derives from the configured API URL, including custom base paths, so reverse proxy deployments such as `https://host/prefix/api` work without additional configuration.

### Opt out of event streaming
> **Caution: Deprecated**
> Polling-only mode is deprecated and will be removed in a future release. Because the SDK falls back to polling automatically, opting out is only needed in environments that prohibit WebSocket connections by policy.

In polling-only mode the SDK never opens a WebSocket connection. Sandbox state is observed exclusively by polling the REST API, with the same cadence as SDK versions before event streaming.

To opt out, set the `DAYTONA_USE_DEPRECATED_POLLING` environment variable:

```bash
export DAYTONA_USE_DEPRECATED_POLLING=true
```

Or set `useDeprecatedPolling` on the configuration builder. The explicit configuration option always takes precedence over the environment variable; the environment variable applies only when the option is unset.

```java
DaytonaConfig config = new DaytonaConfig.Builder()
    .useDeprecatedPolling(true)
    .build();
Daytona daytona = new Daytona(config);
```

See the [`DaytonaConfig` reference](./config.md) for details.

## Reference

The Java SDK reference documents the following modules:

- [CodeInterpreter](./code-interpreter.md)
- [ComputerUse](./computer-use.md)
- [Daytona](./daytona.md)
- [DaytonaConfig](./config.md)
- [Errors](./errors.md)
- [FileSystem](./file-system.md)
- [Git](./git.md)
- [Image](./image.md)
- [LspServer](./lsp-server.md)
- [Process](./process.md)
- [Pty](./pty.md)
- [PtyHandle](./pty-handle.md)
- [Sandbox](./sandbox.md)
- [SecretService](./secret-service.md)
- [SnapshotService](./snapshot.md)
- [VolumeService](./volume-service.md)
