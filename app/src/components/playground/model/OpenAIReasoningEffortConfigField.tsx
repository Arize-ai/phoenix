import { ClearableSelect, ListBox, SelectItem } from "@phoenix/components";

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
    <ClearableSelect
      value={typeof value === "string" ? value : null}
      onChange={onChange}
      label={label}
      placeholder="Select effort"
    >
      <ListBox>
        <SelectItem id="none">none</SelectItem>
        <SelectItem id="minimal">minimal</SelectItem>
        <SelectItem id="low">low</SelectItem>
        <SelectItem id="medium">medium</SelectItem>
        <SelectItem id="high">high</SelectItem>
        <SelectItem id="xhigh">xhigh</SelectItem>
      </ListBox>
    </ClearableSelect>
  );
};
