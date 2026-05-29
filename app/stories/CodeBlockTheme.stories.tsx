import type { Meta, StoryObj } from "@storybook/react";

import { Flex, Text, View } from "@phoenix/components";
import {
  BashBlock,
  JSONBlock,
  PythonBlock,
  TypeScriptBlock,
} from "@phoenix/components/code";

/**
 * Code blocks are syntax highlighted with the Pierre theme (`@pierre/theme`) —
 * the same theme source used to render diffs — so code and diffs share a
 * consistent light/dark appearance across the app.
 *
 * Tip: switch the toolbar theme selector to "both" to view the light and dark
 * variants side by side.
 */
const meta: Meta = {
  title: "Code/CodeBlockTheme",
  parameters: {
    layout: "padded",
  },
};

export default meta;

type Story = StoryObj;

const PYTHON_SAMPLE = `from phoenix.otel import register

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

const TYPESCRIPT_SAMPLE = `import { createClient } from "@arizeai/phoenix-client";

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

const JSON_SAMPLE = JSON.stringify(
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

const BASH_SAMPLE = `# Install the Phoenix server
pip install arize-phoenix

# Launch the app
phoenix serve --port 6006`;

/** Python syntax highlighting under the Pierre theme. */
export const Python: Story = {
  render: () => (
    <View width="640px">
      <PythonBlock value={PYTHON_SAMPLE} />
    </View>
  ),
};

/** TypeScript syntax highlighting under the Pierre theme. */
export const TypeScript: Story = {
  render: () => (
    <View width="640px">
      <TypeScriptBlock value={TYPESCRIPT_SAMPLE} />
    </View>
  ),
};

/** JSON syntax highlighting under the Pierre theme. */
export const Json: Story = {
  name: "JSON",
  render: () => (
    <View width="640px">
      <JSONBlock value={JSON_SAMPLE} />
    </View>
  ),
};

/** Shell syntax highlighting under the Pierre theme. */
export const Bash: Story = {
  render: () => (
    <View width="640px">
      <BashBlock value={BASH_SAMPLE} />
    </View>
  ),
};

/**
 * All supported languages together. Combine with the "both" theme toolbar
 * option to confirm the light and dark palettes stay consistent.
 */
export const AllLanguages: Story = {
  render: () => (
    <Flex direction="column" gap="size-200" width="640px">
      <Text weight="heavy">Python</Text>
      <PythonBlock value={PYTHON_SAMPLE} />
      <Text weight="heavy">TypeScript</Text>
      <TypeScriptBlock value={TYPESCRIPT_SAMPLE} />
      <Text weight="heavy">JSON</Text>
      <JSONBlock value={JSON_SAMPLE} />
      <Text weight="heavy">Bash</Text>
      <BashBlock value={BASH_SAMPLE} />
    </Flex>
  ),
};
