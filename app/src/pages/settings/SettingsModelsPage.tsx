import { graphql, useLazyLoadQuery } from "react-relay";

import { Card } from "@arizeai/components";

import { Flex, Text } from "@phoenix/components";
import { SettingsModelsPageQuery } from "@phoenix/pages/settings/__generated__/SettingsModelsPageQuery.graphql";

import { ModelsTable } from "./ModelsTable";
import { NewModelButton } from "./NewModelButton";

export function SettingsModelsPage() {
  const data = useLazyLoadQuery<SettingsModelsPageQuery>(
    graphql`
      query SettingsModelsPageQuery {
        ...ModelsTable_generativeModels
      }
    `,
    {}
  );

  return (
    <Card
      title="Models"
      variant="compact"
      extra={
        <Flex direction="row" gap="size-200" alignItems="center">
          <Text color="text-500" size="S">
            All costs shown in USD per 1M tokens
          </Text>
          <NewModelButton />
        </Flex>
      }
      bodyStyle={{ padding: 0 }}
    >
      <ModelsTable modelsRef={data} />
    </Card>
  );
}
