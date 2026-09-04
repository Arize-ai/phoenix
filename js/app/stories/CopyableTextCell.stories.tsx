import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";

import { CopyableTextCell } from "@phoenix/components/table/CopyableTextCell";
import {
  expandableRowsTableCSS,
  tableCSS,
} from "@phoenix/components/table/styles";

const meta: Meta<typeof CopyableTextCell> = {
  title: "Table/CopyableTextCell",
  component: CopyableTextCell,
};

export default meta;

type Story = StoryObj<typeof CopyableTextCell>;

export const Default: Story = {
  args: {
    value: "8ba22f7b2ee5d0f4",
  },
};

/** Long values truncate; the copy control still copies the full text. */
export const LongValue: Story = {
  args: {
    value: "user-3f7b2ee5d0f48ba2-very-long-identifier-that-truncates",
  },
};

const narrowTableCSS = css(tableCSS, expandableRowsTableCSS, {
  width: 240,
  tableLayout: "fixed",
});

/**
 * The cell takes its row height from the table it sits in. Both tables here are
 * the same width, so the only difference is the `data-rows` state.
 */
export const InTable: StoryObj = {
  render: () => {
    const value = "user-3f7b2ee5d0f48ba2-very-long-identifier-that-truncates";
    return (
      <>
        {(["collapsed", "expanded"] as const).map((rows) => (
          <table key={rows} css={narrowTableCSS} data-rows={rows}>
            <thead>
              <tr>
                <th>{rows}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <CopyableTextCell value={value} />
                </td>
              </tr>
            </tbody>
          </table>
        ))}
      </>
    );
  },
};

/** Null or empty values render a "--" placeholder. */
export const Empty: Story = {
  args: {
    value: null,
  },
};
