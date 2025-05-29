import { Content, ContextualHelp } from "@arizeai/components";

import { 
  Button,
  Heading, 
  Label,
  ListBox,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  Text 
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

const contextualHelp = (
  <ContextualHelp>
    <Heading weight="heavy" level={4}>
      Coloring Strategy
    </Heading>
    <Content>
      <Text>
        The way in which inference point is colored. Each point in the
        point-cloud represents a model inference. These inferences can be
        colored by a particular attribute (such as inferences and dimension) or
        by a performance value such as correctness (predicted value equals the
        actual value)
      </Text>
    </Content>
  </ContextualHelp>
);

export function ColoringStrategyPicker(props: ColoringStrategyPickerProps) {
  const { strategy, onChange } = props;
  return (
    <Select
      defaultSelectedKey={strategy}
      aria-label="Coloring strategy"
      onSelectionChange={(key) => {
        if (isColoringStrategy(key)) {
          onChange(key);
        }
      }}
    >
      <Label>
        Color By
        {contextualHelp}
      </Label>
      <Button>
        <SelectValue />
        <SelectChevronUpDownIcon />
      </Button>
      <Popover>
        <ListBox>
          {ColoringStrategies.map((item) => (
            <SelectItem key={item} id={item}>{item}</SelectItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}
