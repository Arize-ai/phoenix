import type { Meta, StoryFn } from "@storybook/react";

import { Flex, Text, View } from "@phoenix/components";
import { JSONBlock } from "@phoenix/components/code/JSONBlock";
import { JSONPreview } from "@phoenix/components/code/JSONPreview";
import { truncateJsonPreview } from "@phoenix/components/code/truncateJsonPreview";

const meta: Meta<typeof JSONPreview> = {
  title: "Code/JSONPreview",
  component: JSONPreview,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Read-only JSON as a highlighted `<pre>` in the code blocks' colors, without mounting an editor. Use it for table cells that only show a value; use `JSONBlock` where the reader needs folding, selection, or a full document.",
      },
    },
  },
};

export default meta;

const example = {
  input: {
    messages: [
      { role: "system", content: "You are a concise support assistant." },
      { role: "user", content: "How do I rotate my API key without downtime?" },
    ],
  },
  output: {
    text: "Create a second key, deploy it, then revoke the old one.",
    finish_reason: "stop",
  },
  metadata: {
    model: "gpt-5.6-luna",
    latency_ms: 812,
    cached: false,
    tags: ["support", "api-keys"],
    reviewer: null,
  },
};

const json = JSON.stringify(example, null, 2);

const Frame = ({ children }: { children: React.ReactNode }) => (
  <View
    borderWidth="thin"
    borderColor="default"
    borderRadius="medium"
    padding="size-200"
    width="480px"
  >
    {children}
  </View>
);

/** The default rendering: every token kind the tokenizer knows. */
export const Default: StoryFn<typeof JSONPreview> = () => (
  <Frame>
    <JSONPreview value={json} />
  </Frame>
);

/**
 * A long document cut by `truncateJsonPreview` at a line break, with a note
 * about what is left. The note is plain text, so it renders in the body color
 * rather than as a JSON token.
 */
export const Truncated: StoryFn<typeof JSONPreview> = () => {
  const long = JSON.stringify(
    {
      spans: Array.from({ length: 40 }, (_, index) => ({
        id: `span-${index}`,
        name: index % 2 ? "retrieve_documents" : "generate_answer",
        latency_ms: 40 + index * 7,
      })),
    },
    null,
    2
  );
  const preview = truncateJsonPreview(long, 600);
  return (
    <Frame>
      <JSONPreview value={preview.text} />
    </Frame>
  );
};

/**
 * The preview beside the editor it stands in for. Colors match; the preview
 * has no gutter, folding, or selection.
 */
export const BesideEditor: StoryFn<typeof JSONPreview> = () => (
  <Flex direction="row" gap="size-300" alignItems="start">
    <Flex direction="column" gap="size-100">
      <Text size="S" color="text-500">
        JSONPreview
      </Text>
      <Frame>
        <JSONPreview value={json} />
      </Frame>
    </Flex>
    <Flex direction="column" gap="size-100">
      <Text size="S" color="text-500">
        JSONBlock
      </Text>
      <Frame>
        <JSONBlock
          value={json}
          basicSetup={{ lineNumbers: false, foldGutter: false }}
        />
      </Frame>
    </Flex>
  </Flex>
);
