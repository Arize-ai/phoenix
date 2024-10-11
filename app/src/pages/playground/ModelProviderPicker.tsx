import React from "react";

import { Item, Picker, PickerProps } from "@arizeai/components";

import { ModelProviders } from "@phoenix/constants/generativeConstants";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

type ModelProviderPickerProps = {
  onChange: (provider: ModelProvider) => void;
  provider?: ModelProvider;
} & Omit<
  PickerProps<ModelProvider>,
  "children" | "onSelectionChange" | "defaultSelectedKey"
>;

export function ModelProviderPicker({
  onChange,
  ...props
}: ModelProviderPickerProps) {
  return (
    <Picker
      label={"Provider"}
      data-testid="model-provider-picker"
      selectedKey={props.provider ?? undefined}
      aria-label="Model Provider"
      placeholder="Select a provider"
      onSelectionChange={(key) => {
        const provider = key as string;
        if (isModelProvider(provider)) {
          onChange(provider);
        }
      }}
      width={"100%"}
      {...props}
    >
      {Object.entries(ModelProviders).map(([key, value]) => {
        return <Item key={key}>{value}</Item>;
      })}
    </Picker>
  );
}
