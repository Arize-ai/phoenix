import { Card, DisclosureGroup } from "@phoenix/components";
import { LLMDisclosure } from "@phoenix/components/generative";
import { ModelProviders } from "@phoenix/constants/generativeConstants";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

export function DecisionModelConfigurationCard({
  modelName,
  modelProvider,
  customProviderName,
}: {
  modelName: string;
  modelProvider: string;
  customProviderName?: string | null;
}) {
  const provider =
    customProviderName ??
    (isModelProvider(modelProvider)
      ? ModelProviders[modelProvider]
      : modelProvider);
  return (
    <Card title="Model Configuration" collapsible>
      <DisclosureGroup defaultExpandedKeys={["llm"]}>
        <LLMDisclosure model={modelName} provider={provider} />
      </DisclosureGroup>
    </Card>
  );
}
