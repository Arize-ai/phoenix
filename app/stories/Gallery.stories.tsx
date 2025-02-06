import React, { useState } from "react";
import { Meta, StoryFn } from "@storybook/react";

import { Item, Picker } from "@arizeai/components";

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
  Tag,
  TagGroup,
  TagList,
  Text,
  TextField,
  TimeField,
  View,
} from "@phoenix/components";

const meta: Meta = {
  title: "Gallery",

  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

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
        <Button
          size="S"
          onPress={() => setDirection(direction === "row" ? "column" : "row")}
        >
          {`Toggle Direction: ${direction}`}
        </Button>
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
          <Picker label="Toppings" size="compact" description={"pick a flavor"}>
            <Item key="chocolate">Chocolate</Item>
            <Item key="mint">Mint</Item>
            <Item key="strawberry">Strawberry</Item>
            <Item key="vanilla">Vanilla</Item>
          </Picker>
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
          <Picker label="Toppings" size="default" description={"pick a flavor"}>
            <Item key="chocolate">Chocolate</Item>
            <Item key="mint">Mint</Item>
            <Item key="strawberry">Strawberry</Item>
            <Item key="vanilla">Vanilla</Item>
          </Picker>
          <TextField size="L">
            <Label>Label</Label>
            <Input type="text" />
            <Text slot="description">some description</Text>
          </TextField>
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
          <Picker label="Toppings" size="compact">
            <Item key="chocolate">Chocolate</Item>
            <Item key="mint">Mint</Item>
            <Item key="strawberry">Strawberry</Item>
            <Item key="vanilla">Vanilla</Item>
          </Picker>
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
          <Picker label="Toppings" size="default">
            <Item key="chocolate">Chocolate</Item>
            <Item key="mint">Mint</Item>
            <Item key="strawberry">Strawberry</Item>
            <Item key="vanilla">Vanilla</Item>
          </Picker>
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
