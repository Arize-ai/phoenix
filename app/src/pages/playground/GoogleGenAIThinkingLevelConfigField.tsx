import { ClearableSelect, ListBox, SelectItem } from "@phoenix/components";

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
    <ClearableSelect
      value={typeof value === "string" ? value : null}
      onChange={onChange}
      label={label}
      placeholder="Select level"
    >
      <ListBox>
        <SelectItem id="low">low</SelectItem>
        <SelectItem id="medium">medium</SelectItem>
        <SelectItem id="high">high</SelectItem>
      </ListBox>
    </ClearableSelect>
  );
};
