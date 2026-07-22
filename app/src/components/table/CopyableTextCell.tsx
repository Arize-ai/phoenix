import { CopyToClipboardButton, Text } from "@phoenix/components";
import { Truncate } from "@phoenix/components/core/utility/Truncate";

import { CellWithControlsWrap } from "./CellWithControlsWrap";

export interface CopyableTextCellProps {
  /** The text to display. Renders "--" when null or empty. */
  value?: string | null;
}

/**
 * A table cell displaying truncated text with a copy-to-clipboard control,
 * e.g. for identifiers such as span, trace, and session ids.
 */
export function CopyableTextCell({ value }: CopyableTextCellProps) {
  if (!value) {
    return <>{"--"}</>;
  }
  return (
    <CellWithControlsWrap controls={<CopyToClipboardButton text={value} />}>
      <Truncate>
        <Text>{value}</Text>
      </Truncate>
    </CellWithControlsWrap>
  );
}
