import { Meta } from "@storybook/react";

// eslint-disable-next-line deprecate/import
import { Heading as LegacyHeading, View } from "@arizeai/components";

import { Flex, Heading } from "@phoenix/components";

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
      <View>
        <LegacyHeading level={1}>Heading 1</LegacyHeading>
        <LegacyHeading level={2}>Heading 2</LegacyHeading>
        <LegacyHeading level={3}>Heading 3</LegacyHeading>
        <LegacyHeading level={4}>Heading 4</LegacyHeading>
        <LegacyHeading level={5}>Heading 5</LegacyHeading>
        <LegacyHeading level={6}>Heading 6</LegacyHeading>
      </View>
    </Flex>
  );
};
