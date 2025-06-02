import { Flex, Heading, View } from "@phoenix/components";

import { ModelsTable } from "./ModelsTable";

export function ModelsPage() {
  return (
    <Flex direction="column" height="100%">
      <View
        padding="size-200"
        borderBottomWidth="thin"
        borderBottomColor="dark"
        flex="none"
      >
        <Flex
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Heading level={1}>Models</Heading>
        </Flex>
      </View>
      <ModelsTable />
    </Flex>
  );
}
