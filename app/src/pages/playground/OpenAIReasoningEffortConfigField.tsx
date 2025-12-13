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

type ReasoningEffortConfigFieldProps = {
  value: unknown;
  onChange: (value: unknown) => void;
  label?: string;
};

export const OpenAIReasoningEffortConfigField = ({
  value,
  onChange,
  label = "Reasoning Effort",
}: ReasoningEffortConfigFieldProps) => {
  return (
    <Select
      value={typeof value === "string" ? value : null}
      onChange={(key) => onChange(key === "unset" ? undefined : key)}
      placeholder="Select effort"
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
          <SelectItem id="none" textValue="None">
            None
          </SelectItem>
          <SelectItem id="minimal" textValue="Minimal">
            Minimal
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
          <SelectItem id="xhigh" textValue="Extra High">
            Extra High
          </SelectItem>
        </ListBox>
      </Popover>
    </Select>
  );
};

export const GoogleGenAIThinkingLevelConfigField = ({
  value,
  onChange,
  label = "Thinking Level",
}: ReasoningEffortConfigFieldProps) => {
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
