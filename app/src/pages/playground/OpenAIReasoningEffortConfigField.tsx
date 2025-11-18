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
      value={typeof value === "string" ? value : undefined}
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
          <SelectItem id="none">None</SelectItem>
          <SelectItem id="low">Low</SelectItem>
          <SelectItem id="medium">Medium</SelectItem>
          <SelectItem id="high">High</SelectItem>
        </ListBox>
      </Popover>
    </Select>
  );
};
