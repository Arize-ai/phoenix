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
import { fieldBaseCSS } from "@phoenix/components/field/styles";

export function ColumnMultiSelector(props: {
  description?: string;
  errorMessage?: string;
  label: string;
  columns: string[];
  selectedColumns: string[];
  onChange: (selectedColumns: string[]) => void;
}) {
  const {
    columns,
    selectedColumns,
    onChange,
    label,
    description,
    errorMessage,
  } = props;
  const noColumns = columns.length === 0;
  const items = useMemo(() => {
    return columns.map((column) => ({ id: column, value: column }));
  }, [columns]);

  return (
    <div css={fieldBaseCSS}>
      <Label>{label}</Label>
      <Select
        isDisabled={noColumns}
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
        <Button>
          <SelectValue />
          <SelectChevronUpDownIcon />
        </Button>
        <Popover>
          <ListBox
            renderEmptyState={() => "No columns to select"}
            items={items}
          >
            {(item) => <ListBoxItem id={item.id}>{item.value}</ListBoxItem>}
          </ListBox>
        </Popover>
      </Select>
      {errorMessage ? (
        <Text slot="errorMessage" color="danger">
          {errorMessage}
        </Text>
      ) : null}
      {description && !errorMessage ? (
        <Text slot="description">{description}</Text>
      ) : null}
    </div>
  );
}
