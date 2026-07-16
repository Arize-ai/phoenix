import {
  Button,
  Flex,
  ListBox,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  Text,
} from "@phoenix/components";

export const MAX_EVALUATION_LABEL_COUNT = 12;

export function EvaluationMetricsLabelCountSelect({
  count,
  maxCount,
  onChange,
}: {
  count: number;
  maxCount: number;
  onChange: (count: number) => void;
}) {
  return (
    <Flex direction="row" gap="size-100" alignItems="center">
      <Text size="S" color="text-700">
        Include
      </Text>
      <Select
        aria-label="Maximum labels shown in chart"
        size="S"
        value={String(count)}
        onChange={(value) => {
          if (typeof value === "string") {
            onChange(Number(value));
          }
        }}
      >
        <Button size="S" trailingVisual={<SelectChevronUpDownIcon />}>
          <SelectValue />
        </Button>
        <Popover>
          <ListBox>
            {Array.from({ length: maxCount }, (_, index) => index + 1).map(
              (labelCount) => {
                const label = `top ${labelCount} ${labelCount === 1 ? "label" : "labels"}`;
                return (
                  <SelectItem
                    key={labelCount}
                    id={String(labelCount)}
                    textValue={label}
                  >
                    {label}
                  </SelectItem>
                );
              }
            )}
          </ListBox>
        </Popover>
      </Select>
    </Flex>
  );
}
