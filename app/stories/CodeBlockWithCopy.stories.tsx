import type { Meta, StoryObj } from "@storybook/react";

import { CopyField, CopyInput, Flex, Label, Text } from "@phoenix/components";
import {
  BashBlockWithCopy,
  JSONBlockWithCopy,
  PythonBlockWithCopy,
  TomlBlockWithCopy,
  TypeScriptBlockWithCopy,
} from "@phoenix/components/code";

/**
 * Read-only code blocks with an embedded copy-to-clipboard button.
 *
 * These share their surface treatment with the readonly text field
 * (CopyField + CopyInput) — same background, font size, rounding, and hover
 * affordance — so copyable code and copyable text read as one family of
 * controls. Use the "Alongside Copy Field" story to confirm the two stay
 * visually consistent.
 */
const meta: Meta = {
  title: "Code/CodeBlockWithCopy",
  parameters: {
    layout: "padded",
  },
};

export default meta;

type Story = StoryObj;

const BASH_SAMPLE =
  "px setup mcp --agent claude  # or codex, gemini, cursor, opencode, vscode";

const JSON_SAMPLE = JSON.stringify(
  {
    mcpServers: {
      phoenix: {
        url: "https://phoenix.example.com/mcp",
      },
    },
  },
  null,
  2
);

const TOML_SAMPLE = [
  "[mcp_servers.phoenix]",
  'url = "https://phoenix.example.com/mcp"',
  'bearer_token_env_var = "PHOENIX_API_KEY"',
].join("\n");

const PYTHON_SAMPLE = `from phoenix.otel import register

tracer_provider = register(
    project_name="my-app",
    auto_instrument=True,
)`;

const TYPESCRIPT_SAMPLE = `import { createClient } from "@arizeai/phoenix-client";

const client = createClient({ baseUrl: "http://localhost:6006" });`;

/** A single-line shell command — the most common copyable snippet. */
export const Bash: Story = {
  render: () => (
    <Flex direction="column" width="640px">
      <BashBlockWithCopy value={BASH_SAMPLE} />
    </Flex>
  ),
};

/** A multi-line JSON config, e.g. an MCP client configuration. */
export const Json: Story = {
  name: "JSON",
  render: () => (
    <Flex direction="column" width="640px">
      <JSONBlockWithCopy value={JSON_SAMPLE} />
    </Flex>
  ),
};

/** A TOML config, e.g. for ~/.codex/config.toml. */
export const Toml: Story = {
  name: "TOML",
  render: () => (
    <Flex direction="column" width="640px">
      <TomlBlockWithCopy value={TOML_SAMPLE} />
    </Flex>
  ),
};

/** A multi-line Python snippet, e.g. tracing onboarding code. */
export const Python: Story = {
  render: () => (
    <Flex direction="column" width="640px">
      <PythonBlockWithCopy value={PYTHON_SAMPLE} />
    </Flex>
  ),
};

/** A multi-line TypeScript snippet. */
export const TypeScript: Story = {
  render: () => (
    <Flex direction="column" width="640px">
      <TypeScriptBlockWithCopy value={TYPESCRIPT_SAMPLE} />
    </Flex>
  ),
};

/**
 * All the copyable block languages together. Combine with the "both" theme
 * toolbar option to confirm light and dark stay consistent.
 */
export const AllLanguages: Story = {
  render: () => (
    <Flex direction="column" gap="size-200" width="640px">
      <Text weight="heavy">Bash</Text>
      <BashBlockWithCopy value={BASH_SAMPLE} />
      <Text weight="heavy">JSON</Text>
      <JSONBlockWithCopy value={JSON_SAMPLE} />
      <Text weight="heavy">TOML</Text>
      <TomlBlockWithCopy value={TOML_SAMPLE} />
      <Text weight="heavy">Python</Text>
      <PythonBlockWithCopy value={PYTHON_SAMPLE} />
      <Text weight="heavy">TypeScript</Text>
      <TypeScriptBlockWithCopy value={TYPESCRIPT_SAMPLE} />
    </Flex>
  ),
};

/**
 * The code blocks next to a readonly CopyField, mirroring the MCP settings
 * page. The surface color, font size, and rounding should match so the page
 * reads as one consistent set of copyable fields.
 */
export const AlongsideCopyField: Story = {
  render: () => (
    <Flex direction="column" gap="size-200" width="640px">
      <CopyField value="https://phoenix.example.com/mcp">
        <Label>MCP Server URL</Label>
        <CopyInput />
        <Text slot="description">
          A readonly text field with copy for comparison
        </Text>
      </CopyField>
      <BashBlockWithCopy
        value={
          "claude mcp add --transport http phoenix https://phoenix.example.com/mcp"
        }
      />
      <JSONBlockWithCopy value={JSON_SAMPLE} />
      <TomlBlockWithCopy value={TOML_SAMPLE} />
    </Flex>
  ),
};
