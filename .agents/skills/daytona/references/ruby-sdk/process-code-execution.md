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

```ruby
# Run Python code
response = sandbox.process.code_run(code: <<~PYTHON)
  def greet(name):
      return f"Hello, {name}!"

  print(greet("Daytona"))
PYTHON

puts response.result
```

#### Artifacts

Stateless `code_run` responses can include an `artifacts` field. When your code produces matplotlib charts, the SDK strips chart metadata from `result` and returns it in the `artifacts.charts` field.


### Run code (stateful)

Run Python code with persistent state using the code interpreter. You can maintain variables and imports between calls, create isolated contexts with optional working directories, list active contexts, and stream stdout, stderr, and errors via callbacks.

```ruby
require 'daytona'

daytona = Daytona::Daytona.new
sandbox = daytona.create

# Shared default context
sandbox.code_interpreter.run_code(
  <<~PYTHON,
  counter = 1
  print(f'Counter initialized at {counter}')
  PYTHON
  on_stdout: ->(msg) { print "[STDOUT] #{msg.output}" }
)

# Isolated context
ctx = sandbox.code_interpreter.create_context
begin
  sandbox.code_interpreter.run_code("value = 'stored in ctx'", context: ctx)
  sandbox.code_interpreter.run_code(
    "print(value)",
    context: ctx,
    on_stdout: ->(msg) { print "[STDOUT] #{msg.output}" }
  )
ensure
  sandbox.code_interpreter.delete_context(ctx)
end
```

## Command execution

Daytona provides methods to execute shell commands in sandboxes. You can run commands with working directory, timeout, and environment variable options. The default timeout is 10 seconds when not specified.

Git operations assume you are operating in the sandbox user's home directory (e.g. **`workspace`** implies **`/home/[username]/workspace`**). Use a leading **`/`** when providing absolute paths.

### Execute commands

Execute shell commands in sandboxes by providing the command string and optional parameters for working directory, timeout, and environment variables.

You can also use the `daytona exec` CLI command for quick command execution.

```ruby
# Execute any shell command
response = sandbox.process.exec(command: 'ls -la')
puts response.result

# Setting a working directory and a timeout
response = sandbox.process.exec(command: 'sleep 3', cwd: 'workspace/src', timeout: 5)
puts response.result

# Passing environment variables
response = sandbox.process.exec(
  command: 'echo $CUSTOM_SECRET',
  env: { 'CUSTOM_SECRET' => 'DAYTONA' }
)
puts response.result
```

## Session operations

Daytona provides methods to manage background process sessions in sandboxes. You can create sessions, execute commands, monitor status, and manage long-running processes.

### Get session status

Get session status and list all sessions in a sandbox by providing the session ID.

```ruby
# Check session's executed commands
session = sandbox.process.get_session(session_id)
puts "Session #{session_id}:"
session.commands.each do |command|
  puts "Command: #{command.command}, Exit Code: #{command.exit_code}"
end

# List all running sessions
sessions = sandbox.process.list_sessions
sessions.each do |session|
  puts "Session: #{session.session_id}, Commands: #{session.commands}"
end
```

### Get session command

Get the status of a specific command within a session, including its exit code when execution has finished. Use this to poll asynchronous session commands.

```ruby
command = sandbox.process.get_session_command(session_id: session_id, command_id: command_id)
puts "Command: #{command.command}, Exit Code: #{command.exit_code}"
```

### Entrypoint session

Retrieve information about the internal entrypoint session in sandboxes. In each sandbox, the configured entrypoint command is executed inside a dedicated internal session, and you can fetch the session details (including the commands) and read its logs.

```ruby
# Entrypoint session details
session = sandbox.process.get_entrypoint_session
puts "Entrypoint session: #{session.session_id}"
cmd = session.commands.first
puts "Entrypoint command id: #{cmd.id}"
puts "Command: #{cmd.command}"

# Entrypoint logs (HTTP)
logs = sandbox.process.get_entrypoint_logs
puts "[STDOUT]: #{logs.stdout}"
puts "[STDERR]: #{logs.stderr}"

# Stream entrypoint logs (WebSocket)
sandbox.process.get_entrypoint_logs_async(
  on_stdout: ->(log) { puts "[STDOUT]: #{log}" },
  on_stderr: ->(log) { puts "[STDERR]: #{log}" }
)
```

### Execute interactive commands

Execute interactive commands in sessions. You can send input to running commands that expect user interaction, such as confirmations or interactive tools like database CLIs and package managers.

```ruby
session_id = "interactive-session"
sandbox.process.create_session(session_id)

# Execute command that requires confirmation
interactive_command = sandbox.process.execute_session_command(
  session_id: session_id,
  req: Daytona::SessionExecuteRequest.new(
    command: 'pip uninstall requests',
    run_async: true
  )
)

# Wait a moment for the command to start
sleep 1

# Send input to the command
sandbox.process.send_session_command_input(
  session_id: session_id,
  command_id: interactive_command.cmd_id,
  data: "y"
)

# Get logs for the interactive command asynchronously
sandbox.process.get_session_command_logs_async(
  session_id: session_id,
  command_id: interactive_command.cmd_id,
  on_stdout: ->(log) { puts "[STDOUT]: #{log}" },
  on_stderr: ->(log) { puts "[STDERR]: #{log}" }
)
```

## Resource management

Use sessions for long-running operations, clean up sessions after execution, and handle exceptions properly.

```ruby
# Ruby - Clean up session
session_id = 'long-running-cmd'
begin
  sandbox.process.create_session(session_id)
  session = sandbox.process.get_session(session_id)
  # Do work...
ensure
  sandbox.process.delete_session(session.session_id)
end
```

## Error handling

Handle process exceptions properly, log error details for debugging, and use try-catch blocks for error handling.

```ruby
begin
  response = sandbox.process.code_run(code: 'invalid python code')
  if response.exit_code != 0
    puts "Exit code: #{response.exit_code}"
    puts "Error output: #{response.result}"
  end
rescue StandardError => e
  puts "Execution failed: #{e}"
end
```

## See Also
- [Python SDK - process-code-execution](../python-sdk/process-code-execution.md)
- [TypeScript SDK - process-code-execution](../typescript-sdk/process-code-execution.md)
- [Java SDK - process-code-execution](../java-sdk/process-code-execution.md)
- [Go SDK - process-code-execution](../go-sdk/process-code-execution.md)
