import React from "react";
import { css } from "@emotion/react";

import {
  ActionButton,
  DropdownMenu,
  DropdownTrigger,
} from "@arizeai/components";

import { usePointCloudContext } from "@phoenix/contexts";

export function ClusterSortPicker() {
  const sort = usePointCloudContext((state) => state.clusterSort);
  const setSort = usePointCloudContext((state) => state.setClusterSort);
  return (
    <div
      css={(theme) => css`
        .ac-action-button {
          background: none;
          border: none;
          color: ${theme.textColors.white70};
          font-size: ${theme.typography.sizes.small.fontSize}px;
          line-height: ${theme.typography.sizes.small.lineHeight}px;
          cursor: pointer;
          &:hover {
            color: ${theme.textColors.white90};
          }
        }
      `}
    >
      <DropdownTrigger>
        <ActionButton>
          Sort{" "}
          <span
            aria-hidden
            data-testid="dropdown-caret"
            css={css`
              border-bottom-color: #0000;
              border-left-color: #0000;
              border-right-color: #0000;
              border-style: solid;
              border-width: 3px 3px 0;
              content: "";
              display: inline-block;
              height: 0;
              vertical-align: middle;
              width: 0;
            `}
          />
        </ActionButton>
        <DropdownMenu>menu</DropdownMenu>
      </DropdownTrigger>
    </div>
  );
}
