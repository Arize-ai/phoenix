import { css } from "@emotion/react";
import type { Column } from "@tanstack/react-table";
import type { ChangeEvent } from "react";
import { useCallback, useMemo } from "react";

import {
  Button,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Popover,
  SelectChevronUpDownIcon,
  View,
} from "@phoenix/components";

const UN_HIDABLE_COLUMN_IDS = ["select", "name", "actions"];

const ANNOTATION_COLUMN_PREFIX = "annotation-";

type ExperimentColumnSelectorProps<T extends object> = {
  columns: Column<T>[];
  columnVisibility: Record<string, boolean>;
  onColumnVisibilityChange: (visibility: Record<string, boolean>) => void;
};

export function ExperimentColumnSelector<T extends object>(
  props: ExperimentColumnSelectorProps<T>
) {
  return (
    <DialogTrigger>
      <Button trailingVisual={<SelectChevronUpDownIcon />}>
        <Flex alignItems="center" gap="size-100">
          <Icon svg={<Icons.Column />} />
          Columns
        </Flex>
      </Button>
      <Popover>
        <ColumnSelectorMenu {...props} />
      </Popover>
    </DialogTrigger>
  );
}

const columnCheckboxItemCSS = css`
  padding: var(--global-dimension-static-size-50)
    var(--global-dimension-static-size-100);
  label {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-static-size-100);
  }
`;

function getColumnDisplayName<T extends object>(column: Column<T>): string {
  if (column.id.startsWith(ANNOTATION_COLUMN_PREFIX)) {
    return column.id.slice(ANNOTATION_COLUMN_PREFIX.length);
  }
  const header = column.columnDef.header;
  if (typeof header === "string") {
    return header;
  }
  return column.id;
}

function ColumnSelectorMenu<T extends object>(
  props: ExperimentColumnSelectorProps<T>
) {
  const {
    columns: propsColumns,
    columnVisibility,
    onColumnVisibilityChange,
  } = props;

  const columns = useMemo(() => {
    return propsColumns.filter((column) => {
      return !UN_HIDABLE_COLUMN_IDS.includes(column.id);
    });
  }, [propsColumns]);

  const experimentColumns = useMemo(() => {
    return columns.filter(
      (column) => !column.id.startsWith(ANNOTATION_COLUMN_PREFIX)
    );
  }, [columns]);

  const annotationColumns = useMemo(() => {
    return columns.filter((column) =>
      column.id.startsWith(ANNOTATION_COLUMN_PREFIX)
    );
  }, [columns]);

  const allVisible = useMemo(() => {
    return columns.every((column) => {
      const stateValue = columnVisibility[column.id];
      return stateValue == null ? true : stateValue;
    });
  }, [columns, columnVisibility]);

  const onCheckboxChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { name, checked } = event.target;
      onColumnVisibilityChange({ ...columnVisibility, [name]: checked });
    },
    [columnVisibility, onColumnVisibilityChange]
  );

  const onToggleAll = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { checked } = event.target;
      const newVisibilityState = columns.reduce(
        (acc, column) => {
          return { ...acc, [column.id]: checked };
        },
        {} as Record<string, boolean>
      );
      onColumnVisibilityChange(newVisibilityState);
    },
    [columns, onColumnVisibilityChange]
  );

  return (
    <div
      css={css`
        overflow-y: auto;
        max-height: calc(100vh - 200px);
      `}
    >
      <View padding="size-50">
        <View
          borderBottomColor="default"
          borderBottomWidth="thin"
          paddingBottom="size-50"
        >
          <div css={columnCheckboxItemCSS}>
            <label>
              <input
                type="checkbox"
                name="toggle-all"
                checked={allVisible}
                onChange={onToggleAll}
              />
              all columns
            </label>
          </div>
        </View>
        <ul>
          {experimentColumns.map((column) => {
            const stateValue = columnVisibility[column.id];
            const isVisible = stateValue == null ? true : stateValue;
            return (
              <li key={column.id} css={columnCheckboxItemCSS}>
                <label>
                  <input
                    type="checkbox"
                    name={column.id}
                    checked={isVisible}
                    onChange={onCheckboxChange}
                  />
                  {getColumnDisplayName(column)}
                </label>
              </li>
            );
          })}
        </ul>
        {annotationColumns.length > 0 && (
          <section>
            <View
              paddingTop="size-50"
              paddingBottom="size-50"
              borderColor="default"
              borderTopWidth="thin"
            >
              <div css={columnCheckboxItemCSS}>
                <label>
                  <input
                    type="checkbox"
                    name="toggle-annotations"
                    checked={annotationColumns.every((column) => {
                      const stateValue = columnVisibility[column.id];
                      return stateValue == null ? true : stateValue;
                    })}
                    onChange={(event) => {
                      const { checked } = event.target;
                      const newState = annotationColumns.reduce(
                        (acc, column) => ({
                          ...acc,
                          [column.id]: checked,
                        }),
                        {} as Record<string, boolean>
                      );
                      onColumnVisibilityChange({
                        ...columnVisibility,
                        ...newState,
                      });
                    }}
                  />
                  annotations
                </label>
              </div>
            </View>
            <ul>
              {annotationColumns.map((column) => {
                const stateValue = columnVisibility[column.id];
                const isVisible = stateValue == null ? true : stateValue;
                return (
                  <li key={column.id} css={columnCheckboxItemCSS}>
                    <label>
                      <input
                        type="checkbox"
                        name={column.id}
                        checked={isVisible}
                        onChange={onCheckboxChange}
                      />
                      {getColumnDisplayName(column)}
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </View>
    </div>
  );
}
