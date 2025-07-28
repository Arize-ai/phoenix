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
import { selectCSS } from "@phoenix/components/select/styles";

export type ExperimentCompareLayout = "grid" | "metrics";

/**
 * TypeGuard for the experiment compare layout
 */
export function isExperimentCompareLayout(
  m: unknown
): m is ExperimentCompareLayout {
  const experimentCompareLayouts: ExperimentCompareLayout[] = [
    "grid",
    "metrics",
  ];
  return (
    typeof m === "string" &&
    experimentCompareLayouts.includes(m as ExperimentCompareLayout)
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
    <div css={css(fieldBaseCSS, selectCSS)}>
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
