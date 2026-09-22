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

/** A compact labeled single-choice select for the expected-output form. */
export function ExpectedLabelSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { id: string; name: string }[];
}) {
  return (
    <Select
      size="S"
      value={value}
      onChange={(key) => {
        if (key != null) onChange(String(key));
      }}
    >
      <Label>{label}</Label>
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
