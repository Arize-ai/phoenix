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

const NONE_KEY = "__none__";

export function ColumnSelector(props: {
  description?: string;
  errorMessage?: string;
  label: string;
  columns: string[];
  selectedColumn: string | null;
  onChange: (selectedColumn: string | null) => void;
  isDisabled?: boolean;
}) {
  const {
    columns,
    selectedColumn,
    onChange,
    label,
    description,
    errorMessage,
    isDisabled,
  } = props;
  const noColumns = columns.length === 0;
  const items = useMemo(() => {
    return [
      { id: NONE_KEY, value: "None" },
      ...columns.map((column) => ({ id: column, value: column })),
    ];
  }, [columns]);

  return (
    <Select
      isDisabled={noColumns || isDisabled}
      placeholder="Select a column"
      value={selectedColumn ?? NONE_KEY}
      onChange={(key) => {
        onChange(key === NONE_KEY ? null : (key as string));
      }}
    >
      {label && <Label>{label}</Label>}
      <Button>
        <SelectValue />
        <SelectChevronUpDownIcon />
      </Button>
      <Popover>
        <ListBox items={items}>
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
