import { useLoaderData } from "react-router";

import { Flex, Heading, View } from "@phoenix/components";

import { modelsLoader } from "./modelsLoader";
import { ModelsTable } from "./ModelsTable";
import { NewModelButton } from "./NewModelButton";

export function ModelsPage() {
  const data = useLoaderData<typeof modelsLoader>();

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
          <NewModelButton />
        </Flex>
      </View>
      <ModelsTable query={data} />
    </Flex>
  );
}
