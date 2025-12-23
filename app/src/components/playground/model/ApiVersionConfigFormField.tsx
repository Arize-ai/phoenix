import { ComboBox, ComboBoxItem } from "@phoenix/components";
import { AZURE_OPENAI_API_VERSIONS } from "@phoenix/constants/generativeConstants";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

export type ApiVersionConfigFormFieldProps = {
  /**
   * The playground instance ID to configure
   */
  playgroundInstanceId: number;
};

/**
 * Form field for configuring the API version for Azure OpenAI.
 * Provides a combobox with predefined versions but allows custom values.
 */
export function ApiVersionConfigFormField({
  playgroundInstanceId,
}: ApiVersionConfigFormFieldProps) {
  const instance = usePlaygroundContext((state) =>
    state.instances.find((instance) => instance.id === playgroundInstanceId)
  );
  const updateModel = usePlaygroundContext((state) => state.updateModel);

  if (!instance) {
    return null;
  }

  const handleApiVersionChange = (value: string) => {
    updateModel({
      instanceId: playgroundInstanceId,
      patch: {
        apiVersion: value,
      },
    });
  };

  return (
    <ComboBox
      size="L"
      label="API Version"
      data-testid="azure-api-version-combobox"
      selectedKey={instance.model.apiVersion ?? undefined}
      aria-label="api version picker"
      placeholder="Select an AzureOpenAI API Version"
      inputValue={instance.model.apiVersion ?? ""}
      onInputChange={handleApiVersionChange}
      onSelectionChange={(key) => {
        if (typeof key === "string") {
          handleApiVersionChange(key);
        }
      }}
      allowsCustomValue
    >
      {AZURE_OPENAI_API_VERSIONS.map((version) => (
        <ComboBoxItem key={version} textValue={version} id={version}>
          {version}
        </ComboBoxItem>
      ))}
    </ComboBox>
  );
}
