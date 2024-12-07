import React, { useMemo, useState } from "react";
import { graphql, useFragment } from "react-relay";

import { PickerProps } from "@arizeai/components";

import { ComboBox, ComboBoxItem } from "@phoenix/components";

import { ModelComboBoxFragment$key } from "./__generated__/ModelComboBoxFragment.graphql";

type ModelComboBoxProps = {
  query: ModelComboBoxFragment$key;
  onChange: (model: string) => void;
  provider: ModelProvider;
  modelName: string | null;
  container?: HTMLElement;
} & Omit<
  PickerProps<string>,
  "children" | "onSelectionChange" | "defaultSelectedKey"
>;

export function ModelComboBox({
  query,
  onChange,
  container,
  ...props
}: ModelComboBoxProps) {
  const data = useFragment<ModelComboBoxFragment$key>(
    graphql`
      fragment ModelComboBoxFragment on Query
      @argumentDefinitions(
        providerKey: { type: "GenerativeProviderKey!", defaultValue: OPENAI }
      ) {
        models(input: { providerKey: $providerKey }) {
          name
        }
      }
    `,
    query
  );

  const [modelInput, setModelInput] = useState("");

  const items = useMemo(() => {
    const items = data.models.map((model) => ({
      name: model.name,
      id: model.name,
    }));

    if (
      modelInput !== "" &&
      !items.some(
        (model) =>
          model.name.toLocaleLowerCase() === modelInput.toLocaleLowerCase()
      )
    ) {
      items.push({ name: modelInput, id: modelInput });
    }
    return items;
  }, [data.models, modelInput]);
  return (
    <ComboBox
      label={"Model"}
      size="L"
      data-testid="model-picker"
      // Fallback to empty string here otherwise the picker will complain about switching from a controlled to uncontrolled component
      // It can't distinguish between undefined and intentionally null
      selectedKey={props.modelName ?? ""}
      aria-label="model picker"
      placeholder="Select a model"
      // inputValue={modelInput}
      onInputChange={setModelInput}
      onSelectionChange={(key) => {
        if (typeof key === "string") {
          onChange(key);
        }
      }}
      width={"100%"}
      {...props}
      defaultItems={items}
      menuTrigger="focus"
      container={container}
    >
      {(item) => <ComboBoxItem key={item.name}>{item.name}</ComboBoxItem>}
    </ComboBox>
  );
}
