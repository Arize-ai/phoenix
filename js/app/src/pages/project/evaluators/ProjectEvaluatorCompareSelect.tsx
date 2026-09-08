import { css } from "@emotion/react";

import {
  Button,
  Flex,
  ListBox,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
} from "@phoenix/components";
import { ColorSwatch } from "@phoenix/components/color/ColorSwatch";
import { Truncate } from "@phoenix/components/core/utility/Truncate";

export type ProjectEvaluatorCompareOption = {
  id: string;
  name: string;
};

const selectCSS = css`
  width: clamp(
    var(--global-dimension-size-2000),
    20vw,
    var(--global-dimension-size-3000)
  );
`;

export function ProjectEvaluatorCompareSelect({
  label,
  color,
  selectedEvaluator,
  options,
  onSelectionChange,
}: {
  label: string;
  color: string;
  selectedEvaluator: ProjectEvaluatorCompareOption;
  options: ProjectEvaluatorCompareOption[];
  onSelectionChange: (evaluatorId: string) => void;
}) {
  return (
    <Select
      aria-label={label}
      size="S"
      value={selectedEvaluator.id}
      onChange={(key) => {
        if (key != null) {
          onSelectionChange(key.toString());
        }
      }}
      css={selectCSS}
    >
      <Button>
        <Flex direction="row" gap="size-100" alignItems="center" minWidth={0}>
          <ColorSwatch color={color} size="M" />
          <Truncate maxWidth="100%">{selectedEvaluator.name}</Truncate>
        </Flex>
        <SelectChevronUpDownIcon />
      </Button>
      <Popover placement="bottom end">
        <ListBox>
          {options.map((option) => (
            <SelectItem key={option.id} id={option.id} textValue={option.name}>
              {option.name}
            </SelectItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}
