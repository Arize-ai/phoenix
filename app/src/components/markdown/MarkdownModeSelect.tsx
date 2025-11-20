import { css } from "@emotion/react";

import {
  Button,
  ListBox,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
} from "@phoenix/components";

import { useMarkdownMode } from "./MarkdownDisplayContext";
import { MarkdownDisplayMode } from "./types";

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
    <Select
      aria-label="Markdown Mode"
      value={mode}
      css={css`
        button {
          width: 140px;
          min-width: 140px;
        }
      `}
      size="S"
      onChange={(key) => {
        if (isMarkdownDisplayMode(key)) {
          onModeChange(key);
        } else {
          throw new Error(`Unknown markdown mode: ${key}`);
        }
      }}
    >
      <Button>
        <SelectValue />
        <SelectChevronUpDownIcon />
      </Button>
      <Popover>
        <ListBox>
          <SelectItem key="text" id="text">
            Text
          </SelectItem>
          <SelectItem key="markdown" id="markdown">
            Markdown
          </SelectItem>
        </ListBox>
      </Popover>
    </Select>
  );
}

export function ConnectedMarkdownModeSelect() {
  const { mode, setMode } = useMarkdownMode();
  return <MarkdownModeSelect mode={mode} onModeChange={setMode} />;
}
