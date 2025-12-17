import { useMemo } from "react";

import {
  Button,
  Icon,
  Icons,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
} from "@phoenix/components";
import { useInferences } from "@phoenix/contexts/InferencesContext";
import { usePointCloudContext } from "@phoenix/contexts/PointCloudContext";
import type { ClusterSort } from "@phoenix/store/pointCloudStore";

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
    <MenuTrigger aria-label="Sort clusters by">
      <Button trailingVisual={<Icon svg={<Icons.ChevronDown />} />} size="S">
        Sort
      </Button>
      <Popover>
        <Menu
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
          }}
        >
          {(item) => (
            <MenuItem key={item.value} id={item.value} textValue={item.value}>
              {item.label}
            </MenuItem>
          )}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
