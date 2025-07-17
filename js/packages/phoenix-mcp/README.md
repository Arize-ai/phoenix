<h1 align="center" style="border-bottom: none">
    <div>
        <a href="https://phoenix.arize.com/?utm_medium=github&utm_content=header_img&utm_campaign=phoenix-mcp">
            <picture>
                <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Arize-ai/phoenix-assets/refs/heads/main/logos/Phoenix/phoenix.svg">
                <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Arize-ai/phoenix-assets/refs/heads/main/logos/Phoenix/phoenix-white.svg">
                <img alt="Arize Phoenix logo" src="https://raw.githubusercontent.com/Arize-ai/phoenix-assets/refs/heads/main/logos/Phoenix/phoenix.svg" width="100" />
            </picture>
        </a>
        <br>
        Arize Phoenix MCP Server
    </div>
</h1>

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://github.com/Arize-ai/phoenix/blob/main/js/packages/phoenix-mcp/LICENSE)
<img src="https://badge.mcpx.dev?status=on" title="MCP Enabled"/>
<a href="https://cursor.com/install-mcp?name=phoenix&config=eyJjb21tYW5kIjoibnB4IC15IEBhcml6ZWFpL3Bob2VuaXgtbWNwQGxhdGVzdCAtLWJhc2VVcmwgaHR0cDovL2xvY2FsaG9zdDo2MDA2IC0tYXBpS2V5IHlvdXItYXBpLWtleSJ9"><img src="https://cursor.com/deeplink/mcp-install-dark.svg" alt="Add Arize Phoenix MCP server to Cursor" height=20 /></a>

Phoenix MCP Server is an implementation of the Model Context Protocol for the Arize Phoenix platform. It provides a unified interface to Phoenix's capabilites.

You can use Phoenix MCP Server for:

- **Projects Management**: List and explore projects that organize your observability data
- **Spans & Annotations**: Retrieve spans and their annotations for analysis and debugging
- **Prompts Management**: Create, list, update, and iterate on prompts
- **Datasets**: Explore datasets, and syntesize new examples
- **Experiments**: Pull experiment results and visualize them with the help of an LLM

Don't see a use-case covered? `@arizeai/phoenix-mcp` is [open-source](https://github.com/Arize-ai/phoenix)! Issues and PRs welcome.

## Installation

This MCP server can be used using `npx` and can be directly integrated with clients like Claude Desktop, Cursor, and more.

```json
{
  "mcpServers": {
    "phoenix": {
      "command": "npx",
      "args": [
        "-y",
        "@arizeai/phoenix-mcp@latest",
        "--baseUrl",
        "https://my-phoenix.com",
        "--apiKey",
        "your-api-key"
      ]
    }
  }
}
```

## Development

## Install

This package is managed via a pnpm workspace.

```sh
// From the /js/ directory
pnpm install
pnpm build
```

This only needs to be repeated if dependencies change or there is a change to the phoenix-client.

### Building

To build the project:

```sh
pnpm build
```

### Development Mode

To run in development mode:

```bash
pnpm dev
```

### Debugging

You can build and run the MCP inspector using the following:

```bash
pnpm inspect
```

## Environment Variables

When developing, the server requires the following environment variables:

- `PHOENIX_API_KEY`: Your Phoenix API key
- `PHOENIX_BASE_URL`: The base URL for Phoenix

Make sure to set these in a `.env` file. See `.env.example`.

# License

Apache 2.0
