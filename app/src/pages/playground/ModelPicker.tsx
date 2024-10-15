import React from "react";
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
      fragment ModelPickerFragment on Query
      @argumentDefinitions(
        providerKey: { type: "GenerativeProviderKey!", defaultValue: OPENAI }
      ) {
        modelNames(input: { providerKey: $providerKey })
      }
    `,
    query
  );
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
      {data.modelNames.map((modelName) => {
        return <Item key={modelName}>{modelName}</Item>;
      })}
    </Picker>
  );
}
