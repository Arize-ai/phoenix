import { useState } from "react";
import { Meta, StoryFn } from "@storybook/react";

import {
  Button,
  ComboBox,
  ComboBoxItem,
  DateField,
  DateInput,
  DateSegment,
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
  Flex,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectValue,
  Tag,
  TagGroup,
  TagList,
  Text,
  TextField,
  TimeField,
  ToggleButton,
  ToggleButtonGroup,
  View,
} from "@phoenix/components";

const meta: Meta = {
  title: "Gallery",

  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

const options = [
  { id: "chocolate", name: "Chocolate" },
  { id: "mint", name: "Mint" },
  { id: "strawberry", name: "Strawberry" },
  { id: "vanilla", name: "Vanilla" },
];

const SelectContent = () => (
  <>
    <Label>Toppings</Label>
    <Button>
      <SelectValue />
      <SelectChevronUpDownIcon />
    </Button>
    <Popover>
      <ListBox>
        {options.map((option) => (
          <ListBoxItem key={option.id} id={option.id}>
            {option.name}
          </ListBoxItem>
        ))}
      </ListBox>
    </Popover>
  </>
);

const Template: StoryFn = () => {
  const [direction, setDirection] = useState<"row" | "column">("row");
  return (
    <View padding="size-200">
      <View
        padding="size-200"
        borderWidth="thin"
        borderColor="dark"
        borderRadius="medium"
      >
        <Flex direction="row" gap="size-100" alignItems="center">
          <Button
            size="S"
            onPress={() => setDirection(direction === "row" ? "column" : "row")}
          >
            {`Toggle Direction: ${direction}`}
          </Button>
          <ToggleButtonGroup size="S">
            <ToggleButton>Option 1</ToggleButton>
            <ToggleButton>Option 2</ToggleButton>
            <ToggleButton>Option 3</ToggleButton>
          </ToggleButtonGroup>
        </Flex>
      </View>
      <View
        borderWidth="thin"
        borderColor="dark"
        padding="size-200"
        borderRadius="medium"
        marginTop="size-200"
      >
        <Flex
          direction={direction}
          gap="size-200"
          alignItems={direction === "row" ? "center" : "start"}
        >
          <ComboBox
            label="Ice cream flavor"
            description={"pick a flavor"}
            placeholder="Select a flavor"
          >
            <ComboBoxItem textValue="Chocolate" key={"chocolate"}>
              Chocolate
            </ComboBoxItem>
            <ComboBoxItem textValue="Mint" key={"mint"}>
              Mint
            </ComboBoxItem>
            <ComboBoxItem textValue="Strawberry" key={"strawberry"}>
              Strawberry
            </ComboBoxItem>
            <ComboBoxItem textValue="Vanilla" key={"vanilla"}>
              Vanilla
            </ComboBoxItem>
          </ComboBox>
          <DateField>
            <Label>Birth date</Label>
            <DateInput>
              {(segment) => <DateSegment segment={segment} />}
            </DateInput>
            <Text slot="description">your birthday</Text>
          </DateField>
          <TimeField>
            <Label>Event Time</Label>
            <DateInput>
              {(segment) => <DateSegment segment={segment} />}
            </DateInput>
            <Text slot="description">the time of your event</Text>
          </TimeField>
          <Select size="S">
            <SelectContent />
          </Select>
          <View minWidth="300px">
            <TagGroup selectionMode="multiple">
              <Label>Categories</Label>
              <TagList>
                <Tag>News</Tag>
                <Tag>Travel</Tag>
                <Tag>Gaming</Tag>
                <Tag>Shopping</Tag>
              </TagList>
              <Text slot="description">Choose your own category</Text>
            </TagGroup>
          </View>
          <TextField size="M">
            <Label>Label</Label>
            <Input type="text" />
            <Text slot="description">some text</Text>
          </TextField>
          <Button size="S">Button</Button>
        </Flex>
        <Flex direction="row" gap="size-200" alignItems="center">
          <ComboBox
            label="Ice cream flavor"
            description={"pick a flavor"}
            size="L"
          >
            <ComboBoxItem textValue="Chocolate" key={"chocolate"}>
              Chocolate
            </ComboBoxItem>
            <ComboBoxItem textValue="Mint" key={"mint"}>
              Mint
            </ComboBoxItem>
            <ComboBoxItem textValue="Strawberry" key={"strawberry"}>
              Strawberry
            </ComboBoxItem>
            <ComboBoxItem textValue="Vanilla" key={"vanilla"}>
              Vanilla
            </ComboBoxItem>
          </ComboBox>
          <Select size="L">
            <SelectContent />
          </Select>
          <Button size="M">Button</Button>
        </Flex>
      </View>
      <View
        padding="size-200"
        borderWidth="thin"
        borderColor="dark"
        borderRadius="medium"
        marginTop="size-200"
      >
        <Flex direction="column" gap="size-200">
          <ComboBox label="Ice cream flavor">
            <ComboBoxItem textValue="Chocolate" key={"chocolate"}>
              Chocolate
            </ComboBoxItem>
            <ComboBoxItem textValue="Mint" key={"mint"}>
              Mint
            </ComboBoxItem>
            <ComboBoxItem textValue="Strawberry" key={"strawberry"}>
              Strawberry
            </ComboBoxItem>
            <ComboBoxItem textValue="Vanilla" key={"vanilla"}>
              Vanilla
            </ComboBoxItem>
          </ComboBox>
          <Select size="S">
            <SelectContent />
          </Select>
          <ComboBox label="Ice cream flavor" size="L">
            <ComboBoxItem textValue="Chocolate" key={"chocolate"}>
              Chocolate
            </ComboBoxItem>
            <ComboBoxItem textValue="Mint" key={"mint"}>
              Mint
            </ComboBoxItem>
            <ComboBoxItem textValue="Strawberry" key={"strawberry"}>
              Strawberry
            </ComboBoxItem>
            <ComboBoxItem textValue="Vanilla" key={"vanilla"}>
              Vanilla
            </ComboBoxItem>
          </ComboBox>
          <Select size="M">
            <SelectContent />
          </Select>
        </Flex>
      </View>
      <View
        borderWidth="thin"
        borderColor="dark"
        borderRadius="medium"
        marginTop="size-200"
      >
        <DisclosureGroup>
          <Disclosure id="content">
            <DisclosureTrigger>Nutrition Facts</DisclosureTrigger>
            <DisclosurePanel>
              <Text>Ice cream is good for you!</Text>
            </DisclosurePanel>
          </Disclosure>
        </DisclosureGroup>
      </View>
    </View>
  );
};

export const Default = Template.bind({});
