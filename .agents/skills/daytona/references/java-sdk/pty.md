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

```java
import io.daytona.sdk.PtyCreateOptions;
import io.daytona.sdk.PtyHandle;
import io.daytona.sdk.PtyResult;
import java.nio.charset.StandardCharsets;

PtyCreateOptions options = new PtyCreateOptions()
    .setId("my-interactive-session")
    .setCols(120)
    .setRows(30)
    .setOnData(chunk -> System.out.print(new String(chunk, StandardCharsets.UTF_8)));

PtyHandle ptyHandle = sandbox.process.createPty(options);
ptyHandle.waitForConnection(30);

ptyHandle.sendInput("ls -la\n");
ptyHandle.sendInput("echo \"Hello, PTY!\"\n");
ptyHandle.sendInput("exit\n");

PtyResult result = ptyHandle.waitForExit();
System.out.println("PTY session completed with exit code: " + result.getExitCode());

ptyHandle.disconnect();
```

## Connect to PTY session

Establish a connection to an existing PTY session.

```java
import io.daytona.sdk.PtyCreateOptions;
import io.daytona.sdk.PtyHandle;
import io.daytona.sdk.PtyResult;
import java.nio.charset.StandardCharsets;

PtyCreateOptions options = new PtyCreateOptions()
    .setOnData(chunk -> System.out.print(new String(chunk, StandardCharsets.UTF_8)));
PtyHandle handle = sandbox.process.connectPty("my-session", options);
handle.waitForConnection(30);

handle.sendInput("pwd\n");
handle.sendInput("ls -la\n");
handle.sendInput("exit\n");

PtyResult result = handle.waitForExit();
System.out.println("Session exited with code: " + result.getExitCode());
handle.disconnect();
```

## List PTY sessions

List PTY sessions currently registered in the sandbox.

```java
import io.daytona.toolbox.client.model.PtySessionInfo;
import java.util.List;

List<PtySessionInfo> sessions = sandbox.process.listPtySessions();
for (PtySessionInfo session : sessions) {
    System.out.println("Session ID: " + session.getId());
    System.out.println("Active: " + session.getActive());
    System.out.println("Lazy start: " + session.getLazyStart());
    System.out.println("Created: " + session.getCreatedAt());
    System.out.println("---");
}
```

## Get PTY session info

Get details about a specific PTY session.

```java
import io.daytona.toolbox.client.model.PtySessionInfo;

PtySessionInfo session = sandbox.process.getPtySessionInfo("my-session");
System.out.println("Session ID: " + session.getId());
System.out.println("Active: " + session.getActive());
System.out.println("Lazy start: " + session.getLazyStart());
System.out.println("Working Directory: " + session.getCwd());
System.out.println("Terminal Size: " + session.getCols() + "x" + session.getRows());
```

## Kill PTY session

Kill a PTY session, terminating the shell process and removing the session from the sandbox.

```java
import io.daytona.toolbox.client.model.PtySessionInfo;
import java.util.List;

sandbox.process.killPtySession("my-session");

List<PtySessionInfo> sessions = sandbox.process.listPtySessions();
for (PtySessionInfo session : sessions) {
    System.out.println("PTY session: " + session.getId());
}
```

## Resize PTY session

Resize a PTY session, allowing you to change the terminal dimensions of an active PTY session.

```java
sandbox.process.resizePtySession("my-session", 150, 40);

// Or resize using the handle (after createPty or connectPty)
handle.resize(150, 40);
```

## Interactive commands

Handle interactive commands with PTY sessions, allowing you to handle interactive commands that require user input and can be resized during execution.

```java
import io.daytona.sdk.PtyCreateOptions;
import io.daytona.sdk.PtyHandle;
import io.daytona.sdk.PtyResult;
import java.nio.charset.StandardCharsets;

PtyCreateOptions options = new PtyCreateOptions()
    .setId("interactive-session")
    .setCols(300)
    .setRows(100)
    .setOnData(chunk -> System.out.print(new String(chunk, StandardCharsets.UTF_8)));

PtyHandle handle = sandbox.process.createPty(options);
handle.waitForConnection(30);

handle.sendInput(
    "printf \"Are you accepting the terms and conditions? (y/n): \" && read confirm && if [ \"$confirm\" = \"y\" ]; then echo \"You accepted\"; else echo \"You did not accept\"; fi\n");
Thread.sleep(1000);
handle.sendInput("y\n");

sandbox.process.resizePtySession("interactive-session", 210, 110);
System.out.println("\nPTY session resized");

handle.sendInput("exit\n");

PtyResult result = handle.waitForExit();
System.out.println("Session completed with exit code: " + result.getExitCode());
```

## Long-running processes

Manage long-running processes with PTY sessions, allowing you to manage long-running processes that need to be monitored or terminated.

```java
import io.daytona.sdk.PtyCreateOptions;
import io.daytona.sdk.PtyHandle;
import io.daytona.sdk.PtyResult;
import java.nio.charset.StandardCharsets;

PtyCreateOptions options = new PtyCreateOptions()
    .setId("long-running-session")
    .setCols(120)
    .setRows(30)
    .setOnData(chunk -> System.out.print(new String(chunk, StandardCharsets.UTF_8)));

PtyHandle handle = sandbox.process.createPty(options);
handle.waitForConnection(30);

handle.sendInput("while true; do echo \"Running... $(date)\"; sleep 1; done\n");
Thread.sleep(3000);

System.out.println("Killing long-running process...");
handle.kill();

PtyResult result = handle.waitForExit();
System.out.println("\nProcess terminated with exit code: " + result.getExitCode());
if (result.getError() != null) {
    System.out.println("Termination reason: " + result.getError());
}
```

## Resource management

Manage resource leaks with PTY sessions, allowing you to always clean up PTY sessions to prevent resource leaks.

```java
import io.daytona.sdk.PtyCreateOptions;
import io.daytona.sdk.PtyHandle;

PtyHandle handle = null;
try {
    handle = sandbox.process.createPty(
        new PtyCreateOptions().setId("session").setCols(120).setRows(30));
    handle.waitForConnection(30);
    // Do work...
} finally {
    if (handle != null) {
        handle.kill();
        handle.disconnect();
    }
}
```

## PtyHandle methods

Daytona provides methods to interact with PTY sessions, allowing you to send input, resize the terminal, wait for completion, and manage the WebSocket connection to a PTY session.

### Send input

Send input to a PTY session, allowing you to send input data (keystrokes or commands) to the PTY session.

```java
// Send a command
ptyHandle.sendInput("ls -la\n");

// Send raw bytes (Ctrl+C)
ptyHandle.sendInput(new byte[] { 0x03 });
```

### Wait for completion

Wait for a PTY process to exit and return the result.

```java
import io.daytona.sdk.PtyResult;

PtyResult result = ptyHandle.waitForExit();

if (result.getExitCode() == 0) {
    System.out.println("Process completed successfully");
} else {
    System.out.println("Process failed with code: " + result.getExitCode());
    if (result.getError() != null) {
        System.out.println("Error: " + result.getError());
    }
}
```

### Wait for connection

Wait for the WebSocket connection to be established before sending input.

```java
// Wait for connection (timeout in seconds)
ptyHandle.waitForConnection(30);

ptyHandle.sendInput("echo \"Connected!\"\n");
```

### Kill PTY process

Kill a PTY process and terminate the session from the handle.

```java
import io.daytona.sdk.PtyResult;

ptyHandle.kill();

PtyResult result = ptyHandle.waitForExit();
System.out.println("Process terminated with exit code: " + result.getExitCode());
```

### Resize from handle

Resize the PTY terminal dimensions directly from the handle.

```java
// Resize to 120x30
ptyHandle.resize(120, 30);
```

### Disconnect

Disconnect from a PTY session and clean up resources without killing the process.

```java
try {
    // ... use PTY session
} finally {
    ptyHandle.disconnect();
}
```

### Check connection status

Check if a PTY session is still connected.

```java
if (ptyHandle.isConnected()) {
    System.out.println("PTY session is active");
}
```

### Exit code and error

Access the exit code and error message after a PTY process terminates.

```java
import io.daytona.sdk.PtyResult;

PtyResult result = ptyHandle.waitForExit();
System.out.println("Exit code: " + result.getExitCode());
if (result.getError() != null) {
    System.out.println("Error: " + result.getError());
}
```

### Iterate over output (Python)

Iterate over a PTY handle to receive output data.

```java
import io.daytona.sdk.PtyCreateOptions;
import java.nio.charset.StandardCharsets;

PtyHandle ptyHandle = sandbox.process.createPty(
    new PtyCreateOptions()
        .setId("my-session")
        .setOnData(chunk -> System.out.print(new String(chunk, StandardCharsets.UTF_8))));
```

## Error handling

Monitor exit codes and handle errors appropriately with PTY sessions.

```java
import io.daytona.sdk.PtyResult;

PtyResult result = ptyHandle.waitForExit();
if (result.getExitCode() != 0) {
    System.out.println("Command failed: " + result.getExitCode());
    if (result.getError() != null) {
        System.out.println("Error: " + result.getError());
    }
}
```

## See Also
- [Python SDK - pty](../python-sdk/pty.md)
- [TypeScript SDK - pty](../typescript-sdk/pty.md)
