import { SegmentedControl, SegmentedControlItem } from "@phoenix/components";

import { useMarkdownMode } from "./MarkdownDisplayContext";
import type { MarkdownDisplayMode } from "./types";

const markdownDisplayModes: MarkdownDisplayMode[] = ["text", "markdown"];

/**
 * TypeGuard for the markdown mode
 */
function isMarkdownDisplayMode(m: unknown): m is MarkdownDisplayMode {
  return (
    typeof m === "string" &&
    markdownDisplayModes.includes(m as MarkdownDisplayMode)
  );
}

export function MarkdownModeSelect({
  mode,
  onModeChange,
}: {
  mode: MarkdownDisplayMode;
  onModeChange: (newMode: MarkdownDisplayMode) => void;
}) {
  return (
    <SegmentedControl
      aria-label="Markdown Mode"
      size="S"
      selectedKey={mode}
      onSelectionChange={(key) => {
        if (isMarkdownDisplayMode(key)) {
          onModeChange(key);
        } else {
          throw new Error(`Unknown markdown mode: ${key}`);
        }
      }}
    >
      <SegmentedControlItem id="text">Text</SegmentedControlItem>
      <SegmentedControlItem id="markdown">Markdown</SegmentedControlItem>
    </SegmentedControl>
  );
}

export function ConnectedMarkdownModeSelect() {
  const { mode, setMode } = useMarkdownMode();
  return <MarkdownModeSelect mode={mode} onModeChange={setMode} />;
}
