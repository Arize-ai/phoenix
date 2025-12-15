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

type GoogleGenAIThinkingLevelConfigFieldProps = {
  value: unknown;
  onChange: (value: unknown) => void;
  label?: string;
};

export const GoogleGenAIThinkingLevelConfigField = ({
  value,
  onChange,
  label = "Thinking Level",
}: GoogleGenAIThinkingLevelConfigFieldProps) => {
  return (
    <Select
      value={typeof value === "string" ? value : null}
      onChange={(key) => onChange(key === "unset" ? undefined : key)}
      placeholder="Select level"
    >
      <Label>{label}</Label>
      <Button>
        <SelectValue />
        <SelectChevronUpDownIcon />
      </Button>
      <Popover>
        <ListBox>
          <SelectItem id="unset" textValue="Unset">
            <em>Unset</em>
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
