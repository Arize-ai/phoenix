import {
  Icon,
  Icons,
  ToggleButton,
  ToggleButtonGroup,
} from "@phoenix/components";
import { SelectionDisplay } from "@phoenix/constants/pointCloudConstants";

/**
 * TypeGuard for the view mode
 */
function isSelectionDisplay(m: unknown): m is SelectionDisplay {
  return typeof m === "string" && m in SelectionDisplay;
}

type SelectionDisplayRadioGroupProps = {
  mode: SelectionDisplay;
  onChange: (mode: SelectionDisplay) => void;
};

/**
 * Controls the view of the user's selection (e.g. view as a list or gallery)
 */
export function SelectionDisplayRadioGroup(
  props: SelectionDisplayRadioGroupProps
) {
  return (
    <ToggleButtonGroup
      selectedKeys={[props.mode]}
      size="L"
      onSelectionChange={(v) => {
        if (v.size === 0) {
          return;
        }
        const mode = v.keys().next().value;
        if (isSelectionDisplay(mode)) {
          props.onChange(mode);
        } else {
          throw new Error(`Unknown view mode: ${mode}`);
        }
      }}
    >
      <ToggleButton aria-label="List" id={SelectionDisplay.list}>
        <Icon svg={<Icons.ListOutline />} />
      </ToggleButton>
      <ToggleButton aria-label="Grid" id={SelectionDisplay.gallery}>
        <Icon svg={<Icons.Grid />} />
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
