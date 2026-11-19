import type { Meta, StoryObj } from "@storybook/react";

import {
  CopyField,
  CopyInput,
  Flex,
  Label,
  Text,
  View,
} from "@phoenix/components";
import {
  BashBlock,
  BashBlockWithCopy,
  JSONBlock,
  JSONBlockWithCopy,
  PythonBlock,
  PythonBlockWithCopy,
  TomlBlockWithCopy,
  TypeScriptBlock,
  TypeScriptBlockWithCopy,
} from "@phoenix/components/code";

/**
 * Read-only, syntax-highlighted code blocks, with and without an embedded
 * copy-to-clipboard button.
 *
 * The copyable blocks (`*BlockWithCopy`) share their surface treatment with the readonly text field
 * (CopyField + CopyInput) — same background, font size, rounding, and hover
 * affordance — so copyable code and copyable text read as one family of
 * controls. Use the "Alongside Copy Field" story to confirm the two stay
 * visually consistent.
 *
 * Every block is highlighted with the Pierre theme (`@pierre/theme`) — the
 * same theme source used to render diffs — so code and diffs share a
 * consistent light/dark appearance across the app. The "Theme" stories show
 * the plain blocks with longer samples that exercise more of the palette.
 *
 * Tip: switch the toolbar theme selector to "both" to view the light and dark
 * variants side by side.
 */
const meta: Meta = {
  title: "Design System/Code/Code Block",
  tags: ["legacy", "unreviewed"],
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

const THEME_PYTHON_SAMPLE = `from phoenix.otel import register

# Register a tracer provider for the project
tracer_provider = register(
    project_name="my-app",
    auto_instrument=True,
)


class Agent:
    """A minimal example agent."""

    def __init__(self, name: str, retries: int = 3) -> None:
        self.name = name
        self.retries = retries

    def run(self, prompt: str) -> dict[str, float]:
        score = 0.95 if prompt else 0.0
        return {"name": self.name, "score": score}
`;

const THEME_TYPESCRIPT_SAMPLE = `import { createClient } from "@arizeai/phoenix-client";

type SpanStatus = "OK" | "ERROR" | "UNSET";

interface Span {
  id: string;
  name: string;
  status: SpanStatus;
  latencyMs: number;
}

const client = createClient({ baseUrl: "http://localhost:6006" });

export async function fetchSpans(projectName: string): Promise<Span[]> {
  const spans = await client.spans.list({ projectName });
  return spans.filter((span) => span.status === "ERROR");
}
`;

const THEME_JSON_SAMPLE = JSON.stringify(
  {
    name: "my-app",
    enabled: true,
    retries: 3,
    latency_ms: 124.5,
    tags: ["llm", "agent", "production"],
    metadata: { region: "us-east-1", owner: null },
  },
  null,
  2
);

const THEME_BASH_SAMPLE = `# Install the Phoenix server
pip install arize-phoenix

# Launch the app
phoenix serve --port 6006`;

/** Python syntax highlighting under the Pierre theme. */
export const ThemePython: Story = {
  name: "Theme: Python",
  render: () => (
    <View width="640px">
      <PythonBlock value={THEME_PYTHON_SAMPLE} />
    </View>
  ),
};

/** TypeScript syntax highlighting under the Pierre theme. */
export const ThemeTypeScript: Story = {
  name: "Theme: TypeScript",
  render: () => (
    <View width="640px">
      <TypeScriptBlock value={THEME_TYPESCRIPT_SAMPLE} />
    </View>
  ),
};

/** JSON syntax highlighting under the Pierre theme. */
export const ThemeJson: Story = {
  name: "Theme: JSON",
  render: () => (
    <View width="640px">
      <JSONBlock value={THEME_JSON_SAMPLE} />
    </View>
  ),
};

/** Shell syntax highlighting under the Pierre theme. */
export const ThemeBash: Story = {
  name: "Theme: Bash",
  render: () => (
    <View width="640px">
      <BashBlock value={THEME_BASH_SAMPLE} />
    </View>
  ),
};

/**
 * All plain (non-copyable) languages together. Combine with the "both" theme
 * toolbar option to confirm the light and dark palettes stay consistent.
 */
export const ThemeAllLanguages: Story = {
  name: "Theme: All Languages",
  render: () => (
    <Flex direction="column" gap="size-200" width="640px">
      <Text weight="heavy">Python</Text>
      <PythonBlock value={THEME_PYTHON_SAMPLE} />
      <Text weight="heavy">TypeScript</Text>
      <TypeScriptBlock value={THEME_TYPESCRIPT_SAMPLE} />
      <Text weight="heavy">JSON</Text>
      <JSONBlock value={THEME_JSON_SAMPLE} />
      <Text weight="heavy">Bash</Text>
      <BashBlock value={THEME_BASH_SAMPLE} />
    </Flex>
  ),
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: Story = {
  tags: ["!dev", "!autodocs"],
  // A little more stage so the copy button clears the code.
  parameters: { thumbnail: { scale: 0.75 } },
  render: () => (
    <Flex direction="column" width="100%">
      <PythonBlockWithCopy value={PYTHON_SAMPLE} />
    </Flex>
  ),
};
