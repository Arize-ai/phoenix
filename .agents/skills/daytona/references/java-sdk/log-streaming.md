

Log streaming lets you access and process session command logs in real time while a process is still running, or retrieve a snapshot of all logs produced so far. Use streaming for long-running or background commands. Use snapshots when you only need the current output.

For entrypoint log streaming, see [process & code execution](./process-code-execution.md#entrypoint-session). To stream logs while sending input to a running command, see [execute interactive commands](./process-code-execution.md#execute-interactive-commands).

## Stream logs with callbacks

Stream logs in the background while the rest of your system continues executing. Use this for continuous monitoring, debugging long-running jobs, or forwarding logs to other systems.

```java
import io.daytona.sdk.Daytona;
import io.daytona.sdk.Sandbox;
import io.daytona.sdk.model.SessionExecuteRequest;
import io.daytona.sdk.model.SessionExecuteResponse;

public class App {
    public static void main(String[] args) throws InterruptedException {
        try (Daytona daytona = new Daytona()) {
            Sandbox sandbox = daytona.create();
            String sessionId = "streaming-session";
            sandbox.getProcess().createSession(sessionId);

            SessionExecuteResponse command = sandbox.getProcess().executeSessionCommand(
                    sessionId,
                    new SessionExecuteRequest(
                            "for i in {1..5}; do echo \"Step $i\"; echo \"Error $i\" >&2; sleep 1; done",
                            true));

            Thread logThread = new Thread(() -> sandbox.getProcess().getSessionCommandLogs(
                    sessionId,
                    command.getCmdId(),
                    stdout -> System.out.print("[STDOUT]: " + stdout),
                    stderr -> System.err.print("[STDERR]: " + stderr)));
            logThread.start();

            System.out.println("Continuing execution while logs are streaming...");
            Thread.sleep(3000);
            System.out.println("Other operations completed!");

            logThread.join();

            sandbox.delete();
        }
    }
}
```

## Retrieve all existing logs

Retrieve all logs produced up to the current point in time. Use this when the command has a predictable duration, or when you prefer to poll for output instead of streaming.

```java
import io.daytona.sdk.Daytona;
import io.daytona.sdk.Sandbox;
import io.daytona.sdk.model.SessionCommandLogsResponse;
import io.daytona.sdk.model.SessionExecuteRequest;
import io.daytona.sdk.model.SessionExecuteResponse;

public class App {
    public static void main(String[] args) throws InterruptedException {
        try (Daytona daytona = new Daytona()) {
            Sandbox sandbox = daytona.create();
            String sessionId = "exec-session-1";
            sandbox.getProcess().createSession(sessionId);

            SessionExecuteResponse command = sandbox.getProcess().executeSessionCommand(
                    sessionId,
                    new SessionExecuteRequest(
                            "echo 'Hello from stdout' && echo 'Hello from stderr' >&2",
                            false));
            System.out.println("[STDOUT]: " + command.getStdout());
            System.out.println("[STDERR]: " + command.getStderr());
            System.out.println("[OUTPUT]: " + command.getOutput());

            SessionExecuteResponse asyncCmd = sandbox.getProcess().executeSessionCommand(
                    sessionId,
                    new SessionExecuteRequest(
                            "while true; do if (( RANDOM % 2 )); then echo \"All good at $(date)\"; else echo \"Oops, an error at $(date)\" >&2; fi; sleep 1; done",
                            true));
            Thread.sleep(5000);
            SessionCommandLogsResponse logs = sandbox.getProcess().getSessionCommandLogs(sessionId, asyncCmd.getCmdId());
            System.out.println("[STDOUT]: " + logs.getStdout());
            System.out.println("[STDERR]: " + logs.getStderr());
            System.out.println("[OUTPUT]: " + logs.getOutput());

            sandbox.delete();
        }
    }
}
```

## See Also
- [Python SDK - log-streaming](../python-sdk/log-streaming.md)
- [TypeScript SDK - log-streaming](../typescript-sdk/log-streaming.md)
