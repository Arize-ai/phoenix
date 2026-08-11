import { css } from "@emotion/react";

import {
  Button,
  Icon,
  Icons,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
} from "@phoenix/components/core";

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
  return (
    <MenuTrigger>
      <Button
        size="S"
        aria-label="Choose evaluation metric view"
        leadingVisual={<Icon svg={<Icons.MoreHorizontal />} />}
      />
      <Popover placement="bottom end">
        <Menu
          aria-label="Evaluation metric view"
          css={css`
            --menu-min-width: auto;
          `}
          selectionMode="single"
          selectedKeys={[view]}
          onAction={(selectedView) => {
            if (isAnnotationMetricsView(selectedView)) {
              onChange(selectedView);
            }
          }}
        >
          <MenuItem id="scores">Scores</MenuItem>
          <MenuItem id="labels">Labels</MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
