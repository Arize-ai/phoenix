import { useMemo } from "react";
import { Label } from "react-aria-components";

import {
  Button,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectValue,
  Text,
} from "@phoenix/components";

export function ColumnMultiSelector(props: {
  description?: string;
  errorMessage?: string;
  label: string;
  columns: string[];
  selectedColumns: string[];
  onChange: (selectedColumns: string[]) => void;
  isDisabled?: boolean;
}) {
  const {
    columns,
    selectedColumns,
    onChange,
    label,
    description,
    errorMessage,
    isDisabled,
  } = props;
  const noColumns = columns.length === 0;
  const items = useMemo(() => {
    return columns.map((column) => ({ id: column, value: column }));
  }, [columns]);

  return (
    <Select
      isDisabled={noColumns || isDisabled}
      placeholder="Select columns"
      selectionMode="multiple"
      onChange={(keys) => {
        if (keys === "all") {
          return onChange(columns);
        }
        return onChange(Array.from(keys as string[]));
      }}
      value={selectedColumns}
    >
      {label && <Label>{label}</Label>}
      <Button>
        <SelectValue />
        <SelectChevronUpDownIcon />
      </Button>
      <Popover>
        <ListBox renderEmptyState={() => "No columns to select"} items={items}>
          {(item) => <ListBoxItem id={item.id}>{item.value}</ListBoxItem>}
        </ListBox>
      </Popover>
      {errorMessage ? (
        <Text slot="errorMessage" color="danger">
          {errorMessage}
        </Text>
      ) : null}
      {description && !errorMessage ? (
        <Text slot="description">{description}</Text>
      ) : null}
    </Select>
  );
}
