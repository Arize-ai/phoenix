import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { Card, Counter, Flex } from "@phoenix/components";
import {
  JSONViewBody,
  JSONViewProvider,
  JSONViewToolbar,
  useJSONView,
} from "@phoenix/components/code";

/**
 * A JSON view renders any JSON value two ways behind a segmented control:
 *
 * - **Table** — the value flat-mapped to `key` / `value` rows, keyed exactly as
 *   the value was recorded. The rows are searchable and sortable, every key and
 *   value cell copies on hover, and every row is clipped to a single line so
 *   the keys can be scanned — a toggle wraps them out in full.
 * - **JSON** — a pretty-printed document, with an optional "Raw" / "Un-nested"
 *   control that un-nests stringified JSON into a single tree.
 *
 * Un-nesting is offered on the document alone. It would rewrite the table's
 * keys into paths that were never recorded — an `output.value` holding a
 * serialized list would become `output.value.0` — and a key you cannot paste
 * back into instrumentation is worse than an opaque one.
 *
 * `JSONViewProvider` owns the state and every control reads it through
 * `useJSONView`, so the parts can be placed wherever a layout needs them: a
 * toolbar above the content, or — as the span detail "Attributes" card does —
 * the controls in a card header with nothing but the content below.
 *
 * The view is composed from pure functions in `@phoenix/utils/jsonUtils`
 * (`expandStringifiedJSON`, `toFlatJSONEntries`, `filterFlatJSONEntries`), so
 * the same flattening can be reused anywhere without the components.
 */
const meta: Meta<typeof JSONViewProvider> = {
  title: "Code/JSONView",
  component: JSONViewProvider,
  parameters: {
    layout: "padded",
  },
};

export default meta;

type Story = StoryObj<typeof JSONViewProvider>;

const SPAN_ATTRIBUTES = JSON.stringify({
  openinference: { span: { kind: "LLM" } },
  llm: {
    model_name: "gpt-4o",
    provider: "openai",
    invocation_parameters: '{"temperature": 0.7, "max_tokens": 1024}',
    input_messages: [
      { message: { role: "system", content: "You are a helpful assistant." } },
      { message: { role: "user", content: "What is the capital of France?" } },
    ],
    output_messages: [{ message: { role: "assistant", content: "Paris." } }],
    token_count: { prompt: 24, completion: 3, total: 27 },
  },
  input: { value: "What is the capital of France?", mime_type: "text/plain" },
  output: { value: "Paris.", mime_type: "text/plain" },
  metadata: '{"session_id": "abc-123", "user_id": null}',
});

/**
 * The controls stacked above the content — the arrangement to reach for outside
 * a card, and all it takes is putting the two parts in a column.
 */
function StackedJSONView() {
  return (
    <Flex direction="column" gap="size-100">
      <Flex direction="row" gap="size-100" alignItems="center">
        <JSONViewToolbar searchPlaceholder="Search attributes" />
      </Flex>
      <JSONViewBody />
    </Flex>
  );
}

const stacked: Story["render"] = (args) => (
  <JSONViewProvider {...args}>
    <StackedJSONView />
  </JSONViewProvider>
);

/** The default JSON document. Switch to Table to see the flattened keys. */
export const Default: Story = {
  render: stacked,
  args: { value: SPAN_ATTRIBUTES },
};

/** Opening straight into the table view of flat-mapped keys. */
export const TableMode: Story = {
  render: stacked,
  args: { value: SPAN_ATTRIBUTES, defaultMode: "table" },
};

/**
 * `indexNotation: "dot"` addresses list items the way OpenTelemetry writes its
 * attribute keys — `llm.input_messages.0.message.role` rather than
 * `llm.input_messages[0].message.role` — so a copied key can be pasted straight
 * into instrumentation. The span detail "Attributes" card uses this.
 */
export const DotIndexNotation: Story = {
  render: stacked,
  args: {
    value: SPAN_ATTRIBUTES,
    defaultMode: "table",
    indexNotation: "dot",
  },
};

/** A plain object works just as well as a JSON string. */
export const ObjectValue: Story = {
  render: stacked,
  args: {
    value: {
      status: "ok",
      retries: 0,
      tags: ["prod", "us-east-1"],
      config: { nested: { deeply: { enabled: true } } },
      empty: {},
    },
  },
};

/**
 * Nothing to un-nest — no stringified JSON anywhere, so the "Raw" / "Un-nested"
 * control is not offered.
 */
export const WithoutStringifiedJSON: Story = {
  render: stacked,
  args: { value: { a: 1, b: "two", c: [3, 4] } },
};

/** A value that is not JSON is shown verbatim, with no view to switch to. */
export const NotJSON: Story = {
  render: stacked,
  args: { value: "this is not JSON at all" },
};

/**
 * The composed arrangement, as the span detail "Attributes" card uses it: the
 * search, un-nest, copy and view controls live in the card header, the body
 * holds nothing but the content, and a quiet counter sits beside the title.
 */
function AttributesCard({ defaultOpen = true }: { defaultOpen?: boolean }) {
  const { entries } = useJSONView();
  const [isCollapsed, setIsCollapsed] = useState(!defaultOpen);
  return (
    <Card
      title="Attributes"
      titleExtra={<Counter variant="quiet">{entries.length}</Counter>}
      interactiveTitle
      collapseButtonLabel="Attributes"
      collapsible
      defaultOpen={defaultOpen}
      onCollapseChange={setIsCollapsed}
      // searching, copying and switching views have nothing to act on while
      // the body is hidden
      extra={
        isCollapsed ? null : (
          <JSONViewToolbar searchPlaceholder="Search attributes" />
        )
      }
    >
      <JSONViewBody emptyMessage="This span has no attributes" />
    </Card>
  );
}

export const InCard: Story = {
  render: (args) => (
    <JSONViewProvider {...args}>
      <AttributesCard />
    </JSONViewProvider>
  ),
  args: {
    value: SPAN_ATTRIBUTES,
    defaultMode: "table",
    indexNotation: "dot",
  },
};

/**
 * Collapsed to start, as the span Info tab appends it below the cards for the
 * span's own kind. The counter still reports the span's attributes, and the
 * controls stay out of the header until there is a body for them to act on.
 */
export const InCardCollapsed: Story = {
  render: (args) => (
    <JSONViewProvider {...args}>
      <AttributesCard defaultOpen={false} />
    </JSONViewProvider>
  ),
  args: {
    value: SPAN_ATTRIBUTES,
    defaultMode: "table",
    indexNotation: "dot",
  },
};
