import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { css } from "@emotion/react";

import { Text, View } from "@phoenix/components";
import { JSONBlock } from "@phoenix/components/code";

import { OverflowCell } from "../src/components/table/OverflowCell";

const meta: Meta<typeof OverflowCell> = {
  title: "Table/OverflowCell",
  component: OverflowCell,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
A cell component that handles overflowing content with an expandable interface.

- Shows a gradient overlay and "expand" button when content exceeds the specified height
- Supports both uncontrolled (internal state) and controlled modes
- When expanded, content becomes scrollable
        `,
      },
    },
  },
  argTypes: {
    height: {
      control: { type: "number" },
      description: "The fixed height of the cell in pixels",
    },
    isExpanded: {
      control: { type: "boolean" },
      description:
        "Controlled expanded state. When provided, the component uses this value instead of internal state.",
    },
    onExpandedChange: {
      action: "expandedChange",
      description: "Callback fired when the expanded state changes",
    },
  },
  decorators: [
    (Story) => (
      <div
        css={css`
          width: 400px;
          border: 1px solid var(--ac-global-border-color-default);
          border-radius: var(--ac-global-rounding-small);
          background: var(--ac-global-background-color-default);
        `}
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof OverflowCell>;

const shortContent =
  "This is a short piece of content that fits within the cell.";

const longContent = `This is a much longer piece of content that will definitely overflow the cell boundaries. 
It contains multiple paragraphs of text to demonstrate how the OverflowCell component handles content 
that exceeds the specified height.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore 
et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut 
aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. 
Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

This final paragraph ensures we have plenty of content to overflow and demonstrate the expand functionality.`;

const jsonContent = JSON.stringify(
  {
    user: {
      id: "12345",
      name: "John Doe",
      email: "john.doe@example.com",
      preferences: {
        theme: "dark",
        notifications: true,
        language: "en-US",
      },
    },
    metadata: {
      created: "2024-01-15T10:30:00Z",
      updated: "2024-01-20T14:45:00Z",
      version: "1.0.0",
    },
    items: [
      { id: 1, name: "Item 1", value: 100 },
      { id: 2, name: "Item 2", value: 200 },
      { id: 3, name: "Item 3", value: 300 },
    ],
  },
  null,
  2
);

/**
 * Default state with content that overflows the cell.
 * Click the "expand" button to reveal all content.
 */
export const Default: Story = {
  args: {
    height: 100,
    children: <Text>{longContent}</Text>,
  },
};

/**
 * Content that fits within the cell height.
 * No expand button is shown since there's no overflow.
 */
export const NoOverflow: Story = {
  args: {
    height: 100,
    children: <Text>{shortContent}</Text>,
  },
};

/**
 * Displaying JSON content that overflows.
 * Common use case for displaying API responses or structured data.
 */
export const JSONContent: Story = {
  args: {
    height: 150,
    children: <JSONBlock value={jsonContent} />,
  },
};

/**
 * A smaller cell height showing more dramatic overflow.
 */
export const SmallHeight: Story = {
  args: {
    height: 60,
    children: <Text>{longContent}</Text>,
  },
};

/**
 * A larger cell that can show more content before overflowing.
 */
export const LargeHeight: Story = {
  args: {
    height: 200,
    children: <Text>{longContent}</Text>,
  },
};

/**
 * Controlled mode where the parent manages the expanded state.
 * Useful when you need to synchronize expansion state across multiple cells.
 */
const ControlledTemplate = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <View>
      <View
        padding="size-100"
        borderBottomWidth="thin"
        borderBottomColor="dark"
      >
        <Text color="text-700">
          Controlled state: {isExpanded ? "Expanded" : "Collapsed"}
        </Text>
      </View>
      <OverflowCell
        height={100}
        isExpanded={isExpanded}
        onExpandedChange={setIsExpanded}
      >
        <Text>{longContent}</Text>
      </OverflowCell>
    </View>
  );
};

export const Controlled: Story = {
  render: () => <ControlledTemplate />,
  parameters: {
    docs: {
      description: {
        story:
          "In controlled mode, pass `isExpanded` and `onExpandedChange` to manage state externally.",
      },
    },
  },
};

/**
 * Multiple OverflowCells in a table-like layout.
 * Demonstrates how cells work in a realistic context.
 */
const TableLayoutTemplate = () => {
  return (
    <div
      css={css`
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1px;
        background: var(--ac-global-border-color-default);
        & > div {
          background: var(--ac-global-background-color-default);
          padding: var(--ac-global-dimension-size-100);
        }
      `}
    >
      <div>
        <Text weight="heavy">Input</Text>
      </div>
      <div>
        <Text weight="heavy">Output</Text>
      </div>
      <div>
        <OverflowCell height={80}>
          <Text>{shortContent}</Text>
        </OverflowCell>
      </div>
      <div>
        <OverflowCell height={80}>
          <Text>{longContent}</Text>
        </OverflowCell>
      </div>
      <div>
        <OverflowCell height={80}>
          <JSONBlock value={jsonContent} />
        </OverflowCell>
      </div>
      <div>
        <OverflowCell height={80}>
          <Text>
            A moderate amount of text that may or may not overflow depending on
            the exact styling applied.
          </Text>
        </OverflowCell>
      </div>
    </div>
  );
};

export const TableLayout: Story = {
  render: () => <TableLayoutTemplate />,
  decorators: [
    (Story) => (
      <div
        css={css`
          width: 600px;
          border: 1px solid var(--ac-global-border-color-default);
          border-radius: var(--ac-global-rounding-small);
          overflow: hidden;
        `}
      >
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story:
          "Multiple OverflowCells in a grid layout, simulating a table with expandable cells.",
      },
    },
  },
};

/**
 * Content that starts expanded (controlled mode).
 */
export const InitiallyExpanded: Story = {
  args: {
    height: 100,
    isExpanded: true,
    children: <Text>{longContent}</Text>,
  },
  parameters: {
    docs: {
      description: {
        story:
          "When `isExpanded` is set to `true`, the cell starts in its expanded state showing all content.",
      },
    },
  },
};
