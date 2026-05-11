import { Label } from "react-aria-components";

import {
  ListBox,
  Select,
  SelectItem,
  SelectValue,
  Text,
} from "@phoenix/components";
import { Button } from "@phoenix/components/core/button";
import { SelectChevronUpDownIcon } from "@phoenix/components/core/icon";
import { Popover } from "@phoenix/components/core/overlay";
import {
  OPENAI_REASONING_EFFORT_ENUM_VALUES,
  OPENAI_REASONING_EFFORT_FORM_VALUE_BY_ENUM,
} from "@phoenix/pages/playground/openAIReasoningEffort";

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
          <SelectItem id={UNSET_VALUE}>
            <Text color="text-500" fontStyle="italic">
              unset
            </Text>
          </SelectItem>
          {OPENAI_REASONING_EFFORT_ENUM_VALUES.map((enumValue) => {
            const optionValue =
              OPENAI_REASONING_EFFORT_FORM_VALUE_BY_ENUM[enumValue];
            return (
              <SelectItem key={enumValue} id={optionValue}>
                {optionValue}
              </SelectItem>
            );
          })}
        </ListBox>
      </Popover>
    </Select>
  );
};
