import {
  Button,
  Label,
  ListBox,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  Text,
} from "@phoenix/components";
import { ColoringStrategy } from "@phoenix/constants/pointCloudConstants";

function isColoringStrategy(strategy: unknown): strategy is ColoringStrategy {
  return typeof strategy === "string" && strategy in ColoringStrategy;
}

const ColoringStrategies = Object.values(ColoringStrategy);

type ColoringStrategyPickerProps = {
  strategy: ColoringStrategy;
  onChange: (strategy: ColoringStrategy) => void;
};

export function ColoringStrategyPicker(props: ColoringStrategyPickerProps) {
  const { strategy, onChange } = props;
  return (
    <Select
      defaultValue={strategy}
      aria-label="Coloring strategy"
      onChange={(key) => {
        if (isColoringStrategy(key)) {
          onChange(key);
        }
      }}
    >
      <Label>Color By</Label>
      <Button>
        <SelectValue />
        <SelectChevronUpDownIcon />
      </Button>
      <Text slot="description">{""}</Text>
      <Popover>
        <ListBox>
          {ColoringStrategies.map((item) => (
            <SelectItem key={item} id={item}>
              {item}
            </SelectItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}
