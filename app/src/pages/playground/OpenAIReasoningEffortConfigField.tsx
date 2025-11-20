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

type OpenAIReasoningEffortConfigFieldProps = {
  value: unknown;
  onChange: (value: unknown) => void;
  label?: string;
};

export const OpenAIReasoningEffortConfigField = ({
  value,
  onChange,
  label = "Reasoning Effort",
}: OpenAIReasoningEffortConfigFieldProps) => {
  return (
    <Select
      value={typeof value === "string" ? value : null}
      onChange={(key) => onChange(key === "none" ? undefined : key)}
      placeholder="Select effort"
    >
      <Label>{label}</Label>
      <Button>
        <SelectValue />
        <SelectChevronUpDownIcon />
      </Button>
      <Popover>
        <ListBox>
          <SelectItem id="none" textValue="None">
            None
          </SelectItem>
          <SelectItem id="low" textValue="Low">
            Low
          </SelectItem>
          <SelectItem id="medium" textValue="Medium">
            Medium
          </SelectItem>
          <SelectItem id="high" textValue="High">
            High
          </SelectItem>
        </ListBox>
      </Popover>
    </Select>
  );
};
