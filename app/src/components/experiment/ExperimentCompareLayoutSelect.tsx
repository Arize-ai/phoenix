import { css } from "@emotion/react";

import {
  Button,
  Label,
  ListBox,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
} from "@phoenix/components";
import { fieldBaseCSS } from "@phoenix/components/field/styles";

export type ExperimentCompareLayout = "grid" | "metrics";

/**
 * TypeGuard for the experiment compare layout
 */
export function isExperimentCompareLayout(
  maybeLayout: unknown
): maybeLayout is ExperimentCompareLayout {
  const experimentCompareLayouts: ExperimentCompareLayout[] = [
    "grid",
    "metrics",
  ];
  return (
    typeof maybeLayout === "string" &&
    experimentCompareLayouts.includes(maybeLayout as ExperimentCompareLayout)
  );
}

export function ExperimentCompareLayoutSelect({
  layout,
  onLayoutChange,
}: {
  layout: ExperimentCompareLayout;
  onLayoutChange: (newLayout: ExperimentCompareLayout) => void;
}) {
  return (
    <div css={fieldBaseCSS}>
      <Label>layout</Label>
      <Select
        aria-label="Experiment Compare Layout"
        selectedKey={layout}
        css={css`
          button {
            width: 140px;
            min-width: 140px;
          }
        `}
        size="M"
        onSelectionChange={(key) => {
          if (isExperimentCompareLayout(key)) {
            onLayoutChange(key);
          } else {
            throw new Error(`Unknown experiment compare layout: ${key}`);
          }
        }}
      >
        <Button>
          <SelectValue />
          <SelectChevronUpDownIcon />
        </Button>
        <Popover>
          <ListBox>
            <SelectItem key="grid" id="grid">
              grid
            </SelectItem>
            <SelectItem key="metrics" id="metrics">
              metrics
            </SelectItem>
          </ListBox>
        </Popover>
      </Select>
    </div>
  );
}
