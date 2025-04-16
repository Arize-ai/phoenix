import React from "react";

import {
  Button,
  Label,
  ListBox,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
} from "@phoenix/components";

// Define retention policy options
const retentionOptions = [
  { id: "30days", name: "30 Days" },
  { id: "60days", name: "60 Days" },
  { id: "90days", name: "90 Days" },
  { id: "180days", name: "180 Days" },
  { id: "365days", name: "1 Year" },
  { id: "forever", name: "Forever" },
];

export interface ProjectTraceRetentionPolicySelectProps {
  size?: "S" | "M";
  isDisabled?: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
  defaultValue?: string;
  onChange?: (value: string) => void;
}

export function ProjectTraceRetentionPolicySelect({
  size = "M",
  isDisabled = false,
  isRequired = false,
  isInvalid = false,
  defaultValue = "30days",
  onChange,
}: ProjectTraceRetentionPolicySelectProps) {
  return (
    <Select
      size={size}
      isDisabled={isDisabled}
      isRequired={isRequired}
      isInvalid={isInvalid}
      defaultSelectedKey={defaultValue}
      onSelectionChange={(key) => onChange?.(key.toString())}
    >
      <Label>Retention Policy</Label>
      <Button>
        <SelectValue />
        <SelectChevronUpDownIcon />
      </Button>
      <Popover>
        <ListBox>
          {retentionOptions.map((option) => (
            <SelectItem key={option.id} id={option.id}>
              {option.name}
            </SelectItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}
