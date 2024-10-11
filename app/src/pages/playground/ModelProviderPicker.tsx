import React from "react";

import { Item, Picker, PickerProps } from "@arizeai/components";

type ModelProviderPickerProps = {
  onChange: (provider: ModelProvider) => void;
  provider?: ModelProvider;
} & Omit<
  PickerProps<ModelProvider>,
  "children" | "onSelectionChange" | "defaultSelectedKey"
>;

function isModelProvider(key: string): key is ModelProvider {
  return Object.values(ModelProvider).includes(key as ModelProvider);
}

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
      onSelectionChange={(key) => {
        const provider = key as string;
        if (isModelProvider(provider)) {
          onChange(provider);
        }
      }}
      width={"100%"}
      {...props}
    >
      <Item key={ModelProvider.OPENAI}>{ModelProvider.OPENAI}</Item>
      <Item key={ModelProvider.AZURE_OPENAI}>{ModelProvider.AZURE_OPENAI}</Item>
      <Item key={ModelProvider.ANTHROPIC}>{ModelProvider.ANTHROPIC}</Item>
    </Picker>
  );
}
