import { ToggleButton, ToggleButtonGroup } from "@phoenix/components";
import { SelectionGridSize } from "@phoenix/constants/pointCloudConstants";

/**
 * TypeGuard for the view mode
 */
function isSelectionGridSize(m: unknown): m is SelectionGridSize {
  return typeof m === "string" && m in SelectionGridSize;
}

type SelectionGridSizeRadioGroupProps = {
  size: SelectionGridSize;
  onChange: (size: SelectionGridSize) => void;
};

/**
 * Selects the size of the grid view of the points
 */
export function SelectionGridSizeRadioGroup(
  props: SelectionGridSizeRadioGroupProps
) {
  return (
    <ToggleButtonGroup
      selectedKeys={[props.size]}
      size="L"
      aria-label="Selection Grid Size"
      onSelectionChange={(v) => {
        if (v.size === 0) {
          return;
        }
        const size = v.keys().next().value;
        if (isSelectionGridSize(size)) {
          props.onChange(size);
        } else {
          throw new Error(`Unknown grid size: ${size}`);
        }
      }}
    >
      <ToggleButton aria-label="Small" id={SelectionGridSize.small}>
        S
      </ToggleButton>
      <ToggleButton aria-label="Medium" id={SelectionGridSize.medium}>
        M
      </ToggleButton>
      <ToggleButton aria-label="Large" id={SelectionGridSize.large}>
        L
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
