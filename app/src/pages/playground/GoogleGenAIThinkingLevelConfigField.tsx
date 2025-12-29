import { Label } from "react-aria-components";

import { ListBox, Select, SelectItem, SelectValue } from "@phoenix/components";
import { Button } from "@phoenix/components/button";
import { SelectChevronUpDownIcon } from "@phoenix/components/icon";
import { Popover } from "@phoenix/components/overlay";

type GoogleGenAIThinkingLevelConfigFieldProps = {
  value: unknown;
  onChange: (value: unknown) => void;
  label?: string;
};

const UNSET_VALUE = "__unset__";

export const GoogleGenAIThinkingLevelConfigField = ({
  value,
  onChange,
  label = "Thinking Level",
}: GoogleGenAIThinkingLevelConfigFieldProps) => {
  return (
    <Select
      value={typeof value === "string" ? value : UNSET_VALUE}
      onChange={(key) => {
        if (key === UNSET_VALUE) {
          onChange(undefined);
        } else {
          onChange(key);
        }
      }}
      aria-label={label}
    >
      <Label>{label}</Label>
      <Button>
        <SelectValue />
        <SelectChevronUpDownIcon />
      </Button>
      <Popover>
        <ListBox>
          <SelectItem id={UNSET_VALUE}>unset</SelectItem>
          <SelectItem id="low">low</SelectItem>
          <SelectItem id="medium">medium</SelectItem>
          <SelectItem id="high">high</SelectItem>
        </ListBox>
      </Popover>
    </Select>
  );
};
