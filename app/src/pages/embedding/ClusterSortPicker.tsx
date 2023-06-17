import React, { useMemo, useState } from "react";
import { css } from "@emotion/react";

import {
  ActionButton,
  DropdownMenu,
  DropdownTrigger,
  Item,
  ListBox,
} from "@arizeai/components";

import { useDatasets, usePointCloudContext } from "@phoenix/contexts";
import { ClusterSort } from "@phoenix/store";

type Item = {
  label: string;
  value: string;
};

function getSortKey(sort: ClusterSort): string {
  return `${sort.column}:${sort.dir}`;
}
export function ClusterSortPicker() {
  const { referenceDataset } = useDatasets();
  const hasReferenceDataset = !!referenceDataset;
  const sort = usePointCloudContext((state) => state.clusterSort);
  const setSort = usePointCloudContext((state) => state.setClusterSort);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const items = useMemo<Item[]>(() => {
    const dynamicItems: Item[] = [];
    if (hasReferenceDataset) {
      dynamicItems.push({
        label: "Most drift",
        value: getSortKey({
          column: "driftRatio",
          dir: "desc",
        }),
      });
    }
    return [
      ...dynamicItems,
      {
        label: "Largest clusters",
        value: getSortKey({
          column: "size",
          dir: "desc",
        }),
      },
      {
        label: "Smallest clusters",
        value: getSortKey({
          column: "size",
          dir: "asc",
        }),
      },
      {
        label: "Highest metric value",
        value: getSortKey({
          column: "primaryMetricValue",
          dir: "desc",
        }),
      },
      {
        label: "Lowest metric value",
        value: getSortKey({
          column: "primaryMetricValue",
          dir: "asc",
        }),
      },
    ];
  }, [hasReferenceDataset]);
  const selectedSortKey = getSortKey(sort);
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
          outline: none;
          &:hover {
            color: ${theme.textColors.white90};
          }
        }
      `}
    >
      <DropdownTrigger
        placement="bottom right"
        aria-label="Sort clusters by"
        isOpen={isOpen}
        onOpenChange={(newIsOpen) => setIsOpen(newIsOpen)}
      >
        <ActionButton>
          Sort
          <span
            aria-hidden
            data-testid="dropdown-caret"
            css={css`
              margin-left: var(--px-spacing-sm);
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
        <DropdownMenu>
          <ListBox
            style={{ width: 200 }}
            selectedKeys={[selectedSortKey]}
            selectionMode="single"
            items={items}
            onSelectionChange={(selection) => {
              if (selection instanceof Set && selection.size > 0) {
                const [sortKey] = selection.values();
                const [column, dir] = (sortKey as string).split(":");
                setSort({
                  column: column as ClusterSort["column"],
                  dir: dir as ClusterSort["dir"],
                });
              }
              setIsOpen(false);
            }}
          >
            {(item) => <Item key={item.value}>{item.label}</Item>}
          </ListBox>
        </DropdownMenu>
      </DropdownTrigger>
    </div>
  );
}
