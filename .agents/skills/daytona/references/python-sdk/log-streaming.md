

Log streaming lets you access and process session command logs in real time while a process is still running, or retrieve a snapshot of all logs produced so far. Use streaming for long-running or background commands. Use snapshots when you only need the current output.

For entrypoint log streaming, see [process & code execution](./process-code-execution.md#entrypoint-session). To stream logs while sending input to a running command, see [execute interactive commands](./process-code-execution.md#execute-interactive-commands).

## Stream logs with callbacks

Stream logs in the background while the rest of your system continues executing. Use this for continuous monitoring, debugging long-running jobs, or forwarding logs to other systems.

> **Tip: Python callbacks**
> When streaming with the Python SDK, avoid blocking operations inside stdout/stderr callbacks. Blocking synchronous callbacks can cause WebSocket disconnections. Use async callbacks where possible.

```python
import asyncio
from daytona import Daytona, SessionExecuteRequest

async def main():
  daytona = Daytona()
  sandbox = daytona.create()

  session_id = "streaming-session"
  sandbox.process.create_session(session_id)

  command = sandbox.process.execute_session_command(
    session_id,
    SessionExecuteRequest(
      command='for i in {1..5}; do echo "Step $i"; echo "Error $i" >&2; sleep 1; done',
      run_async=True,
    ),
  )

  # Stream logs with separate callbacks
  logs_task = asyncio.create_task(
    sandbox.process.get_session_command_logs_async(
      session_id,
      command.cmd_id,
      lambda stdout: print(f"[STDOUT]: {stdout}"),
      lambda stderr: print(f"[STDERR]: {stderr}"),
    )
  )

  print("Continuing execution while logs are streaming...")
  await asyncio.sleep(3)
  print("Other operations completed!")

  # Wait for the logs to complete
  await logs_task

  sandbox.delete()

if __name__ == "__main__":
    asyncio.run(main())
```

## Retrieve all existing logs

Retrieve all logs produced up to the current point in time. Use this when the command has a predictable duration, or when you prefer to poll for output instead of streaming.

```python
import time
from daytona import Daytona, SessionExecuteRequest

daytona = Daytona()
sandbox = daytona.create()
session_id = "exec-session-1"
sandbox.process.create_session(session_id)

# Execute a blocking command and wait for the result
command = sandbox.process.execute_session_command(
  session_id, SessionExecuteRequest(command="echo 'Hello from stdout' && echo 'Hello from stderr' >&2")
)
print(f"[STDOUT]: {command.stdout}")
print(f"[STDERR]: {command.stderr}")
print(f"[OUTPUT]: {command.output}")

# Or execute command in the background and get the logs later
command = sandbox.process.execute_session_command(
  session_id,
  SessionExecuteRequest(
    command='while true; do if (( RANDOM % 2 )); then echo "All good at $(date)"; else echo "Oops, an error at $(date)" >&2; fi; sleep 1; done',
    run_async=True
  )
)
time.sleep(5)
# Get the logs up to the current point in time
logs = sandbox.process.get_session_command_logs(session_id, command.cmd_id)
print(f"[STDOUT]: {logs.stdout}")
print(f"[STDERR]: {logs.stderr}")
print(f"[OUTPUT]: {logs.output}")

sandbox.delete()
```
