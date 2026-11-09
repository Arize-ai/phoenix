import { css } from "@emotion/react";

import {
  Icon,
  IconButton,
  Icons,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";
import type { EditableTableStore } from "@phoenix/types/table";

import type { PlaygroundExampleTableRow } from "./playgroundExampleEditing";

/**
 * A pencil in a read-mode cell's header strip that begins the edit session
 * and opens this cell's editor in one press, for fixing an example the
 * moment a verdict shows it is wrong. It shows when the row is hovered or
 * holds focus, so a dense table stays quiet; a run in progress holds it
 * disabled, as it does the Edit button.
 */
export function EditExampleCellButton({
  rowId,
  columnId,
  columnLabel,
  position,
  editStore,
  isDisabled,
}: {
  rowId: string;
  columnId: "input" | "output" | "metadata";
  /** The column's caption, for the label. */
  columnLabel: string;
  /** The row's number in the table, from 1. */
  position: number;
  editStore: EditableTableStore<PlaygroundExampleTableRow>;
  isDisabled: boolean;
}) {
  return (
    <TooltipTrigger>
      <IconButton
        size="S"
        css={editCellButtonCSS}
        aria-label={`Edit ${columnLabel} for example ${position}`}
        isDisabled={isDisabled}
        onPress={() =>
          editStore.getState().beginEditing({ cell: { rowId, columnId } })
        }
      >
        <Icon svg={<Icons.Edit />} />
      </IconButton>
      <Tooltip>
        <TooltipArrow />
        {isDisabled
          ? "Edits wait for the run to finish"
          : `Edit this example's ${columnLabel}`}
      </Tooltip>
    </TooltipTrigger>
  );
}

// Present but faded until the row is hovered or something in it has focus,
// then in at the row's pace so the pointer crossing cells does not flicker it.
const editCellButtonCSS = css`
  opacity: 0;
  transition: opacity 0.15s ease;

  tr:hover &,
  tr:focus-within &,
  &[data-focus-visible] {
    opacity: 1;
  }
`;
