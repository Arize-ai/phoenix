

Log streaming lets you access and process session command logs in real time while a process is still running, or retrieve a snapshot of all logs produced so far. Use streaming for long-running or background commands. Use snapshots when you only need the current output.

For entrypoint log streaming, see [process & code execution](./process-code-execution.md#entrypoint-session). To stream logs while sending input to a running command, see [execute interactive commands](./process-code-execution.md#execute-interactive-commands).

## Stream logs with callbacks

Stream logs in the background while the rest of your system continues executing. Use this for continuous monitoring, debugging long-running jobs, or forwarding logs to other systems.

```ruby
require 'daytona'

daytona = Daytona::Daytona.new
sandbox = daytona.create

session_id = 'streaming-session'
sandbox.process.create_session(session_id)

command = sandbox.process.execute_session_command(
  session_id: session_id,
  req: Daytona::SessionExecuteRequest.new(
    command: 'for i in {1..5}; do echo "Step $i"; echo "Error $i" >&2; sleep 1; done',
    run_async: true
  )
)

# Stream logs using a thread
log_thread = Thread.new do
  sandbox.process.get_session_command_logs_async(
    session_id: session_id,
    command_id: command.cmd_id,
    on_stdout: ->(stdout) { puts "[STDOUT]: #{stdout}" },
    on_stderr: ->(stderr) { puts "[STDERR]: #{stderr}" }
  )
end

puts 'Continuing execution while logs are streaming...'
sleep(3)
puts 'Other operations completed!'

# Wait for the logs to complete
log_thread.join

daytona.delete(sandbox)
```

## Retrieve all existing logs

Retrieve all logs produced up to the current point in time. Use this when the command has a predictable duration, or when you prefer to poll for output instead of streaming.

```ruby
require 'daytona'

daytona = Daytona::Daytona.new
sandbox = daytona.create
session_id = 'exec-session-1'
sandbox.process.create_session(session_id)

# Execute a blocking command and wait for the result
command = sandbox.process.execute_session_command(
  session_id: session_id,
  req: Daytona::SessionExecuteRequest.new(
    command: 'echo "Hello from stdout" && echo "Hello from stderr" >&2'
  )
)
puts "[STDOUT]: #{command.stdout}"
puts "[STDERR]: #{command.stderr}"
puts "[OUTPUT]: #{command.output}"

# Or execute command in the background and get the logs later
command = sandbox.process.execute_session_command(
  session_id: session_id,
  req: Daytona::SessionExecuteRequest.new(
    command: 'while true; do if (( RANDOM % 2 )); then echo "All good at $(date)"; else echo "Oops, an error at $(date)" >&2; fi; sleep 1; done',
    run_async: true
  )
)
sleep(5)
# Get the logs up to the current point in time
logs = sandbox.process.get_session_command_logs(
  session_id: session_id,
  command_id: command.cmd_id
)
puts "[STDOUT]: #{logs.stdout}"
puts "[STDERR]: #{logs.stderr}"
puts "[OUTPUT]: #{logs.output}"

daytona.delete(sandbox)
```

## See Also
- [Python SDK - log-streaming](../python-sdk/log-streaming.md)
- [TypeScript SDK - log-streaming](../typescript-sdk/log-streaming.md)
- [Java SDK - log-streaming](../java-sdk/log-streaming.md)
- [Go SDK - log-streaming](../go-sdk/log-streaming.md)
