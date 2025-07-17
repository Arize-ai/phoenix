---
description: >-
  Phoenix MCP Server is an implementation of the Model Context Protocol for the
  Arize Phoenix platform. It provides a unified interface to Phoenix's
  capabilites.
---

# Phoenix MCP Server

Phoenix MCP Server supports:

* **Prompts Management**: Create, list, update, and iterate on prompts
* **Datasets**: Explore datasets, and synthesize new examples
* **Experiments**: Pull experiment results and visualize them with the help of an LLM

## Connecting the Phoenix MCP Server

{% tabs %}
{% tab title="Connect via Cursor" %}
#### Via Cursor Deeplink:

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/install-mcp?name=phoenix\&config=eyJjb21tYW5kIjoibnB4IC15IEBhcml6ZWFpL3Bob2VuaXgtbWNwQGxhdGVzdCAtLWJhc2VVcmwgaHR0cHM6Ly9hcHAucGhvZW5peC5hcml6ZS5jb20gLS1hcGlLZXkgIn0%3D)

#### Manually:

From the Cursor Settings page, navigate to the MCP section, and click "Add new global MCP server"

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/mcp-1.png" alt=""><figcaption></figcaption></figure>

Add the following code to your MCP config file:

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
```

Replacing:

* [https://my-phoenix.com](https://my-phoenix.com) with your Phoenix collector endpoint
* `your-api-key` with your Phoenix API key

After saving your config file, you should see the Phoenix server enabled:

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/mcp-2.png" alt=""><figcaption></figcaption></figure>

You can access Phoenix prompts, experiments, and datasets through Cursor!
{% endtab %}

{% tab title="Connect via Claude Desktop" %}
From the Claude Desktop settings window, navigate to the Developer Section, and click "Edit Config"

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/mcp-claude-desktop.png" alt=""><figcaption></figcaption></figure>

Open your config file and add the following code:

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
```

Replacing:

* [https://my-phoenix.com](https://my-phoenix.com) with your Phoenix collector endpoint
* `your-api-key` with your Phoenix API key

Save your file and relaunch Claude Desktop. You should now see your new tools ready for use in Claude!

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/mcp-tools-in-claude.png" alt=""><figcaption></figcaption></figure>
{% endtab %}

{% tab title="Manually Connect" %}
Add the following code to your MCP config file:

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
```

Replacing:

* [https://my-phoenix.com](https://my-phoenix.com) with your Phoenix collector endpoint
* `your-api-key` with your Phoenix API key
{% endtab %}
{% endtabs %}

## Using the Phoenix MCP Server

The MCP server can be used to interact with Prompts, Experiments, and Datasets. It can be used to retrieve information about each item, and can create and update Prompts.

Some good questions to try:

1. `What prompts do I have in Phoenix?`
2. `Create a new prompt in Phoenix that classifies user intent`
3. `Update my classification prompt in Phoenix with these new options`
4. `Summarize the Phoenix experiments run on my agent inputs dataset`
5. `Visualize the results of my jailbreak dataset experiments in Phoenix`

## Hoping to see additional functionality?

`@arizeai/phoenix-mcp` is [open-source](https://github.com/Arize-ai/phoenix)! Issues and PRs welcome.

{% @github-files/github-code-block url="https://github.com/Arize-ai/phoenix/tree/main/js/packages/phoenix-mcp" %}
