

Log streaming lets you access and process session command logs in real time while a process is still running, or retrieve a snapshot of all logs produced so far. Use streaming for long-running or background commands. Use snapshots when you only need the current output.

For entrypoint log streaming, see [process & code execution](./process-code-execution.md#entrypoint-session). To stream logs while sending input to a running command, see [execute interactive commands](./process-code-execution.md#execute-interactive-commands).

## Stream logs with callbacks

Stream logs in the background while the rest of your system continues executing. Use this for continuous monitoring, debugging long-running jobs, or forwarding logs to other systems.

```typescript
import { Daytona } from '@daytona/sdk'

async function main() {
  const daytona = new Daytona()
  const sandbox = await daytona.create()
  const sessionId = "exec-session-1"
  await sandbox.process.createSession(sessionId)

  const command = await sandbox.process.executeSessionCommand(
    sessionId,
    {
      command: 'for i in {1..5}; do echo "Step $i"; echo "Error $i" >&2; sleep 1; done',
      runAsync: true,
    },
  )

  // Stream logs with separate callbacks
  const logsTask = sandbox.process.getSessionCommandLogs(
    sessionId,
    command.cmdId!,
    (stdout) => console.log('[STDOUT]:', stdout),
    (stderr) => console.log('[STDERR]:', stderr),
  )

  console.log('Continuing execution while logs are streaming...')
  await new Promise((resolve) => setTimeout(resolve, 3000))
  console.log('Other operations completed!')

  // Wait for the logs to complete
  await logsTask

  await sandbox.delete()
}

main()
```

## Retrieve all existing logs

Retrieve all logs produced up to the current point in time. Use this when the command has a predictable duration, or when you prefer to poll for output instead of streaming.

```typescript
import { Daytona } from '@daytona/sdk'

async function main() {
  const daytona = new Daytona()
  const sandbox = await daytona.create()
  const sessionId = "exec-session-1"
  await sandbox.process.createSession(sessionId)

  // Execute a blocking command and wait for the result
  const command = await sandbox.process.executeSessionCommand(
    sessionId,
    {
      command: 'echo "Hello from stdout" && echo "Hello from stderr" >&2',
    },
  )
  console.log(`[STDOUT]: ${command.stdout}`)
  console.log(`[STDERR]: ${command.stderr}`)
  console.log(`[OUTPUT]: ${command.output}`)

  // Or execute command in the background and get the logs later
  const command2 = await sandbox.process.executeSessionCommand(
    sessionId,
    {
      command: 'while true; do if (( RANDOM % 2 )); then echo "All good at $(date)"; else echo "Oops, an error at $(date)" >&2; fi; sleep 1; done',
      runAsync: true,
    },
  )
  await new Promise((resolve) => setTimeout(resolve, 5000))
  // Get the logs up to the current point in time
  const logs = await sandbox.process.getSessionCommandLogs(sessionId, command2.cmdId!)
  console.log(`[STDOUT]: ${logs.stdout}`)
  console.log(`[STDERR]: ${logs.stderr}`)
  console.log(`[OUTPUT]: ${logs.output}`)

  await sandbox.delete()
}

main()
```

## See Also
- [Python SDK - log-streaming](../python-sdk/log-streaming.md)
