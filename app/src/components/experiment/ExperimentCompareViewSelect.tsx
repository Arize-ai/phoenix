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

export type ExperimentCompareView = "grid" | "metrics";

/**
 * TypeGuard for the experiment compare view
 */
export function isExperimentCompareView(
  maybeView: unknown
): maybeView is ExperimentCompareView {
  const experimentCompareViews: ExperimentCompareView[] = ["grid", "metrics"];
  return (
    typeof maybeView === "string" &&
    experimentCompareViews.includes(maybeView as ExperimentCompareView)
  );
}

export function ExperimentCompareViewSelect({
  view,
  onViewChange,
}: {
  view: ExperimentCompareView;
  onViewChange: (newView: ExperimentCompareView) => void;
}) {
  return (
    <div css={fieldBaseCSS}>
      <Label>view</Label>
      <Select
        aria-label="Experiment Compare View"
        selectedKey={view}
        css={css`
          button {
            width: 140px;
            min-width: 140px;
          }
        `}
        size="M"
        onSelectionChange={(key) => {
          if (isExperimentCompareView(key)) {
            onViewChange(key);
          } else {
            throw new Error(`Unknown experiment compare view: ${key}`);
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
