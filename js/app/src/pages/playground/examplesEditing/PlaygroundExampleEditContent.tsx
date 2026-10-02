import { css } from "@emotion/react";

import { Text } from "@phoenix/components";
import { DynamicContent } from "@phoenix/components/DynamicContent";
import { CellTop } from "@phoenix/components/table";

/**
 * An example cell's content while the table is being edited: the column's
 * caption and the value, clipped to the row. The whole cell is the edit
 * trigger, so this carries no controls of its own — no expand, no open
 * example — and the full value is a press away in the editor.
 */
export function PlaygroundExampleEditContent({
  label,
  value,
  height,
}: {
  label: string;
  value: unknown;
  /** The content area's height, matching the read-mode cell's. */
  height: number;
}) {
  return (
    <div css={contentCSS}>
      <CellTop>
        <Text color="text-500">{label}</Text>
      </CellTop>
      <div css={valueCSS} style={{ height }}>
        <DynamicContent value={value} />
      </div>
    </div>
  );
}

const contentCSS = css`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
`;

// Clips where the read-mode cell would offer Expand, fading the last lines
// so a cut-off value reads as such.
const valueCSS = css`
  overflow: hidden;
  padding: var(--global-dimension-size-100) var(--global-table-cell-padding-x);
  mask-image: linear-gradient(to bottom, #000 calc(100% - 24px), transparent);
`;
