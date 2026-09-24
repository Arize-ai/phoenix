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

```java
import io.daytona.sdk.model.ExecuteResponse;
import java.util.Map;

// Run code (stateless; language matches the sandbox image)
ExecuteResponse response = sandbox.process.codeRun(
    """
    def greet(name):
        return f"Hello, {name}!"

    print(greet("Daytona"))
    """
);
System.out.println(response.getResult());

// Run code with environment variables and timeout (seconds)
response = sandbox.process.codeRun(
    "import os; print('FOO:', os.environ.get('FOO'))",
    Map.of("FOO", "BAR"),
    null
);
System.out.println(response.getResult());

response = sandbox.process.codeRun(
    "import time; time.sleep(2); print(\"Done\")",
    null,
    5
);
System.out.println(response.getResult());
```

#### Artifacts

Stateless `code_run` responses can include an `artifacts` field. When your code produces matplotlib charts, the SDK strips chart metadata from `result` and returns it in the `artifacts.charts` field.


### Run code (stateful)

Run Python code with persistent state using the code interpreter. You can maintain variables and imports between calls, create isolated contexts with optional working directories, list active contexts, and stream stdout, stderr, and errors via callbacks.

```java
import io.daytona.sdk.RunCodeOptions;
import io.daytona.toolbox.client.model.InterpreterContext;

// Default interpreter context (Python)
sandbox.codeInterpreter.runCode(
    """
    counter = 1
    print(f'Counter initialized at {counter}')
    """,
    new RunCodeOptions()
        .setOnStdout(chunk -> System.out.print("[STDOUT] " + chunk))
        .setOnStderr(chunk -> System.out.print("[STDERR] " + chunk))
        .setTimeout(60)
);

// Context management
InterpreterContext ctx = sandbox.codeInterpreter.createContext("workspace/src");
sandbox.codeInterpreter.deleteContext(ctx.getId());

for (InterpreterContext context : sandbox.codeInterpreter.listContexts()) {
    System.out.println(context.getId() + " " + context.getCwd());
}
```

## Command execution

Daytona provides methods to execute shell commands in sandboxes. You can run commands with working directory, timeout, and environment variable options. The default timeout is 10 seconds when not specified.

Git operations assume you are operating in the sandbox user's home directory (e.g. **`workspace`** implies **`/home/[username]/workspace`**). Use a leading **`/`** when providing absolute paths.

### Execute commands

Execute shell commands in sandboxes by providing the command string and optional parameters for working directory, timeout, and environment variables.

You can also use the `daytona exec` CLI command for quick command execution.

```java
import io.daytona.sdk.model.ExecuteResponse;
import java.util.Map;

// Execute any shell command
ExecuteResponse response = sandbox.process.executeCommand("ls -la");
System.out.println(response.getResult());

// Working directory and timeout (seconds)
response = sandbox.process.executeCommand("sleep 3", "workspace/src", null, 5);
System.out.println(response.getResult());

// Environment variables
response = sandbox.process.executeCommand(
    "echo $CUSTOM_SECRET",
    ".",
    Map.of("CUSTOM_SECRET", "DAYTONA"),
    null
);
System.out.println(response.getResult());
```

## Session operations

Daytona provides methods to manage background process sessions in sandboxes. You can create sessions, execute commands, monitor status, and manage long-running processes.

### Get session status

Get session status and list all sessions in a sandbox by providing the session ID.

```java
import io.daytona.sdk.model.Command;
import io.daytona.sdk.model.Session;

// Check session's executed commands
Session session = sandbox.process.getSession(sessionId);
System.out.println("Session " + sessionId + ":");
for (Command command : session.getCommands()) {
    System.out.println("Command: " + command.getCommand() + ", Exit Code: " + command.getExitCode());
}

// List all running sessions
for (Session s : sandbox.process.listSessions()) {
    System.out.println("Session: " + s.getSessionId() + ", Commands: " + s.getCommands());
}
```

### Get session command

Get the status of a specific command within a session, including its exit code when execution has finished. Use this to poll asynchronous session commands.

```java
import io.daytona.sdk.model.Command;

Command command = sandbox.process.getSessionCommand(sessionId, commandId);
System.out.println("Command: " + command.getCommand() + ", Exit Code: " + command.getExitCode());
```

### Entrypoint session

Retrieve information about the internal entrypoint session in sandboxes. In each sandbox, the configured entrypoint command is executed inside a dedicated internal session, and you can fetch the session details (including the commands) and read its logs.

```java
import io.daytona.sdk.model.Command;
import io.daytona.sdk.model.Session;
import io.daytona.sdk.model.SessionCommandLogsResponse;

// Entrypoint session details
Session session = sandbox.process.getEntrypointSession();
System.out.println("Entrypoint session: " + session.getSessionId());
Command cmd = session.getCommands().get(0);
System.out.println("Entrypoint command id: " + cmd.getId());
System.out.println("Command: " + cmd.getCommand());

// Entrypoint logs (HTTP)
SessionCommandLogsResponse logs = sandbox.process.getEntrypointLogs();
System.out.println("[STDOUT]: " + logs.getStdout());
System.out.println("[STDERR]: " + logs.getStderr());

// Stream entrypoint logs (WebSocket)
sandbox.process.getEntrypointLogs(
    chunk -> System.out.println("[STDOUT]: " + chunk),
    chunk -> System.out.println("[STDERR]: " + chunk)
);
```

### Execute interactive commands

Execute interactive commands in sessions. You can send input to running commands that expect user interaction, such as confirmations or interactive tools like database CLIs and package managers.

```java
import io.daytona.sdk.model.SessionExecuteRequest;
import io.daytona.sdk.model.SessionExecuteResponse;

String sessionId = "interactive-session";
sandbox.process.createSession(sessionId);

SessionExecuteResponse command = sandbox.process.executeSessionCommand(
    sessionId,
    new SessionExecuteRequest("pip uninstall requests", true)
);
String cmdId = command.getCmdId();

Thread logThread = new Thread(() -> sandbox.process.getSessionCommandLogs(
    sessionId,
    cmdId,
    log -> System.out.println("[STDOUT]: " + log),
    log -> System.out.println("[STDERR]: " + log)
));
logThread.start();

Thread.sleep(1000);
sandbox.process.sendSessionCommandInput(sessionId, cmdId, "y");
logThread.join();
```

## Resource management

Use sessions for long-running operations, clean up sessions after execution, and handle exceptions properly.

```java
import io.daytona.sdk.model.Session;

// Clean up session
String sessionId = "long-running-cmd";
try {
    sandbox.process.createSession(sessionId);
    Session session = sandbox.process.getSession(sessionId);
    // Do work...
} finally {
    sandbox.process.deleteSession(sessionId);
}
```

## Error handling

Handle process exceptions properly, log error details for debugging, and use try-catch blocks for error handling.

```java
import io.daytona.sdk.exception.DaytonaException;
import io.daytona.sdk.model.ExecuteResponse;

try {
    ExecuteResponse response = sandbox.process.codeRun("invalid python code");
    if (response.getExitCode() != null && response.getExitCode() != 0) {
        System.out.println("Exit code: " + response.getExitCode());
        System.out.println("Error output: " + response.getResult());
    }
} catch (DaytonaException e) {
    System.out.println("Execution failed: " + e.getMessage());
}
```

## See Also
- [Python SDK - process-code-execution](../python-sdk/process-code-execution.md)
- [TypeScript SDK - process-code-execution](../typescript-sdk/process-code-execution.md)
