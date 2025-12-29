import { Label } from "react-aria-components";

import { ListBox, Select, SelectItem, SelectValue } from "@phoenix/components";
import { Button } from "@phoenix/components/button";
import { SelectChevronUpDownIcon } from "@phoenix/components/icon";
import { Popover } from "@phoenix/components/overlay";

type OpenAIReasoningEffortConfigFieldProps = {
  value: unknown;
  onChange: (value: unknown) => void;
  label?: string;
};

const UNSET_VALUE = "__unset__";

export const OpenAIReasoningEffortConfigField = ({
  value,
  onChange,
  label = "Reasoning Effort",
}: OpenAIReasoningEffortConfigFieldProps) => {
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
          <SelectItem id="none">none</SelectItem>
          <SelectItem id="minimal">minimal</SelectItem>
          <SelectItem id="low">low</SelectItem>
          <SelectItem id="medium">medium</SelectItem>
          <SelectItem id="high">high</SelectItem>
          <SelectItem id="xhigh">xhigh</SelectItem>
        </ListBox>
      </Popover>
    </Select>
  );
};
