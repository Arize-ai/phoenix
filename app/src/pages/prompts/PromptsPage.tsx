import React from "react";

import { Button, Flex, Heading, Icon, Icons, View } from "@arizeai/components";

export function PromptsPage() {
  return (
    <Flex direction="column" height="100%">
      <View
        padding="size-200"
        borderBottomWidth="thin"
        borderBottomColor="dark"
        flex="none"
      >
        <Flex direction="row" justifyContent="space-between">
          <Heading level={1}>Datasets</Heading>
          <Button variant="default" icon={<Icon svg={<Icons.PlusOutline />} />}>
            Prompt Template
          </Button>
        </Flex>
      </View>
    </Flex>
  );
}
