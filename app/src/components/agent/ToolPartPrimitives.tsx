import { CopyToClipboardButton } from "@phoenix/components";

/**
 * A label row for a tool part section (e.g., "Command", "Output", "Error").
 */
export function ToolPartLabel({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "error";
}) {
  return (
    <div className="tool-part__line">
      <span className="tool-part__label" data-tone={tone}>
        {children}
      </span>
    </div>
  );
}

/**
 * A preformatted code block for tool part content with optional copy button.
 */
export function ToolPartCodeBlock({
  children,
  allowCopy = true,
}: {
  children: string;
  allowCopy?: boolean;
}) {
  return (
    <div
      className={`tool-part__line${allowCopy ? " tool-part__line--copyable" : ""}`}
    >
      <code className="tool-part__code">{children || "(empty)"}</code>
      {allowCopy ? (
        <CopyToClipboardButton
          text={children}
          size="S"
          variant="quiet"
          tooltipText="Copy"
        />
      ) : null}
    </div>
  );
}

/**
 * A row of metadata key-value pairs (e.g., exit code, duration).
 */
export function ToolPartMeta({
  items,
}: {
  items: Array<{ label: string; value: React.ReactNode }>;
}) {
  return (
    <div className="tool-part__meta">
      {items.map(({ label, value }) => (
        <span key={label} className="tool-part__meta-group">
          <span className="tool-part__meta-label">{label}</span>
          <code className="tool-part__meta-value">{value}</code>
        </span>
      ))}
    </div>
  );
}
