import type { Meta, StoryObj } from "@storybook/react";

import { JSONTable } from "@phoenix/components/code";
import {
  expandStringifiedJSON,
  filterFlatJSONEntries,
  toFlatJSONEntries,
} from "@phoenix/utils/jsonUtils";

/**
 * `JSONTable` renders flattened JSON entries as a sortable two column table
 * where every key and value copies on hover.
 *
 * It takes entries rather than a JSON value so that deriving them stays a pure,
 * reusable step — compose `toFlatJSONEntries`, `expandStringifiedJSON`, and
 * `filterFlatJSONEntries` to control what lands in the table.
 * `JSONViewProvider` wires all of that together along with a search field and a
 * view switcher.
 */
const meta: Meta<typeof JSONTable> = {
  title: "Code/JSONTable",
  component: JSONTable,
  parameters: {
    layout: "padded",
  },
};

export default meta;

type Story = StoryObj<typeof JSONTable>;

const ATTRIBUTES = {
  llm: {
    model_name: "gpt-4o",
    invocation_parameters: '{"temperature": 0.7, "max_tokens": 1024}',
    input_messages: [
      { message: { role: "system", content: "You are a helpful assistant." } },
      { message: { role: "user", content: "What is the capital of France?" } },
    ],
    token_count: { prompt: 24, completion: 3, total: 27 },
  },
  metadata: { session_id: "abc-123", user_id: null, tags: [] },
};

/** Flat-mapped keys, sortable by key or value. Hover a cell to copy it. */
export const Default: Story = {
  args: {
    entries: toFlatJSONEntries({ value: ATTRIBUTES }),
  },
};

/**
 * Deriving the entries is the caller's step, so a caller may flatten through
 * stringified JSON first and `llm.invocation_parameters` becomes real keys
 * instead of one opaque string.
 *
 * `JSONViewProvider` deliberately does not do this: the keys it shows are the
 * keys as they were recorded, so each one still addresses the value it came
 * from.
 */
export const Expanded: Story = {
  args: {
    entries: toFlatJSONEntries({ value: expandStringifiedJSON(ATTRIBUTES) }),
  },
};

/**
 * `indexNotation: "dot"` addresses list items the way OpenTelemetry writes its
 * attribute keys — `llm.input_messages.0.message.role` rather than
 * `llm.input_messages[0].message.role` — so a copied key can be pasted straight
 * into instrumentation.
 */
export const DotIndexNotation: Story = {
  args: {
    entries: toFlatJSONEntries({
      value: expandStringifiedJSON(ATTRIBUTES),
      indexNotation: "dot",
    }),
  },
};

/** Filtering is a pure step applied before the table sees the entries. */
export const Filtered: Story = {
  args: {
    entries: filterFlatJSONEntries({
      entries: toFlatJSONEntries({ value: ATTRIBUTES }),
      query: "token",
    }),
  },
};

const LONG_ENTRIES = toFlatJSONEntries({
  value: {
    output: {
      value:
        "Paris is the capital and most populous city of France. Situated on the river Seine, it has been one of Europe's major centres of finance, diplomacy, commerce, culture, fashion, and gastronomy since the 17th century.",
    },
    llm: {
      input_messages: [
        {
          message: {
            role: "system",
            content:
              "You are a helpful assistant. Answer concisely, cite your sources, and say so plainly when you do not know something.",
          },
        },
      ],
    },
  },
});

/**
 * Collapsed rows, the default: every row is a single clipped line, so the keys
 * read down an even column and the table stays scannable.
 */
export const LongValues: Story = {
  args: {
    entries: LONG_ENTRIES,
  },
};

/**
 * Expanded rows: keys wrap at their path boundaries and values wrap over as
 * many lines as they need, so a row grows to show its content in full.
 * `JSONViewRowExpandButton` puts this behind a toggle in the toolbar.
 */
export const ExpandedRows: Story = {
  args: {
    entries: LONG_ENTRIES,
    areRowsExpanded: true,
  },
};

/** Nothing to show. */
export const Empty: Story = {
  args: {
    entries: [],
    emptyMessage: "No matching keys or values",
  },
};
