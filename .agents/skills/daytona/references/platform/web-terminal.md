

Daytona provides a browser-based web terminal for interacting with your sandboxes. The web terminal allows you to run commands, view files, and debug directly from your browser without installing any local tools.

- **Remote command execution**: run shell commands directly in your sandbox
- **File management**: navigate the file system, view and edit files
- **Debugging**: inspect logs, monitor processes, and troubleshoot issues
- **Package management**: install dependencies and configure your environment

## Access from Dashboard

Access the web terminal directly from the [Daytona Dashboard ↗](https://app.daytona.io/dashboard/sandboxes).

1. Go to [Sandboxes ↗](https://app.daytona.io/dashboard/sandboxes)
2. Locate the running sandbox you want to access
3. Click the terminal icon **`>_`**

This opens the web terminal in a new browser tab, providing a full terminal session connected to your sandbox. The web terminal is available only for sandboxes in the `STARTED` state. If your sandbox is stopped, start it before attempting to access the terminal.

## Access via CLI

When you create a sandbox using the Daytona CLI, the web terminal URL is displayed automatically in the output.

```shell
daytona create
```

The CLI output includes the terminal URL:

```text
Sandbox '<sandboxId>' created successfully
Connect via SSH:         daytona ssh <sandboxId>
Open the Web Terminal:   https://22222-<sandboxId>.proxy.daytona.work
```

## Access via URL

The web terminal runs on port `22222` inside each sandbox. You can obtain the terminal URL programmatically using [Preview URLs](../python-sdk/preview.md).

Pass port `22222` to the preview URL method:

**Python:**

```python
terminal_info = sandbox.get_preview_link(22222)
print(f"Web Terminal URL: {terminal_info.url}")
```

**TypeScript:**

```typescript
const terminalInfo = await sandbox.getPreviewLink(22222);
console.log(`Web Terminal URL: ${terminalInfo.url}`);
```

**Ruby:**

```ruby
terminal_info = sandbox.preview_url(22222)
puts "Web Terminal URL: #{terminal_info.url}"
```

**Go:**

```go
url, err := sandbox.GetPreviewLink(ctx, 22222)
```

**CLI:**

```bash
daytona preview-url <sandbox-name> --port 22222
```

**API:**

```bash
curl 'https://app.daytona.io/api/sandbox/{sandboxId}/ports/22222/preview-url' \
  --header 'Authorization: Bearer <API_KEY>'
```

## Security

Terminal access is restricted to authenticated members of your [Organization](./organizations.md). Even when a sandbox has its `public` parameter set to `true`, the web terminal remains accessible only to organization members.
> **Warning:**
> The web terminal provides full shell access to your sandbox. Treat terminal URLs with the same care as SSH credentials. Do not share terminal URLs with untrusted parties.

## See Also

- [Python SDK](../python-sdk/README.md)
- [TypeScript SDK](../typescript-sdk/README.md)
- [Java SDK](../java-sdk/README.md)
- [Go SDK](../go-sdk/README.md)
- [Ruby SDK](../ruby-sdk/README.md)
