# Log Streaming (Python SDK)

Stream logs as they are being produced, while the process is still running.

Log streaming is the live delivery of the output of a process in a sandbox, such as a build, a test run, or a server, to a reader outside the sandbox while the process still runs. The reader follows long-running work as it happens instead of waiting for it to exit, and an agent can react to an error as soon as the process prints it, without polling for new output.

Daytona records the output of every process it starts in a sandbox and keeps it within retention limits. A client streams the output while the process runs, or reads the output kept so far. A client that disconnects resumes where it left off, unless retention has discarded output it missed.

Use streaming for long-running or background commands, such as builds, tests, training runs, and servers, and read the existing logs when you need only the current output. For entrypoint log streaming, see [entrypoint process](./process-execution.md#entrypoint-process). To stream logs while sending input to a running command, see [execute interactive commands](./process-execution.md#execute-interactive-commands) in process execution.

## Contents

- [Use cases](#use-cases)
- [Stream logs](#stream-logs)
- [Retrieve all existing logs](#retrieve-all-existing-logs)
- [Log frames](#log-frames)
- [Log retention](#log-retention)
- [Permissions](#permissions)

## Use cases

Log streaming gives an application the output of a process while it still runs.

- **Live output in a UI.** Build, test, or training output appears in a web application as the process writes it. Each frame carries a timestamp, so the UI shows when the output was written. A PTY process sends its merged terminal output on one channel, escape sequences included.

- **Agent feedback.** An agent reads the output of a long command as it arrives and stops the command early on an error. A stream sends new output as it is written and ends once the process exits. Its state event reports the exit code, signal, and reason of the process.

- **Reconnects.** A client that loses its connection resumes from its last cursor. No frame is delivered twice, and no retained frame is missed. An SSE client sends the ID of the last event it received, and the daemon uses that ID as the cursor.

- **Server logs.** The output of a background web server or worker is followed for as long as the process runs. When the server writes nothing, the daemon sends a keepalive every 15 seconds. The CLI follows the logs until the process exits, then exits with the exit code of the process. If the CLI timeout passes first, the CLI stops following and the process keeps running.

- **Error handling.** Stdout and stderr arrive on separate channels, so an application handles errors apart from regular output. Order is kept within a channel, not across channels. With table output, the CLI writes stderr and error frames to its standard error and the other frames to its standard output.

## Stream logs

Stream logs to receive the output of a process as it is written. A log stream is a connection that stays open and carries each new piece of output to the reader until the program ends.

A log stream of a sandbox process first replays the retained output, then carries new output as the process writes it. The stream ends once the process exits and all of its output is delivered.

Stream logs to follow builds, tests, and servers while they run. A stream replays the retained output from the beginning, or from a cursor when you [resume a stream](#resume-a-stream). While the process is silent, the daemon sends a keepalive every 15 seconds.

**Python:**

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

handle = sandbox.process.start(
    'for i in {1..5}; do echo "Step $i"; echo "Error $i" >&2; sleep 1; done'
)

for event in handle.stream_logs():
    if event.type == "log":
        print(f"[{event.frame.channel.upper()}]: {event.frame.data}", end="")
```

> **Notes:**
>
> - **Recovery:** stream_logs() does not reopen a dropped connection, so [resume](#resume-a-stream) from the last event's cursor. If retention has removed that position, the stream yields a warning event and continues from the oldest frame still kept.

**Python (async):**

```python
import asyncio

from daytona import AsyncDaytona

async def main() -> None:
    async with AsyncDaytona() as daytona:
        sandbox = await daytona.v2.create()

        handle = await sandbox.process.start(
            'for i in {1..5}; do echo "Step $i"; echo "Error $i" >&2; sleep 1; done'
        )

        async for event in handle.stream_logs():
            if event.type == "log":
                print(f"[{event.frame.channel.upper()}]: {event.frame.data}", end="")

asyncio.run(main())
```

> **Notes:**
>
> - **Recovery:** stream_logs() does not reopen a dropped connection, so [resume](#resume-a-stream) from the last event's cursor. If retention has removed that position, the stream yields a warning event and continues from the oldest frame still kept.

### Stream events

Stream events are the typed messages that a server sends over an open connection, each with a name and a payload. A server-sent event also carries an ID that a client sends back to resume.

An event of a log stream in a sandbox carries either the output of the process or a change to the process or to the stream itself.

Handle the events of a log stream by type. Each event carries a cursor, also sent as the event ID, so a client can resume after any event. A stream ends after its end event or its error event.

| **Event**     | **Payload**                                                              | **Meaning**                                                                                                                                |
| ------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **`log`**     | A [log frame](#log-frames)                                               | One chunk of process output.                                                                                                               |
| **`state`**   | The process record with `exitCode`, `signal`, `reason`, and `cursor`     | The process reached the `terminal` state. Sent once. Frames written before exit can still follow it.                                       |
| **`warning`** | `cursor`, `message`, `firstAvailableCursor`                              | The requested position was evicted by [log retention](#log-retention). The stream resumes from `firstAvailableCursor` on its own. Its `cursor` is the requested position, and its event ID is `firstAvailableCursor`. |
| **`eof`**     | `cursor`                                                                 | The process is terminal and every frame has been delivered. The stream closes after this event.                                            |
| **`error`**   | `cursor`, `message`                                                      | The daemon failed to read the ledger. The stream closes after this event. The SDKs raise it as an error instead of yielding it.            |

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

handle = sandbox.process.start("for i in {1..3}; do echo \"Step $i\"; sleep 1; done")

# The generator returns after the eof event; a stream error is raised
for event in handle.stream_logs():
    if event.type == "log":
        print(f"[{event.frame.channel.upper()}]: {event.frame.data}", end="")
    elif event.type == "state":
        print(f"Exit code: {event.result.exit_code}, reason: {event.result.reason}")
    elif event.type == "warning":
        print(f"Older logs were evicted, resuming from {event.first_available_cursor}")
    elif event.type == "eof":
        print(f"Stream complete at cursor {event.cursor}")
```

> **Notes:**
>
> - **Results:** The stream ends after the eof event.

### Resume a stream

Resume a stream to continue reading after a dropped connection. A cursor marks a position in a log, and a reader that keeps the cursor of the last item it read can start again right after it.

A resumed log stream in a sandbox starts strictly after its cursor, so no frame arrives twice.

Resume a stream from the cursor of the last event processed. An SSE client that reconnects sends the ID of the last event it received, and the daemon uses it in place of the cursor. If [log retention](#log-retention) evicted the position, the stream warns and continues from the oldest retained frame.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

handle = sandbox.process.start("for i in {1..5}; do echo \"Step $i\"; sleep 1; done")

# Stop early, remembering the cursor of the last frame processed
last_cursor = None
for event in handle.stream_logs():
    if event.type != "log":
        continue
    print(event.frame.data, end="")
    last_cursor = event.cursor
    if event.frame.data.startswith("Step 3"):
        break

# Resume strictly after the last frame seen
for event in handle.stream_logs(cursor=last_cursor):
    if event.type == "log":
        print(event.frame.data, end="")
```

| **Parameter** | **Description** |
| ------------- | --------------- |
| `cursor`      | Starts the stream strictly after this cursor. |

## Retrieve all existing logs

Retrieve all existing logs to read the output that a process has written up to now. A log read returns what is stored at the moment of the request, unlike a stream, which waits for more.

A log read in a sandbox returns one page of retained process output and does not wait for more.

Retrieve the existing logs when you need the current output and not a live feed, for example after a command exits. Output longer than one page needs [pagination](#paginate-logs). A read without a cursor starts at the first frame the process wrote, which [log retention](#log-retention) can evict.

```python
from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

handle = sandbox.process.start('for i in {1..3}; do echo "Step $i"; echo "Error $i" >&2; done')
handle.wait()

# Logs produced up to the current point in time
page = handle.logs()
for frame in page.items:
    print(f"[{frame.channel.upper()}]: {frame.data}", end="")
```

| **Parameter** | **Description** |
| ------------- | --------------- |
| `limit`       | Sets the maximum number of frames on the page.<br />**Default:** `1000`<br />**Value:** `1` to `5000`, with other values clamped to that range |

> **Notes:**
>
> - **Polling:** A read without a cursor starts at the first frame the process wrote, which [log retention](#log-retention) can evict.

### Paginate logs

Paginate logs to read long output in parts. Pagination splits a long result into pages, and each page names the position where the next page starts.

A page of logs in a sandbox holds consecutive frames and says whether it is the last page.

Paginate logs when output exceeds one page. Pass the next cursor of a page to read the next page. A page is last when the process has exited and no frame follows it. An empty page without that mark means the read has caught up, and a running process can produce more.

```python
from daytona import Daytona
from daytona.v2 import LogFrame

daytona = Daytona()
sandbox = daytona.v2.create()

# One line every 10 ms, so the output spans many frames
handle = sandbox.process.start('for i in $(seq 1 1200); do echo "$i"; sleep 0.01; done')
handle.wait()

frames: list[LogFrame] = []
cursor = None
pages = 0
while True:
    page = handle.logs(cursor=cursor, limit=500)
    frames.extend(page.items)
    pages += 1
    cursor = page.next_cursor
    if page.eof:
        break

stdout = "".join(frame.data for frame in frames if frame.channel == "stdout")
print(f"{len(frames)} frames in {pages} pages, {len(stdout)} bytes of stdout")
```

| **Parameter** | **Description** |
| ------------- | --------------- |
| `cursor`      | Starts the page strictly after this cursor. A read from an evicted position fails with an error that names the oldest retained position, and a stream warns and continues from there.<br />**Default:** the first frame, and the read fails the same way once that frame is evicted |
| `limit`       | Sets the maximum number of frames on the page.<br />**Default:** `1000`<br />**Value:** `1` to `5000`, with other values clamped to that range |

> **Notes:**
>
> - **Limits:** A [frame](#log-frames) holds up to 64 KiB of output, so one frame can hold many lines.
> - **Polling:** While the process runs, an empty page means the read caught up; read on from the next cursor.

### Binary output

Binary output is output that is not text, such as compressed data or images, and it can hold byte sequences that are not valid UTF-8. Base64 encodes any bytes as text, so binary data can travel in a text format such as JSON without change.

The output of a process in a sandbox is kept as raw bytes, and the encoding chosen for a read decides in which form those bytes reach the client.

Read binary output in base64 to get it without loss. The default text encoding replaces bytes that are not valid UTF-8. Base64 encoding returns the raw bytes of each frame as standard base64 with padding. In the CLI, use JSON output with base64, because table output is not binary-safe.

```python
import base64

from daytona import Daytona

daytona = Daytona()
sandbox = daytona.v2.create()

handle = sandbox.process.start("head -c 1024 /dev/urandom")
handle.wait()

page = handle.logs(encoding="base64")
raw = b"".join(
    base64.b64decode(frame.data)
    for frame in page.items
    if frame.channel == "stdout"
)
print(f"{len(raw)} bytes")
```

| **Parameter** | **Description** |
| ------------- | --------------- |
| `encoding`    | Sets the encoding of the frame data.<br />**Default:** `text`<br />**Value:** `text` or `base64`<br />**Example:** `"base64"` |

## Log frames

A log frame is a chunk of output that a reader takes from a program's output stream in one read. A frame is not a line, because one read can return part of a line or many lines.

A log frame in a sandbox carries output from one channel of a process, with its log position.

Read frames by channel to handle errors apart from regular output, and join the data of consecutive frames to rebuild lines. A frame holds up to 64 KiB of output, as the daemon read it from the process. Fast output puts many lines in one frame, and a line can span two frames.

| **Field**       | **Description**                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `cursor`    | Opaque position of this frame. Pass it as `cursor` to read strictly after this frame. `""` and `start` mean the beginning. |
| `channel`   | Which stream the frame came from. See the channel table below.                                                           |
| `data`      | The payload, as UTF-8 text or as a standard base64 string with padding when `encoding` is `base64`.                     |
| `timestamp` | When the daemon recorded the frame, in Unix milliseconds. The SDKs name this field `timestamp_ms` (Python) and `timestampMs` (TypeScript). |

| **Channel**   | **Emitted by**                                                                            | **Content**                                                                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **`stdout`**  | `exec` and `code` processes                                                               | Standard output. `exec` processes keep `stdout` and `stderr` on separate pipes, so ordering is preserved within a channel, not across channels.  |
| **`stderr`**  | `exec` and `code` processes                                                               | Standard error.                                                                                                                                 |
| **`pty`**     | [PTY processes](./pty.md)                                                             | The merged terminal byte stream, including escape sequences.                                                                                    |
| **`setup`**   | The daemon                                                                                | Progress messages emitted while the daemon provisions something the process needs, for example a language kernel before the first code execution. |
| **`display`** | [Code executions](./code-execution.md)                         | A kernel side output (`display_data` or `update_display_data`) as a JSON object keyed by media type.                                            |
| **`execute_result`** | [Code executions](./code-execution.md)                  | The kernel's primary result (`execute_result`) as a JSON object keyed by media type.                                                            |
| **`error`**   | [Code executions](./code-execution.md)                         | A kernel exception as JSON: `{"ename", "evalue", "traceback"}`.                                                                                 |

## Log retention

Log retention is the set of rules that decide how long a sandbox keeps the output of a program and how much of the output it keeps. Output outside those rules is removed.

The log retention of a sandbox process has two parts. A policy set at process start decides how long the record and logs stay. A size cap, independent of the policy, limits the amount kept.

Set the retention policy of each process when the process starts, and read or save the output of the process before the daemon evicts it. The daemon keeps up to 8 MiB of output per process, and output beyond that limit evicts the oldest output of the same process. It keeps up to 256 MiB in total per sandbox, and a sweep every minute evicts the oldest output beyond it, from exited processes first and then from running processes.

| **Policy**          | **Default for**                                                                            | **Behavior**                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`until_cleanup`** | API requests that set `name`, sessions, [PTY processes](./pty.md) started through the SDKs, and the entrypoint process | The record and logs stay until the process is deleted. A process that fails to start is downgraded to `on_exit_ttl` so failed records do not accumulate.            |
| **`on_exit_ttl`**   | API requests without `name` other than sessions, and every SDK `process.start()` and `run()` call              | The record and logs are removed 10 to 11 minutes after the process exits. Reading them afterwards fails with `404 PROCESS_NOT_FOUND`.                                  |
| **`none`**          |                                                                                            | Logs are discarded the moment the process exits. Reading the output of a process that wrote any fails afterwards with `409 CURSOR_EXPIRED`. The record stays for the same 10 to 11 minutes, so `wait()` still returns the exit result. `run()` never uses it. |

```python
import time

from daytona import Daytona
from daytona.v2 import CursorExpiredError

daytona = Daytona()
sandbox = daytona.v2.create()

# Keep the logs of an unnamed process until delete(); the process writes 16 MiB
handle = sandbox.process.start(
    "echo first; sleep 2; yes 0123456789abcdef | head -c 16777216",
    keep_logs="until_cleanup",
)

time.sleep(1)
saved_cursor = handle.logs().next_cursor  # a cursor stored from an earlier read
handle.wait()

try:
    page = handle.logs(cursor=saved_cursor)
except CursorExpiredError as e:
    # The position was evicted; restart from the oldest retained frame
    print(f"{saved_cursor} was evicted, reading from {e.first_available_cursor}")
    page = handle.logs(cursor=e.first_available_cursor)

print(f"{len(page.items)} frames, first cursor {page.items[0].cursor}")
handle.delete()
```

| **Parameter** | **Description** |
| ------------- | --------------- |
| `cursor`      | Starts the page strictly after this cursor. A read from an evicted position fails with an error that names the oldest retained position, and a stream warns and continues from there.<br />**Default:** the first frame, and the read fails the same way once that frame is evicted |
| `keep_logs`   | Sets how long the sandbox keeps the process record and its log.<br />**Default:** `on_exit_ttl`<br />**Value:** `until_cleanup`, `on_exit_ttl`, or `none`<br />**Example:** `"until_cleanup"` |

> **Notes:**
>
> - **Lifetime:** The record of a process started with until_cleanup stays until the process is deleted.

## Permissions

Log streaming runs through the toolbox of a sandbox. Access is governed by one project permission, which you can grant to an [organization role](./organizations.md#roles) or an [API key](./api-keys.md).

A [sandbox access token](./sandboxes.md#create-an-access-token) with the toolbox:exec operation grants the same access to a single sandbox, without an API key. The sandbox read permission alone does not grant toolbox access.

| **Permission**        | **Grants**                   |
| --------------------- | ---------------------------- |
| **`write:sandboxes`** | Stream and read process logs |
