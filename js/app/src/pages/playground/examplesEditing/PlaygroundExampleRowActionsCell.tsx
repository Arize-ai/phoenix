import { css } from "@emotion/react";
import { useStore } from "zustand";

import {
  Flex,
  Icon,
  IconButton,
  Icons,
  Text,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";
import type { EditableTableStore } from "@phoenix/types/table";

import type { PlaygroundExampleTableRow } from "./playgroundExampleEditing";

/**
 * The leading cell of a row while the examples are being edited: its number
 * and, in place of the play button, a control that removes the example or
 * restores a removed one. Removing a new example drops it outright; an
 * existing one is struck through until the changes are saved.
 */
export function PlaygroundExampleRowActionsCell({
  row,
  position,
  editStore,
}: {
  row: PlaygroundExampleTableRow;
  /** The row's number in the table, from 1. */
  position: number;
  editStore: EditableTableStore<PlaygroundExampleTableRow>;
}) {
  const isDeleted = useStore(editStore, (state) =>
    state.deletedRowIds.has(row.id)
  );
  const isSaving = useStore(editStore, (state) => state.mode === "saving");
  const label = row.isNew ? "new example" : `example ${position}`;

  return (
    <Flex
      direction="column"
      alignItems="center"
      gap="size-100"
      css={rowCellCSS}
    >
      <Text size="S" color="text-500" fontFamily="mono">
        {row.isNew ? "new" : position}
      </Text>
      {isDeleted ? (
        <TooltipTrigger>
          <IconButton
            size="S"
            aria-label={`Restore ${label}`}
            isDisabled={isSaving}
            onPress={() => editStore.getState().restoreRow(row.id)}
          >
            <Icon svg={<Icons.RotateCcw />} />
          </IconButton>
          <Tooltip>
            <TooltipArrow />
            Restore
          </Tooltip>
        </TooltipTrigger>
      ) : (
        <TooltipTrigger>
          <IconButton
            size="S"
            aria-label={`Remove ${label}`}
            isDisabled={isSaving}
            onPress={() => editStore.getState().deleteRow(row.id)}
          >
            <Icon svg={<Icons.Trash />} />
          </IconButton>
          <Tooltip>
            <TooltipArrow />
            Remove when changes are saved
          </Tooltip>
        </TooltipTrigger>
      )}
    </Flex>
  );
}

const rowCellCSS = css`
  padding-top: var(--global-dimension-size-100);
`;
