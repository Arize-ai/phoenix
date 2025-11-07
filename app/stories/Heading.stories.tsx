import { Meta } from "@storybook/react";

import { Flex, Heading, View } from "@phoenix/components";

const meta: Meta = {
  title: "Heading",
  component: Heading,

  parameters: {
    controls: { expanded: true },
  },
};

export default meta;

/**
 * A gallery of all the variants
 */
export const Gallery = () => {
  return (
    <Flex direction="row" gap="size-200">
      <View>
        <Heading level={1}>Heading 1</Heading>
        <Heading level={2}>Heading 2</Heading>
        <Heading level={3}>Heading 3</Heading>
        <Heading level={4}>Heading 4</Heading>
        <Heading level={5}>Heading 5</Heading>
        <Heading level={6}>Heading 6</Heading>
      </View>
    </Flex>
  );
};
