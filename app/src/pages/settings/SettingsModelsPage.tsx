import { useLoaderData } from "react-router";

import { Card } from "@arizeai/components";

import { Flex, Text, View } from "@phoenix/components";

import { ModelsTable } from "./ModelsTable";
import { NewModelButton } from "./NewModelButton";
import { settingsModelsLoader } from "./settingsModelsLoader";

export function SettingsModelsPage() {
  const data = useLoaderData<typeof settingsModelsLoader>();

  return (
    <View paddingY="size-100">
      <Card
        title="Models"
        variant="compact"
        extra={
          <Flex direction="row" gap="size-200" alignItems="center">
            <Text color="text-500" size="S">
              All costs shown in USD per 1M tokens
            </Text>
            <NewModelButton queryId={data.__id} />
          </Flex>
        }
        bodyStyle={{ padding: 0 }}
      >
        <ModelsTable query={data} />
      </Card>
    </View>
  );
}
