import { Flex } from "@phoenix/components";

import { JSONViewCopyButton } from "./JSONViewCopyButton";
import { JSONViewExpandSelect } from "./JSONViewExpandSelect";
import { JSONViewModeSelect } from "./JSONViewModeSelect";
import { JSONViewRowExpandButton } from "./JSONViewRowExpandButton";
import { JSONViewSearch } from "./JSONViewSearch";

/**
 * The JSON view's controls in their standard order — search, the control that
 * belongs to whichever view is showing, the view switcher, then copy —
 * matching how the other span detail cards arrange their headers, where the
 * mode select comes first and copy sits last.
 *
 * Un-nesting belongs to the JSON document and the row toggle to the table, so
 * only ever one of them is rendered and the toolbar keeps a steady shape as
 * the view changes.
 *
 * Built for a card's `extra` slot rather than the card body, so the content
 * below it is only the content. Drop in the individual parts instead when a
 * header needs a different arrangement.
 */
export function JSONViewToolbar({
  searchPlaceholder,
}: {
  /** Placeholder for the table view's search field */
  searchPlaceholder?: string;
}) {
  return (
    <Flex direction="row" gap="size-100" alignItems="center">
      <JSONViewSearch placeholder={searchPlaceholder} />
      <JSONViewExpandSelect />
      <JSONViewRowExpandButton />
      <JSONViewModeSelect />
      <JSONViewCopyButton />
    </Flex>
  );
}
