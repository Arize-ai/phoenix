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

/** A compact single-choice select for the results toolbar and table. */
export function CalibrationSelect({
  label,
  value,
  onChange,
  options,
  isDisabled = false,
  hideLabel = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { id: string; name: string }[];
  isDisabled?: boolean;
  hideLabel?: boolean;
}) {
  return (
    <Select
      size="S"
      value={value}
      onChange={(key) => {
        if (typeof key === "string") onChange(key);
      }}
      isDisabled={isDisabled}
      aria-label={hideLabel ? label : undefined}
    >
      {hideLabel ? null : <Label>{label}</Label>}
      <Button>
        <SelectValue />
        <SelectChevronUpDownIcon />
      </Button>
      <Popover>
        <ListBox>
          {options.map((option) => (
            <SelectItem id={option.id} key={option.id}>
              {option.name}
            </SelectItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}
