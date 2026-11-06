## Contents

- Install Daytona CLI
- Authenticate with Daytona
- Initialize MCP server
- Configure MCP server
- Start MCP server
- Available tools
- See Also




Daytona Model Context Protocol (MCP) server enables AI agents to interact with [Daytona Sandboxes](../python-sdk/sandboxes.md) programmatically. This guide covers how to set up and use the MCP server with various AI agents.

## Install Daytona CLI

Install the Daytona CLI to manage the MCP server.

**Mac/Linux:**

```bash
brew install daytonaio/cli/daytona
```

**Windows:**

```bash
powershell -Command "irm https://get.daytona.io/windows | iex"
```

## Authenticate with Daytona

Authenticate with Daytona to enable MCP server access.

**CLI:**

```bash
daytona login
```

## Initialize MCP server

Initialize the MCP server with your preferred AI agent. Supported agents include Claude, Cursor, and Windsurf.

**CLI:**

```bash
# Initialize with Claude
daytona mcp init claude

# Initialize with Cursor
daytona mcp init cursor

# Initialize with Windsurf
daytona mcp init windsurf
```

After initialization, open your AI agent application to begin using Daytona features.

## Configure MCP server

Generate MCP configuration for integration with other AI agents.

**CLI:**

```bash
daytona mcp config
```

This command outputs a JSON configuration that you can copy into your agent's settings:

```json
{
  "mcpServers": {
    "daytona-mcp": {
      "command": "daytona",
      "args": ["mcp", "start"],
      "env": {
        "HOME": "${HOME}",
        "PATH": "${HOME}:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin"
      },
      "logFile": "${HOME}/Library/Logs/daytona/daytona-mcp-server.log"
    }
  }
}
```
> **Note:**
> For Windows users, add the following to the `env` field:
> <br />
> ```json
> "APPDATA": "${APPDATA}"
> ```

## Start MCP server

Manually start the MCP server.

**CLI:**

```bash
daytona mcp start
```

## Available tools

MCP server provides the following tools for interacting with Daytona Sandboxes:

- [Sandbox management](../python-sdk/sandboxes.md)
- [File system operations](../python-sdk/file-system-operations.md)
- [Git operations](../python-sdk/git-operations.md)
- [Process and code execution](../python-sdk/process-code-execution.md)
- [Computer use](../python-sdk/computer-use-guide.md)
- [Preview](../python-sdk/preview.md)

## See Also

- [Python SDK](../python-sdk/README.md)
- [TypeScript SDK](../typescript-sdk/README.md)
- [Java SDK](../java-sdk/README.md)
- [Go SDK](../go-sdk/README.md)
- [Ruby SDK](../ruby-sdk/README.md)
