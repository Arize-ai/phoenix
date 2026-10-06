## Contents

- Code execution
- Command execution
- Session operations
- Resource management
- Error handling




Process and code execution are available through the `process` module of a sandbox. Code and commands run inside the sandbox, so untrusted or generated code executes in isolation from your application.

The `process` module covers running code snippets in Python, JavaScript, and TypeScript, with stateless execution or a persistent interpreter context, executing shell commands, and sessions: independent shells whose state persists across commands and that run long-lived processes in the background. For interactive terminal sessions, see [Pseudo Terminal (PTY)](./pty.md). For real-time log streaming from long-running session commands, see [Log Streaming](./log-streaming.md).

## Code execution

Daytona provides methods to execute code in sandboxes. You can run code snippets in multiple languages with support for both stateless execution and stateful interpretation with persistent contexts.

- [Run code (stateless)](#run-code-stateless): run independent code snippets where each execution starts from a clean interpreter state; inherits the sandbox language that you choose at [sandbox creation](./sandboxes.md#create-sandboxes). Supports Python, JavaScript, and TypeScript.
- [Run code (stateful)](#run-code-stateful): run Python code in a persistent interpreter context with variables, imports, and state to carry across executions; available in every SDK.

### Run code (stateless)

Run code snippets in sandboxes using stateless execution. Each invocation starts from a clean interpreter, making it ideal for independent code snippets.

```python
from daytona import CodeRunParams

# Run Python code
response = sandbox.process.code_run('''
def greet(name):
    return f"Hello, {name}!"

print(greet("Daytona"))
''')

print(response.result)

# Run code with argv and environment variables
response = sandbox.process.code_run(
    'import sys; print(f"Hello, {sys.argv[1]}!")',
    params=CodeRunParams(argv=["Daytona"], env={"FOO": "BAR"}),
    timeout=5,
)
print(response.result)
```

#### Artifacts

Stateless `code_run` responses can include an `artifacts` field. When your code produces matplotlib charts, the SDK strips chart metadata from `result` and returns it in the `artifacts.charts` field.

```python
code = '''
import matplotlib.pyplot as plt
import numpy as np

x = np.linspace(0, 10, 30)
plt.plot(x, np.sin(x))
plt.title("Sine wave")
plt.show()
'''

response = sandbox.process.code_run(code)
if response.artifacts and response.artifacts.charts:
    chart = response.artifacts.charts[0]
    print(chart.type, chart.title)
```

### Run code (stateful)

Run Python code with persistent state using the code interpreter. You can maintain variables and imports between calls, create isolated contexts with optional working directories, list active contexts, and stream stdout, stderr, and errors via callbacks.

```python
from daytona import Daytona, OutputMessage, ExecutionError

def handle_stdout(message: OutputMessage):
    print(f"[STDOUT] {message.output}")

def handle_stderr(message: OutputMessage):
    print(f"[STDERR] {message.output}")

def handle_error(error: ExecutionError):
    print(f"[ERROR] {error.name}: {error.value}")

daytona = Daytona()
sandbox = daytona.create()

# Shared default context
sandbox.code_interpreter.run_code(
    "counter = 1\nprint(f'Counter initialized at {counter}')",
    on_stdout=handle_stdout,
    on_stderr=handle_stderr,
    on_error=handle_error,
    timeout=60,
)

# Isolated context with working directory
ctx = sandbox.code_interpreter.create_context(cwd="workspace/src")
try:
    sandbox.code_interpreter.run_code(
        "value = 'stored in ctx'",
        context=ctx,
        envs={"DEBUG": "1"},
    )
    sandbox.code_interpreter.run_code(
        "print(value)",
        context=ctx,
        on_stdout=handle_stdout,
    )
finally:
    sandbox.code_interpreter.delete_context(ctx)

# List user-created contexts
for context in sandbox.code_interpreter.list_contexts():
    print(context.id, context.cwd)
```

## Command execution

Daytona provides methods to execute shell commands in sandboxes. You can run commands with working directory, timeout, and environment variable options. The default timeout is 10 seconds when not specified.

Git operations assume you are operating in the sandbox user's home directory (e.g. **`workspace`** implies **`/home/[username]/workspace`**). Use a leading **`/`** when providing absolute paths.

### Execute commands

Execute shell commands in sandboxes by providing the command string and optional parameters for working directory, timeout, and environment variables.

You can also use the `daytona exec` CLI command for quick command execution.

```python
# Execute any shell command
response = sandbox.process.exec("ls -la")
print(response.result)

# Setting a working directory and a timeout

response = sandbox.process.exec("sleep 3", cwd="workspace/src", timeout=5)
print(response.result)

# Passing environment variables

response = sandbox.process.exec("echo $CUSTOM_SECRET", env={
        "CUSTOM_SECRET": "DAYTONA"
    }
)
print(response.result)
```

## Session operations

Daytona provides methods to manage background process sessions in sandboxes. You can create sessions, execute commands, monitor status, and manage long-running processes.

### Get session status

Get session status and list all sessions in a sandbox by providing the session ID.

```python
# Check session's executed commands
session = sandbox.process.get_session(session_id)
print(f"Session {session_id}:")
for command in session.commands:
    print(f"Command: {command.command}, Exit Code: {command.exit_code}")

# List all running sessions

sessions = sandbox.process.list_sessions()
for session in sessions:
    print(f"Session: {session.session_id}, Commands: {session.commands}")
```

### Get session command

Get the status of a specific command within a session, including its exit code when execution has finished. Use this to poll asynchronous session commands.

```python
command = sandbox.process.get_session_command(session_id, command_id)
print(f"Command: {command.command}, Exit Code: {command.exit_code}")
```

### Entrypoint session

Retrieve information about the internal entrypoint session in sandboxes. In each sandbox, the configured entrypoint command is executed inside a dedicated internal session, and you can fetch the session details (including the commands) and read its logs.

```python
# Entrypoint session details
session = sandbox.process.get_entrypoint_session()
print(f"Entrypoint session: {session.session_id}")
cmd = session.commands[0]
print(f"Entrypoint command id: {cmd.id}")
print(f"Command: {cmd.command}")

# Entrypoint logs (HTTP)
logs = sandbox.process.get_entrypoint_logs()
print(f"[STDOUT]: {logs.stdout}")
print(f"[STDERR]: {logs.stderr}")

# Stream entrypoint logs (WebSocket)
async def stream_entrypoint_logs():
    await sandbox.process.get_entrypoint_logs_async(
        lambda log: print(f"[STDOUT]: {log}"),
        lambda log: print(f"[STDERR]: {log}"),
    )

# Use asyncio.run in scripts; in notebooks or async apps, await stream_entrypoint_logs() instead.
asyncio.run(stream_entrypoint_logs())
```

### Execute interactive commands

Execute interactive commands in sessions. You can send input to running commands that expect user interaction, such as confirmations or interactive tools like database CLIs and package managers.

```python
import asyncio
from daytona import SessionExecuteRequest

session_id = "interactive-session"
sandbox.process.create_session(session_id)

# Execute command that requires confirmation
command = sandbox.process.execute_session_command(
    session_id,
    SessionExecuteRequest(
        command='pip uninstall requests',
        run_async=True,
    ),
)

# Stream logs asynchronously
logs_task = asyncio.create_task(
    sandbox.process.get_session_command_logs_async(
        session_id,
        command.cmd_id,
        lambda log: print(f"[STDOUT]: {log}"),
        lambda log: print(f"[STDERR]: {log}"),
    )
)

await asyncio.sleep(1)
# Send input to the command
sandbox.process.send_session_command_input(session_id, command.cmd_id, "y")

# Wait for logs to complete
await logs_task
```

## Resource management

Use sessions for long-running operations, clean up sessions after execution, and handle exceptions properly.

```python
# Python - Clean up session
session_id = "long-running-cmd"
try:
    sandbox.process.create_session(session_id)
    session = sandbox.process.get_session(session_id)
    # Do work...
finally:
    sandbox.process.delete_session(session.session_id)
```

## Error handling

Handle process exceptions properly, log error details for debugging, and use try-catch blocks for error handling.

```python
from daytona import DaytonaError

try:
    response = sandbox.process.code_run("invalid python code")
    if response.exit_code != 0:
        print(f"Exit code: {response.exit_code}")
        print(f"Error output: {response.result}")
except DaytonaError as e:
    print(f"Execution failed: {e}")
```
