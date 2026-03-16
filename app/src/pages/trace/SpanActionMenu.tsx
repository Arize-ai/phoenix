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
      variant="default"
      items={[
        { name: "Span ID", value: spanId },
        { name: "Trace ID", value: traceId },
      ]}
    />
  );
}
