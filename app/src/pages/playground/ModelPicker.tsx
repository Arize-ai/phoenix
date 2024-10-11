import React, { useMemo } from "react";
import { graphql, useFragment } from "react-relay";

import { Item, Picker, PickerProps } from "@arizeai/components";

import { ModelPickerFragment$key } from "./__generated__/ModelPickerFragment.graphql";

type ModelPickerProps = {
  query: ModelPickerFragment$key;
  onChange: (model: string) => void;
  provider: ModelProvider;
  modelName: string | null;
} & Omit<
  PickerProps<string>,
  "children" | "onSelectionChange" | "defaultSelectedKey"
>;

export function ModelPicker({ query, onChange, ...props }: ModelPickerProps) {
  const data = useFragment<ModelPickerFragment$key>(
    graphql`
      fragment ModelPickerFragment on Query {
        modelProviders(vendors: ["OpenAI", "Anthropic"]) {
          name
          modelNames
        }
      }
    `,
    query
  );
  const modelNames = useMemo(() => {
    // TODO: Lowercase is not enough for things like Azure OpenAI
    const provider = data.modelProviders.find(
      (provider) => provider.name.toLowerCase() === props.provider.toLowerCase()
    );
    return provider?.modelNames ?? [];
  }, [data, props.provider]);
  return (
    <Picker
      label={"Model"}
      data-testid="model-picker"
      selectedKey={props.modelName ?? undefined}
      aria-label="model picker"
      placeholder="Select a model"
      onSelectionChange={(key) => {
        if (typeof key === "string") {
          onChange(key);
        }
      }}
      width={"100%"}
      {...props}
    >
      {modelNames.map((modelName) => {
        return <Item key={modelName}>{modelName}</Item>;
      })}
    </Picker>
  );
}
