import { useLoaderData } from "react-router";

import { Card } from "@arizeai/components";

import { View } from "@phoenix/components";

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
        extra={<NewModelButton />}
        bodyStyle={{ padding: 0 }}
      >
        <ModelsTable query={data} />
      </Card>
    </View>
  );
}
