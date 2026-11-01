## Contents

- Create PTY session
- Connect to PTY session
- List PTY sessions
- Get PTY session info
- Kill PTY session
- Resize PTY session
- Interactive commands
- Long-running processes
- Resource management
- PtyHandle methods
- Error handling
- See Also




Daytona provides powerful pseudo terminal (PTY) capabilities through the `process` module in sandboxes. PTY sessions allow you to create interactive terminal sessions that can execute commands, handle user input, and manage terminal operations.

A PTY (Pseudo Terminal) is a virtual terminal interface that allows programs to interact with a shell as if they were connected to a real terminal. PTY sessions in Daytona enable:

- **Interactive Development**: REPLs, debuggers, and development tools
- **Build Processes**: Running and monitoring compilation, testing, or deployment
- **System Administration**: Remote server management and configuration
- **User Interfaces**: Terminal-based applications requiring user interaction

## Create PTY session

Create an interactive terminal session that can execute commands and handle user input.

```typescript
// Create a PTY session with custom configuration
const ptyHandle = await sandbox.process.createPty({
  id: 'my-interactive-session',
  cwd: '/workspace',
  envs: { TERM: 'xterm-256color', LANG: 'en_US.UTF-8' },
  cols: 120,
  rows: 30,
  onData: (data) => {
    // Handle terminal output
    const text = new TextDecoder().decode(data)
    process.stdout.write(text)
  },
})

// Wait for connection to be established
await ptyHandle.waitForConnection()

// Send commands to the terminal
await ptyHandle.sendInput('ls -la\n')
await ptyHandle.sendInput('echo "Hello, PTY!"\n')
await ptyHandle.sendInput('exit\n')

// Wait for completion and get result
const result = await ptyHandle.wait()
console.log(`PTY session completed with exit code: ${result.exitCode}`)

// Clean up
await ptyHandle.disconnect()
```

## Connect to PTY session

Establish a connection to an existing PTY session.

```typescript
// Connect to an existing PTY session
const handle = await sandbox.process.connectPty('my-session', {
  onData: (data) => {
    // Handle terminal output
    const text = new TextDecoder().decode(data)
    process.stdout.write(text)
  },
})

// Wait for connection to be established
await handle.waitForConnection()

// Send commands to the existing session
await handle.sendInput('pwd\n')
await handle.sendInput('ls -la\n')
await handle.sendInput('exit\n')

// Wait for completion
const result = await handle.wait()
console.log(`Session exited with code: ${result.exitCode}`)

// Clean up
await handle.disconnect()
```

## List PTY sessions

List PTY sessions currently registered in the sandbox.

```typescript
// List all PTY sessions
const sessions = await sandbox.process.listPtySessions()

for (const session of sessions) {
  console.log(`Session ID: ${session.id}`)
  console.log(`Active: ${session.active}`)
  console.log(`Lazy start: ${session.lazyStart}`)
  console.log(`Created: ${session.createdAt}`)
  console.log('---')
}
```

## Get PTY session info

Get details about a specific PTY session.

```typescript
// Get details about a specific PTY session
const session = await sandbox.process.getPtySessionInfo('my-session')

console.log(`Session ID: ${session.id}`)
console.log(`Active: ${session.active}`)
console.log(`Lazy start: ${session.lazyStart}`)
console.log(`Working Directory: ${session.cwd}`)
console.log(`Terminal Size: ${session.cols}x${session.rows}`)
```

## Kill PTY session

Kill a PTY session, terminating the shell process and removing the session from the sandbox.

```typescript
// Kill a specific PTY session
await sandbox.process.killPtySession('my-session')

// Verify the session is no longer active
try {
  const info = await sandbox.process.getPtySessionInfo('my-session')
  console.log(`Session still exists but active: ${info.active}`)
} catch (error) {
  console.log('Session has been completely removed')
}
```

## Resize PTY session

Resize a PTY session, allowing you to change the terminal dimensions of an active PTY session.

```typescript
// Resize a PTY session to a larger terminal
const updatedInfo = await sandbox.process.resizePtySession('my-session', 150, 40)
console.log(`Terminal resized to ${updatedInfo.cols}x${updatedInfo.rows}`)

// You can also use the PtyHandle's resize method
await ptyHandle.resize(150, 40) // cols, rows
```

## Interactive commands

Handle interactive commands with PTY sessions, allowing you to handle interactive commands that require user input and can be resized during execution.

```typescript
import { Daytona, Sandbox } from '@daytona/sdk'

// Create PTY session
const ptyHandle = await sandbox.process.createPty({
  id: 'interactive-session',
  cols: 300,
  rows: 100,
  onData: data => {
    const text = new TextDecoder().decode(data)
    process.stdout.write(text)
  },
})

await ptyHandle.waitForConnection()

// Send interactive command
await ptyHandle.sendInput(
  'printf "Are you accepting the terms and conditions? (y/n): " && read confirm && if [ "$confirm" = "y" ]; then echo "You accepted"; else echo "You did not accept"; fi\n'
)
await new Promise(resolve => setTimeout(resolve, 1000))
await ptyHandle.sendInput('y\n')

// Resize terminal
const ptySessionInfo = await sandbox.process.resizePtySession(
  'interactive-session',
  210,
  110
)
console.log(
  `\nPTY session resized to ${ptySessionInfo.cols}x${ptySessionInfo.rows}`
)

// Exit the session
await ptyHandle.sendInput('exit\n')

// Wait for completion
const result = await ptyHandle.wait()
console.log(`Session completed with exit code: ${result.exitCode}`)
```

## Long-running processes

Manage long-running processes with PTY sessions, allowing you to manage long-running processes that need to be monitored or terminated.

```typescript
import { Daytona, Sandbox } from '@daytona/sdk'

// Create PTY session
const ptyHandle = await sandbox.process.createPty({
  id: 'long-running-session',
  cols: 120,
  rows: 30,
  onData: (data) => {
    const text = new TextDecoder().decode(data)
    process.stdout.write(text)
  },
})

await ptyHandle.waitForConnection()

// Start a long-running process
await ptyHandle.sendInput('while true; do echo "Running... $(date)"; sleep 1; done\n')
await new Promise(resolve => setTimeout(resolve, 3000)) // Let it run for a bit

console.log('Killing long-running process...')
await ptyHandle.kill()

// Wait for termination
const result = await ptyHandle.wait()
console.log(`\nProcess terminated with exit code: ${result.exitCode}`)
if (result.error) {
    console.log(`Termination reason: ${result.error}`)
}
```

## Resource management

Manage resource leaks with PTY sessions, allowing you to always clean up PTY sessions to prevent resource leaks.

```typescript
// TypeScript: Use try/finally
let ptyHandle
try {
  ptyHandle = await sandbox.process.createPty({
    id: 'session',
    cols: 120,
    rows: 30,
  })
  // Do work...
} finally {
  if (ptyHandle) await ptyHandle.kill()
}
```

## PtyHandle methods

Daytona provides methods to interact with PTY sessions, allowing you to send input, resize the terminal, wait for completion, and manage the WebSocket connection to a PTY session.

### Send input

Send input to a PTY session, allowing you to send input data (keystrokes or commands) to the PTY session.

```typescript
// Send a command
await ptyHandle.sendInput('ls -la\n')

// Send raw bytes
await ptyHandle.sendInput(new Uint8Array([3])) // Ctrl+C
```

### Wait for completion

Wait for a PTY process to exit and return the result.

```typescript
// Wait for process to complete
const result = await ptyHandle.wait()

if (result.exitCode === 0) {
  console.log('Process completed successfully')
} else {
  console.log(`Process failed with code: ${result.exitCode}`)
  if (result.error) {
    console.log(`Error: ${result.error}`)
  }
}
```

### Wait for connection

Wait for the WebSocket connection to be established before sending input.

```typescript
// Wait for connection to be established
await ptyHandle.waitForConnection()

// Now safe to send input
await ptyHandle.sendInput('echo "Connected!"\n')
```

### Kill PTY process

Kill a PTY process and terminate the session from the handle.

```typescript
// Kill a long-running process
await ptyHandle.kill()

// Wait to confirm termination
const result = await ptyHandle.wait()
console.log(`Process terminated with exit code: ${result.exitCode}`)
```

### Resize from handle

Resize the PTY terminal dimensions directly from the handle.

```typescript
// Resize to 120x30
await ptyHandle.resize(120, 30)
```

### Disconnect

Disconnect from a PTY session and clean up resources without killing the process.

```typescript
// Always clean up when done
try {
  // ... use PTY session
} finally {
  await ptyHandle.disconnect()
}
```

### Check connection status

Check if a PTY session is still connected.

```typescript
if (ptyHandle.isConnected()) {
  console.log('PTY session is active')
}
```

### Exit code and error

Access the exit code and error message after a PTY process terminates.

```typescript
// Access via getters after process terminates
console.log(`Exit code: ${ptyHandle.exitCode}`)
if (ptyHandle.error) {
  console.log(`Error: ${ptyHandle.error}`)
}
```

### Iterate over output (Python)

Iterate over a PTY handle to receive output data.

```typescript
// TypeScript uses the onData callback instead
const ptyHandle = await sandbox.process.createPty({
  id: 'my-session',
  onData: (data) => {
    const text = new TextDecoder().decode(data)
    process.stdout.write(text)
  },
})
```

## Error handling

Monitor exit codes and handle errors appropriately with PTY sessions.

```typescript
// TypeScript: Check exit codes
const result = await ptyHandle.wait()
if (result.exitCode !== 0) {
  console.log(`Command failed: ${result.exitCode}`)
  console.log(`Error: ${result.error}`)
}
```

## See Also
- [Python SDK - pty](../python-sdk/pty.md)
- [Java SDK - pty](../java-sdk/pty.md)
