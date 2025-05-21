import { useMemo, useState } from "react";
import { css } from "@emotion/react";

import {
  ActionButton,
  DropdownMenu,
  DropdownTrigger,
  Item,
  ListBox,
} from "@arizeai/components";

import { useInferences, usePointCloudContext } from "@phoenix/contexts";
import { ClusterSort } from "@phoenix/store";

type Item = {
  label: string;
  value: string;
};

function getSortKey(sort: ClusterSort): string {
  return `${sort.column}:${sort.dir}`;
}
export function ClusterSortPicker() {
  const { referenceInferences } = useInferences();
  const hasReferenceInferences = !!referenceInferences;
  const sort = usePointCloudContext((state) => state.clusterSort);
  const setSort = usePointCloudContext((state) => state.setClusterSort);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const items = useMemo<Item[]>(() => {
    const dynamicItems: Item[] = [];
    if (hasReferenceInferences) {
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
  }, [hasReferenceInferences]);
  const selectedSortKey = getSortKey(sort);
  return (
    <div
      css={css`
        .ac-action-button {
          background: none;
          border: none;
          color: ${"var(--ac-global-text-color-700)"};
          font-size: var(--ac-global-font-size-xs);
          line-height: var(--ac-global-line-height-xs);
          cursor: pointer;
          outline: none;
          &:hover {
            color: var(--ac-global-text-color-900);
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
              margin-left: var(--ac-global-dimension-static-size-50);
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
