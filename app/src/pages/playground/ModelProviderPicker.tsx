import React from "react";
import { graphql, useFragment } from "react-relay";

import { Item, Picker, PickerProps } from "@arizeai/components";

import { isModelProvider } from "@phoenix/utils/generativeUtils";

import type { ModelProviderPickerFragment$key } from "./__generated__/ModelProviderPickerFragment.graphql";

type ModelProviderPickerProps = {
  onChange: (provider: ModelProvider) => void;
  query: ModelProviderPickerFragment$key;
  provider?: ModelProvider;
} & Omit<
  PickerProps<ModelProvider>,
  "children" | "onSelectionChange" | "defaultSelectedKey"
>;

export function ModelProviderPicker({
  onChange,
  query,
  ...props
}: ModelProviderPickerProps) {
  const data = useFragment<ModelProviderPickerFragment$key>(
    graphql`
      fragment ModelProviderPickerFragment on Query {
        modelProviders {
          key
          name
        }
      }
    `,
    query
  );
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
      {data.modelProviders.map((provider) => {
        return <Item key={provider.key}>{provider.name}</Item>;
      })}
    </Picker>
  );
}
