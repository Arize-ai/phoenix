import { css } from "@emotion/react";
import { useId } from "react";

import { DialogTrigger, Label } from "@phoenix/components";
import {
  Button,
  Icon,
  Icons,
  Popover,
  SegmentedControl,
  SegmentedControlItem,
  View,
} from "@phoenix/components/core";
import { fieldBaseCSS } from "@phoenix/components/core/field/styles";

import type { AnnotationMetricsView } from "./annotationMetricsUtils";

function isAnnotationMetricsView(
  value: unknown
): value is AnnotationMetricsView {
  return value === "labels" || value === "scores";
}

export function AnnotationMetricsViewMenu({
  view,
  onChange,
}: {
  view: AnnotationMetricsView;
  onChange: (view: AnnotationMetricsView) => void;
}) {
  const labelId = useId();
  return (
    <DialogTrigger>
      <Button
        size="S"
        aria-label="Choose evaluation metric view"
        leadingVisual={<Icon svg={<Icons.MoreHorizontal />} />}
      />
      <Popover placement="bottom end">
        <View padding="size-100">
          <div
            css={css(
              fieldBaseCSS,
              css`
                display: flex;
                flex-direction: column;
              `
            )}
          >
            <Label id={labelId}>View</Label>
            <SegmentedControl
              aria-labelledby={labelId}
              size="S"
              selectedKey={view}
              onSelectionChange={(selectedView) => {
                if (isAnnotationMetricsView(selectedView)) {
                  onChange(selectedView);
                }
              }}
            >
              <SegmentedControlItem id="scores">Scores</SegmentedControlItem>
              <SegmentedControlItem id="labels">Labels</SegmentedControlItem>
            </SegmentedControl>
          </div>
        </View>
      </Popover>
    </DialogTrigger>
  );
}
