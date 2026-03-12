import { CopyMultiButton } from "@phoenix/components/core/copy";

type SpanActionMenuProps = {
  spanId: string;
  traceId: string;
};

/**
 * A copy button with a dropdown for copying a span's IDs.
 */
export function SpanActionMenu(props: SpanActionMenuProps) {
  const { spanId, traceId } = props;

  return (
    <CopyMultiButton
      items={[
        { key: "span", label: "Span ID", text: spanId },
        { key: "trace", label: "Trace ID", text: traceId },
      ]}
    />
  );
}
