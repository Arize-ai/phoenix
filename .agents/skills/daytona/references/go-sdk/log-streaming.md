## Contents

- Stream logs with callbacks
- Retrieve all existing logs
- See Also




Log streaming lets you access and process session command logs in real time while a process is still running, or retrieve a snapshot of all logs produced so far. Use streaming for long-running or background commands. Use snapshots when you only need the current output.

For entrypoint log streaming, see [process & code execution](./process-code-execution.md#entrypoint-session). To stream logs while sending input to a running command, see [execute interactive commands](./process-code-execution.md#execute-interactive-commands).

## Stream logs with callbacks

Stream logs in the background while the rest of your system continues executing. Use this for continuous monitoring, debugging long-running jobs, or forwarding logs to other systems.

```go
package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/daytona/clients/sdk-go/pkg/daytona"
)

func main() {
	client, _ := daytona.NewClient()
	ctx := context.Background()
	sandbox, _ := client.Create(ctx, nil)

	sessionID := "streaming-session"
	sandbox.Process.CreateSession(ctx, sessionID)

	// Execute async command that outputs to stdout and stderr
	cmd := `for i in 1 2 3 4 5; do echo "Step $i"; echo "Error $i" >&2; sleep 1; done`
	cmdResult, _ := sandbox.Process.ExecuteSessionCommand(ctx, sessionID, cmd, true, false)
	cmdID, _ := cmdResult["id"].(string)

	// Create channels for stdout and stderr
	stdout := make(chan string, 100)
	stderr := make(chan string, 100)

	// Stream logs in a goroutine
	go func() {
		err := sandbox.Process.GetSessionCommandLogsStream(ctx, sessionID, cmdID, stdout, stderr)
		if err != nil {
			log.Printf("Stream error: %v", err)
		}
	}()

	fmt.Println("Continuing execution while logs are streaming...")

	// Read from channels until both are closed
	stdoutOpen, stderrOpen := true, true
	for stdoutOpen || stderrOpen {
		select {
		case chunk, ok := <-stdout:
			if !ok {
				stdoutOpen = false
			} else {
				fmt.Fprintf(os.Stdout, "[STDOUT]: %s", chunk)
			}
		case chunk, ok := <-stderr:
			if !ok {
				stderrOpen = false
			} else {
				fmt.Fprintf(os.Stderr, "[STDERR]: %s", chunk)
			}
		}
	}

	fmt.Println("Streaming completed!")
	sandbox.Delete(ctx)
}
```

## Retrieve all existing logs

Retrieve all logs produced up to the current point in time. Use this when the command has a predictable duration, or when you prefer to poll for output instead of streaming.

```go
package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/daytona/clients/sdk-go/pkg/daytona"
)

func main() {
	client, _ := daytona.NewClient()
	ctx := context.Background()
	sandbox, _ := client.Create(ctx, nil)

	sessionID := "exec-session-1"
	sandbox.Process.CreateSession(ctx, sessionID)

	// Execute a blocking command and wait for the result
	cmd1, _ := sandbox.Process.ExecuteSessionCommand(ctx, sessionID,
		`echo "Hello from stdout" && echo "Hello from stderr" >&2`, false, false)
	if stdout, ok := cmd1["stdout"].(string); ok {
		fmt.Printf("[STDOUT]: %s\n", stdout)
	}
	if stderr, ok := cmd1["stderr"].(string); ok {
		fmt.Printf("[STDERR]: %s\n", stderr)
	}

	// Or execute command in the background and get the logs later
	cmd := `counter=1; while (( counter <= 5 )); do echo "Count: $counter"; ((counter++)); sleep 1; done`
	cmdResult, _ := sandbox.Process.ExecuteSessionCommand(ctx, sessionID, cmd, true, false)
	cmdID, _ := cmdResult["id"].(string)

	time.Sleep(5 * time.Second)

	// Get the logs up to the current point in time
	logs, err := sandbox.Process.GetSessionCommandLogs(ctx, sessionID, cmdID)
	if err != nil {
		log.Fatalf("Failed to get logs: %v", err)
	}
	fmt.Printf("[STDOUT]: %s\n", logs.Stdout)
	fmt.Printf("[STDERR]: %s\n", logs.Stderr)
	fmt.Printf("[OUTPUT]: %s\n", logs.Output)

	sandbox.Delete(ctx)
}
```

## See Also
- [Python SDK - log-streaming](../python-sdk/log-streaming.md)
- [TypeScript SDK - log-streaming](../typescript-sdk/log-streaming.md)
- [Java SDK - log-streaming](../java-sdk/log-streaming.md)
