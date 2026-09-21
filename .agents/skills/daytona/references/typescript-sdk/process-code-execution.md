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

```typescript
// Run TypeScript code
let response = await sandbox.process.codeRun(`
function greet(name: string): string {
    return \`Hello, \${name}!\`;
}

console.log(greet("Daytona"));
`);
console.log(response.result);

// Run code with argv and environment variables
response = await sandbox.process.codeRun(
    `
    console.log(\`Hello, \${process.argv[2]}!\`);
    console.log(\`FOO: \${process.env.FOO}\`);
    `,
    {
      argv: ["Daytona"],
      env: { FOO: "BAR" }
    }
);
console.log(response.result);

// Run code with timeout (5 seconds)
response = await sandbox.process.codeRun(
    'setTimeout(() => console.log("Done"), 2000);',
    undefined,
    5
);
console.log(response.result);
```

#### Artifacts

Stateless `code_run` responses can include an `artifacts` field. When your code produces matplotlib charts, the SDK strips chart metadata from `result` and returns it in the `artifacts.charts` field.

```typescript
const response = await sandbox.process.codeRun(`
import matplotlib.pyplot as plt
import numpy as np

x = np.linspace(0, 10, 30)
plt.plot(x, np.sin(x))
plt.title("Sine wave")
plt.show()
`)

if (response.artifacts?.charts?.length) {
    const chart = response.artifacts.charts[0]
    console.log(chart.type, chart.title)
}
```

### Run code (stateful)

Run Python code with persistent state using the code interpreter. You can maintain variables and imports between calls, create isolated contexts with optional working directories, list active contexts, and stream stdout, stderr, and errors via callbacks.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()

async function main() {
    const sandbox = await daytona.create()

    // Shared default context
    await sandbox.codeInterpreter.runCode(
`
counter = 1
print(f'Counter initialized at {counter}')
`,
        {
            onStdout: (msg) => process.stdout.write(`[STDOUT] ${msg.output}`),
            onStderr: (msg) => process.stdout.write(`[STDERR] ${msg.output}`),
            timeout: 60,
        },
    )

    // Isolated context with working directory
    const ctx = await sandbox.codeInterpreter.createContext('workspace/src')
    try {
        await sandbox.codeInterpreter.runCode(
            `value = 'stored in ctx'`,
            { context: ctx, envs: { DEBUG: '1' } },
        )
        await sandbox.codeInterpreter.runCode(
            `print(value)`,
            { context: ctx, onStdout: (msg) => process.stdout.write(`[STDOUT] ${msg.output}`) },
        )
    } finally {
        await sandbox.codeInterpreter.deleteContext(ctx)
    }

    // List user-created contexts
    const contexts = await sandbox.codeInterpreter.listContexts()
    for (const context of contexts) {
        console.log(context.id, context.cwd)
    }
}

main()
```

## Command execution

Daytona provides methods to execute shell commands in sandboxes. You can run commands with working directory, timeout, and environment variable options. The default timeout is 10 seconds when not specified.

Git operations assume you are operating in the sandbox user's home directory (e.g. **`workspace`** implies **`/home/[username]/workspace`**). Use a leading **`/`** when providing absolute paths.

### Execute commands

Execute shell commands in sandboxes by providing the command string and optional parameters for working directory, timeout, and environment variables.

You can also use the `daytona exec` CLI command for quick command execution.

```typescript

// Execute any shell command
const response = await sandbox.process.executeCommand("ls -la");
console.log(response.result);

// Setting a working directory and a timeout
const response2 = await sandbox.process.executeCommand("sleep 3", "workspace/src", undefined, 5);
console.log(response2.result);

// Passing environment variables
const response3 = await sandbox.process.executeCommand("echo $CUSTOM_SECRET", ".", {
        "CUSTOM_SECRET": "DAYTONA"
    }
);
console.log(response3.result);
```

## Session operations

Daytona provides methods to manage background process sessions in sandboxes. You can create sessions, execute commands, monitor status, and manage long-running processes.

### Get session status

Get session status and list all sessions in a sandbox by providing the session ID.

```typescript
// Check session's executed commands
const session = await sandbox.process.getSession(sessionId);
console.log(`Session ${sessionId}:`);
for (const command of session.commands) {
    console.log(`Command: ${command.command}, Exit Code: ${command.exitCode}`);
}

// List all running sessions
const sessions = await sandbox.process.listSessions();
for (const session of sessions) {
    console.log(`Session: ${session.sessionId}, Commands: ${session.commands}`);
}
```

### Get session command

Get the status of a specific command within a session, including its exit code when execution has finished. Use this to poll asynchronous session commands.

```typescript
const command = await sandbox.process.getSessionCommand(sessionId, commandId);
console.log(`Command: ${command.command}, Exit Code: ${command.exitCode}`);
```

### Entrypoint session

Retrieve information about the internal entrypoint session in sandboxes. In each sandbox, the configured entrypoint command is executed inside a dedicated internal session, and you can fetch the session details (including the commands) and read its logs.

```typescript
// Entrypoint session details
const session = await sandbox.process.getEntrypointSession();
console.log(`Entrypoint session: ${session.sessionId}`);
const cmd = session.commands[0]
console.log(`Entrypoint command id: ${cmd.id}`);
console.log(`Command: ${cmd.command}`);

// Entrypoint logs (HTTP)
const logs = await sandbox.process.getEntrypointLogs();
console.log('[STDOUT]:', logs.stdout);
console.log('[STDERR]:', logs.stderr);

// Stream entrypoint logs (WebSocket)
await sandbox.process.getEntrypointLogs(
    (chunk) => console.log('[STDOUT]:', chunk),
    (chunk) => console.log('[STDERR]:', chunk),
);
```

### Execute interactive commands

Execute interactive commands in sessions. You can send input to running commands that expect user interaction, such as confirmations or interactive tools like database CLIs and package managers.

```typescript
const sessionId = 'interactive-session'
await sandbox.process.createSession(sessionId)

// Execute command that requires confirmation
const command = await sandbox.process.executeSessionCommand(sessionId, {
    command: 'pip uninstall requests',
    runAsync: true,
})

// Stream logs asynchronously
const logPromise = sandbox.process.getSessionCommandLogs(
    sessionId,
    command.cmdId!,
    (stdout) => console.log('[STDOUT]:', stdout),
    (stderr) => console.log('[STDERR]:', stderr),
)

await new Promise((resolve) => setTimeout(resolve, 1000))
// Send input to the command
await sandbox.process.sendSessionCommandInput(sessionId, command.cmdId!, 'y')

// Wait for logs to complete
await logPromise
```

## Resource management

Use sessions for long-running operations, clean up sessions after execution, and handle exceptions properly.

```typescript
// TypeScript - Clean up session
const sessionId = "long-running-cmd";
try {
    await sandbox.process.createSession(sessionId);
    const session = await sandbox.process.getSession(sessionId);
    // Do work...
} finally {
    await sandbox.process.deleteSession(session.sessionId);
}
```

## Error handling

Handle process exceptions properly, log error details for debugging, and use try-catch blocks for error handling.

```typescript
import { DaytonaError } from '@daytona/sdk'

try {
    const response = await sandbox.process.codeRun("invalid typescript code");
    if (response.exitCode !== 0) {
        console.error("Exit code:", response.exitCode);
        console.error("Error output:", response.result);
    }
} catch (e) {
    if (e instanceof DaytonaError) {
        console.error("Execution failed:", e);
    }
}
```

## See Also
- [Python SDK - process-code-execution](../python-sdk/process-code-execution.md)
