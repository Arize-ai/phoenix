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

<p align="center">
    <a href="https://www.npmjs.com/package/@arizeai/phoenix-mcp">
        <img src="https://img.shields.io/npm/v/%40arizeai%2Fphoenix-mcp" alt="NPM Version">
    </a>
    <a href="https://github.com/Arize-ai/phoenix/blob/main/js/packages/phoenix-mcp/LICENSE">
        <img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg" alt="License">
    </a>
    <img src="https://badge.mcpx.dev?status=on" title="MCP Enabled"/>
    <a href="https://cursor.com/install-mcp?name=phoenix&config=eyJjb21tYW5kIjoibnB4IC15IEBhcml6ZWFpL3Bob2VuaXgtbWNwQGxhdGVzdCAtLWJhc2VVcmwgaHR0cDovL2xvY2FsaG9zdDo2MDA2IC0tYXBpS2V5IHlvdXItYXBpLWtleSJ9">
        <img src="https://cursor.com/deeplink/mcp-install-dark.svg" alt="Add Arize Phoenix MCP server to Cursor" height=20 />
    </a>
    <img referrerpolicy="no-referrer-when-downgrade" src="https://static.scarf.sh/a.png?x-pxid=8e8e8b34-7900-43fa-a38f-1f070bd48c64&page=js/packages/phoenix-mcp/README.md" />
</p>

Phoenix MCP Server is an implementation of the [Model Context Protocol](https://modelcontextprotocol.io/) for the Arize Phoenix platform. It provides a unified interface to Phoenix's capabilities, enabling AI coding assistants like Claude, Cursor, Codex, and others to interact with your observability data.

You can use Phoenix MCP Server for:

- **Projects Management**: List and explore projects that organize your observability data
- **Traces & Spans**: Retrieve traces, spans, and annotation configs for analysis and debugging
- **Sessions**: Explore conversation flows and session-level data
- **Prompts Management**: Create, list, update, version, and tag prompts
- **Datasets**: Explore datasets, view examples, and add new examples
- **Experiments**: Pull experiment results, list experiments per dataset, and inspect run data

Don't see a use-case covered? `@arizeai/phoenix-mcp` is [open-source](https://github.com/Arize-ai/phoenix)! Issues and PRs welcome.

## Installation

This MCP server can be used with `npx` and can be directly integrated with clients like Claude Desktop, Cursor, and more.

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
- `PHOENIX_HOST`: The base URL for Phoenix
- `PHOENIX_PROJECT`: Optional default project for project-scoped tools
- `PHOENIX_CLIENT_HEADERS`: Optional JSON-encoded request headers

Make sure to set these in a `.env` file. See `.env.example`.

## Tool Coverage

The MCP server provides 27 tools covering all major Phoenix workflows:

### Projects
| Tool | Description |
| ---- | ----------- |
| `list-projects` | List all projects |
| `get-project` | Get a project by name or ID |

### Traces & Spans
| Tool | Description |
| ---- | ----------- |
| `list-traces` | List traces for a project (newest first) |
| `get-trace` | Get a single trace by trace ID |
| `get-spans` | Get spans with filtering (by kind, status, name, trace ID) |
| `get-span-annotations` | Get annotations for a list of span IDs |

### Sessions
| Tool | Description |
| ---- | ----------- |
| `list-sessions` | List sessions for a project |
| `get-session` | Get a session by GlobalID or session_id |

### Datasets
| Tool | Description |
| ---- | ----------- |
| `list-datasets` | List all datasets |
| `get-dataset` | Get dataset metadata by name or ID |
| `get-dataset-examples` | Get examples from a dataset |
| `get-dataset-experiments` | List experiments run on a dataset |
| `add-dataset-examples` | Add examples to an existing dataset |

### Experiments
| Tool | Description |
| ---- | ----------- |
| `list-experiments-for-dataset` | List experiments for a given dataset |
| `get-experiment-by-id` | Get experiment with metadata and results |

### Prompts
| Tool | Description |
| ---- | ----------- |
| `list-prompts` | List all prompts |
| `get-prompt` | Get a prompt (supports identifier, tag, or version ID) |
| `get-latest-prompt` | Get the latest version of a prompt |
| `get-prompt-by-identifier` | Get a prompt's latest version by name or ID |
| `get-prompt-version` | Get a specific prompt version by version ID |
| `upsert-prompt` | Create or update a prompt with template and config |
| `list-prompt-versions` | List all versions for a prompt |
| `get-prompt-version-by-tag` | Get a prompt version by tag name |
| `list-prompt-version-tags` | List all tags for a prompt version |
| `add-prompt-version-tag` | Add a tag to a prompt version |

### Other
| Tool | Description |
| ---- | ----------- |
| `list-annotation-configs` | List annotation configs (labels, scores, types) |
| `phoenix-support` | Get help with Phoenix and OpenInference |

For Phoenix documentation search, use the separate Phoenix Docs MCP server instead of this package.

## Community

Join our community to connect with thousands of AI builders:

- 🌍 Join our [Slack community](https://join.slack.com/t/arize-ai/shared_invite/zt-3r07iavnk-ammtATWSlF0pSrd1DsMW7g).
- 📚 Read the [Phoenix documentation](https://arize.com/docs/phoenix).
- 💡 Ask questions and provide feedback in the _#phoenix-support_ channel.
- 🌟 Leave a star on our [GitHub](https://github.com/Arize-ai/phoenix).
- 🐞 Report bugs with [GitHub Issues](https://github.com/Arize-ai/phoenix/issues).
- 𝕏 Follow us on [𝕏](https://twitter.com/ArizePhoenix).
- 🗺️ Check out our [roadmap](https://github.com/orgs/Arize-ai/projects/45) to see where we're heading next.

## License

Apache 2.0
