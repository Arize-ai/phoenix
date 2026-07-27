import {
  Icon,
  Icons,
  ToggleButton,
  ToggleButtonGroup,
} from "@phoenix/components";
import type { TextDiffStyle } from "@phoenix/components/diff/TextDiff";

export type DiffStyleToggleProps = {
  value: TextDiffStyle;
  onChange: (style: TextDiffStyle) => void;
};

/**
 * A compact segmented control to switch between unified and side-by-side
 * (split) diff rendering.
 */
export function DiffStyleToggle({ value, onChange }: DiffStyleToggleProps) {
  return (
    <ToggleButtonGroup
      size="S"
      aria-label="Diff style"
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[value]}
      onSelectionChange={(keys) => {
        const selectedKey = Array.from(keys)[0];
        if (selectedKey === "unified" || selectedKey === "split") {
          onChange(selectedKey);
        }
      }}
    >
      <ToggleButton id="unified" aria-label="Unified diff">
        <Icon svg={<Icons.List />} />
        Unified
      </ToggleButton>
      <ToggleButton id="split" aria-label="Side-by-side diff">
        <Icon svg={<Icons.Column />} />
        Split
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
