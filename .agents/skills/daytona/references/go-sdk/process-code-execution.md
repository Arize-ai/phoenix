## Contents

- Code execution
- Command execution
- Session operations
- Resource management
- Error handling
- See Also




Process and code execution are available through the `process` module of a sandbox. Code and commands run inside the sandbox, so untrusted or generated code executes in isolation from your application.

The `process` module covers running code snippets in Python, JavaScript, and TypeScript, with stateless execution or a persistent interpreter context, executing shell commands, and sessions: independent shells whose state persists across commands and that run long-lived processes in the background. For interactive terminal sessions, see [Pseudo Terminal (PTY)](./pty.md). For real-time log streaming from long-running session commands, see [Log Streaming](./log-streaming.md).

## Code execution

Daytona provides methods to execute code in sandboxes. You can run code snippets in multiple languages with support for both stateless execution and stateful interpretation with persistent contexts.

- [Run code (stateless)](#run-code-stateless): run independent code snippets where each execution starts from a clean interpreter state; inherits the sandbox language that you choose at [sandbox creation](./sandboxes.md#create-sandboxes). Supports Python, JavaScript, and TypeScript.
- [Run code (stateful)](#run-code-stateful): run Python code in a persistent interpreter context with variables, imports, and state to carry across executions; available in every SDK.

### Run code (stateless)

Run code snippets in sandboxes using stateless execution. Each invocation starts from a clean interpreter, making it ideal for independent code snippets.

```go
// Run Python code (language defaults to sandbox language)
result, err := sandbox.Process.CodeRun(ctx, `
def greet(name):
    return f"Hello, {name}!"

print(greet("Daytona"))
`)
if err != nil {
	log.Fatal(err)
}
fmt.Println(result.Result)

// Run code with environment variables
result, err = sandbox.Process.CodeRun(ctx, `import os; print(os.environ.get("FOO"))`,
	options.WithCodeRunParams(types.CodeRunParams{
		Env: map[string]string{"FOO": "BAR"},
	}),
)
if err != nil {
	log.Fatal(err)
}
fmt.Println(result.Result)

// Run code with timeout (5 seconds)
result, err = sandbox.Process.CodeRun(ctx, `import time; time.sleep(2); print("Done")`,
	options.WithCodeRunTimeout(5*time.Second),
)
if err != nil {
	log.Fatal(err)
}
fmt.Println(result.Result)
```

#### Artifacts

Stateless `code_run` responses can include an `artifacts` field. When your code produces matplotlib charts, the SDK strips chart metadata from `result` and returns it in the `artifacts.charts` field.


### Run code (stateful)

Run Python code with persistent state using the code interpreter. You can maintain variables and imports between calls, create isolated contexts with optional working directories, list active contexts, and stream stdout, stderr, and errors via callbacks.

```go
// Shared default context
channels, err := sandbox.CodeInterpreter.RunCode(ctx,
	"counter = 1\nprint(f'Counter initialized at {counter}')",
)
if err != nil {
	log.Fatal(err)
}
for msg := range channels.Stdout {
	fmt.Printf("[STDOUT] %s\n", msg.Text)
}

// Isolated context
cwd := "workspace/src"
ctxInfo, err := sandbox.CodeInterpreter.CreateContext(ctx, &cwd)
if err != nil {
	log.Fatal(err)
}
contextID := ctxInfo["id"].(string)

channels, err = sandbox.CodeInterpreter.RunCode(ctx,
	"value = 'stored in ctx'",
	options.WithCustomContext(contextID),
	options.WithEnv(map[string]string{"DEBUG": "1"}),
)
if err != nil {
	log.Fatal(err)
}
for msg := range channels.Stdout {
	fmt.Printf("[STDOUT] %s\n", msg.Text)
}

// List user-created contexts
contexts, err := sandbox.CodeInterpreter.ListContexts(ctx)
if err != nil {
	log.Fatal(err)
}
for _, context := range contexts {
	fmt.Println(context["id"], context["cwd"])
}

// Clean up context
err = sandbox.CodeInterpreter.DeleteContext(ctx, contextID)
if err != nil {
	log.Fatal(err)
}
```

## Command execution

Daytona provides methods to execute shell commands in sandboxes. You can run commands with working directory, timeout, and environment variable options. The default timeout is 10 seconds when not specified.

Git operations assume you are operating in the sandbox user's home directory (e.g. **`workspace`** implies **`/home/[username]/workspace`**). Use a leading **`/`** when providing absolute paths.

### Execute commands

Execute shell commands in sandboxes by providing the command string and optional parameters for working directory, timeout, and environment variables.

You can also use the `daytona exec` CLI command for quick command execution.

```go
// Execute any shell command
response, err := sandbox.Process.ExecuteCommand(ctx, "ls -la")
if err != nil {
	log.Fatal(err)
}
fmt.Println(response.Result)

// Setting a working directory and a timeout
response, err = sandbox.Process.ExecuteCommand(ctx, "sleep 3",
	options.WithCwd("workspace/src"),
	options.WithExecuteTimeout(5*time.Second),
)
if err != nil {
	log.Fatal(err)
}
fmt.Println(response.Result)

// Passing environment variables
response, err = sandbox.Process.ExecuteCommand(ctx, "echo $CUSTOM_SECRET",
	options.WithCommandEnv(map[string]string{"CUSTOM_SECRET": "DAYTONA"}),
)
if err != nil {
	log.Fatal(err)
}
fmt.Println(response.Result)
```

## Session operations

Daytona provides methods to manage background process sessions in sandboxes. You can create sessions, execute commands, monitor status, and manage long-running processes.

### Get session status

Get session status and list all sessions in a sandbox by providing the session ID.

```go
// Check session's executed commands
session, err := sandbox.Process.GetSession(ctx, sessionID)
if err != nil {
	log.Fatal(err)
}
fmt.Printf("Session %s:\n", sessionID)
commands := session["commands"].([]any)
for _, cmd := range commands {
	cmdMap := cmd.(map[string]any)
	fmt.Printf("Command: %s, Exit Code: %v\n", cmdMap["command"], cmdMap["exitCode"])
}

// List all running sessions
sessions, err := sandbox.Process.ListSessions(ctx)
if err != nil {
	log.Fatal(err)
}
for _, sess := range sessions {
	fmt.Printf("Session: %s, Commands: %v\n", sess["sessionId"], sess["commands"])
}
```

### Get session command

Get the status of a specific command within a session, including its exit code when execution has finished. Use this to poll asynchronous session commands.

```go
command, err := sandbox.Process.GetSessionCommand(ctx, sessionID, commandID)
if err != nil {
	log.Fatal(err)
}
fmt.Printf("Command: %s, Exit Code: %v\n", command["command"], command["exitCode"])
```

### Entrypoint session

Retrieve information about the internal entrypoint session in sandboxes. In each sandbox, the configured entrypoint command is executed inside a dedicated internal session, and you can fetch the session details (including the commands) and read its logs.

```go
// Entrypoint session details
info, err := sandbox.Process.GetEntrypointSession(ctx)
if err != nil {
	log.Fatal(err)
}
fmt.Printf("Entrypoint session: %s\n", info.GetSessionId())
cmds := info.GetCommands()
cmd := cmds[0]
fmt.Printf("Entrypoint command id: %s\n", cmd.GetId())
fmt.Printf("Command: %s\n", cmd.GetCommand())

// Entrypoint logs (HTTP)
logs, err := sandbox.Process.GetEntrypointLogs(ctx)
if err != nil {
	log.Fatal(err)
}
fmt.Println(logs)

// Stream entrypoint logs (WebSocket)
stdout := make(chan string, 100)
stderr := make(chan string, 100)
go func() {
	for msg := range stderr {
		log.Printf("[STDERR]: %s", msg)
	}
}()
go func() {
	if err := sandbox.Process.GetEntrypointLogsStream(ctx, stdout, stderr); err != nil {
		log.Println("Entrypoint log stream error:", err)
	}
}()
for msg := range stdout {
	fmt.Printf("[STDOUT]: %s\n", msg)
}
```

### Execute interactive commands

Execute interactive commands in sessions. You can send input to running commands that expect user interaction, such as confirmations or interactive tools like database CLIs and package managers.

```go
sessionID := "interactive-session"
err := sandbox.Process.CreateSession(ctx, sessionID)
if err != nil {
	log.Fatal(err)
}

// Execute command that requires confirmation
result, err := sandbox.Process.ExecuteSessionCommand(ctx, sessionID, "pip uninstall requests", true, false)
if err != nil {
	log.Fatal(err)
}
cmdID := result["cmdId"].(string)

// Stream logs asynchronously
stdout := make(chan string)
stderr := make(chan string)

go func() {
	err := sandbox.Process.GetSessionCommandLogsStream(ctx, sessionID, cmdID, stdout, stderr)
	if err != nil {
		log.Println("Log stream error:", err)
	}
}()

time.Sleep(1 * time.Second)

// Note: SendSessionCommandInput is not available in Go SDK
// Use the API endpoint directly for sending input

// Read logs
for msg := range stdout {
	fmt.Printf("[STDOUT]: %s\n", msg)
}
```

## Resource management

Use sessions for long-running operations, clean up sessions after execution, and handle exceptions properly.

```go
// Go - Clean up session
sessionID := "long-running-cmd"
err := sandbox.Process.CreateSession(ctx, sessionID)
if err != nil {
	log.Fatal(err)
}
defer sandbox.Process.DeleteSession(ctx, sessionID)

session, err := sandbox.Process.GetSession(ctx, sessionID)
if err != nil {
	log.Fatal(err)
}
// Do work...
```

## Error handling

Handle process exceptions properly, log error details for debugging, and use try-catch blocks for error handling.

```go
result, err := sandbox.Process.CodeRun(ctx, "invalid python code")
if err != nil {
	fmt.Println("Execution failed:", err)
}
if result != nil && result.ExitCode != 0 {
	fmt.Println("Exit code:", result.ExitCode)
	fmt.Println("Error output:", result.Result)
}
```

## See Also
- [Python SDK - process-code-execution](../python-sdk/process-code-execution.md)
- [TypeScript SDK - process-code-execution](../typescript-sdk/process-code-execution.md)
- [Java SDK - process-code-execution](../java-sdk/process-code-execution.md)
