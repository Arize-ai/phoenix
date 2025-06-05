import { useLoaderData } from "react-router";

import { Button, Flex, Heading, Icon, Icons, View } from "@phoenix/components";

import { modelsLoader } from "./modelsLoader";
import { ModelsTable } from "./ModelsTable";

export function ModelsPage() {
  const data = useLoaderData<typeof modelsLoader>();

  const handleAddModel = () => {
    // TODO: Implement add model functionality
  };

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
          <Button
            size="M"
            variant="primary"
            leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
            onPress={handleAddModel}
          >
            Add Model
          </Button>
        </Flex>
      </View>
      <ModelsTable query={data} />
    </Flex>
  );
}
