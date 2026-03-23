
import {
  CopyToClipboardButton,
} from "@phoenix/components";

type CopySpanIDButtonProps = {
  spanId: string;
};

/**
 * Copy SpanId to clipboard
 */
export function CopySpanIDButton(props: CopySpanIDButtonProps) {
  const { spanId } = props;

  return (<CopyToClipboardButton size="S" text={spanId} tooltipText="Copy Span ID"/>
  );
}
