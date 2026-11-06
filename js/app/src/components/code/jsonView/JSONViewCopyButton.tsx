import { CopyToClipboardButton } from "@phoenix/components/core/copy";

import { useJSONView } from "./JSONViewContext";

/**
 * Copies whatever the body is currently showing: the JSON document as
 * rendered, or the table's rows as filtered.
 */
export function JSONViewCopyButton() {
  const { copyText, mode } = useJSONView();
  return (
    <CopyToClipboardButton
      text={copyText}
      tooltipText={mode === "table" ? "Copy shown rows" : "Copy JSON"}
    />
  );
}
