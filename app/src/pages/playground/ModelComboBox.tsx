import { useEffect, useMemo, useState } from "react";
import { Key } from "react-aria-components";
import {
  graphql,
  PreloadedQuery,
  usePreloadedQuery,
  useQueryLoader,
} from "react-relay";

import { ComboBox, ComboBoxItem, ComboBoxProps } from "@phoenix/components";

import modelsQuery, {
  ModelComboBoxQuery,
} from "./__generated__/ModelComboBoxQuery.graphql";
type ModelItem = {
  name: string;
  id: string;
};

type ModelComboBoxProps = {
  onChange: (model: string) => void;
  provider: ModelProvider;
  modelName: string | null;
  container?: HTMLElement;
} & Omit<
  ComboBoxProps<ModelItem>,
  "children" | "onSelectionChange" | "defaultSelectedKey"
>;

export function ModelComboBoxLoader({
  onChange,
  container,
  modelName,
  queryReference,
  ...comboBoxProps
}: ModelComboBoxProps & {
  queryReference: PreloadedQuery<ModelComboBoxQuery>;
}) {
  const data = usePreloadedQuery(modelsQuery, queryReference);
  const items = useMemo((): ModelItem[] => {
    return data.models.map((model) => ({
      name: model.name,
      id: model.name,
    }));
  }, [data.models]);

  const [fieldState, setFieldState] = useState({
    selectedKey: modelName ?? null,
    inputValue: modelName ?? "",
  });

  const onSelectionChange = (key: Key | null) => {
    if (typeof key === "string") {
      const item = items.find((item) => item.id === key);
      item?.name != null && onChange(item.name);
    }
  };

  const onInputChange = (value: string) => {
    setFieldState((prevState) => ({
      inputValue: value,
      selectedKey: prevState.selectedKey,
    }));
  };

  useEffect(() => {
    setFieldState({
      selectedKey: modelName ?? null,
      inputValue: modelName ?? "",
    });
  }, [modelName]);

  return (
    <ComboBox
      size="L"
      label="Model"
      isRequired
      data-testid="model-picker"
      selectedKey={fieldState.selectedKey}
      aria-label="model picker"
      onInputChange={onInputChange}
      inputValue={fieldState.inputValue}
      onSelectionChange={onSelectionChange}
      width={"100%"}
      allowsCustomValue
      onBlur={() => {
        if (fieldState.inputValue !== "") {
          onChange(fieldState.inputValue);
        }
      }}
      onKeyUp={(e) => {
        if (e.key === "Enter") {
          onChange(fieldState.inputValue);
        }
      }}
      menuTrigger="focus"
      container={container}
      description={"Choose a model from the list, or enter a custom model name"}
      defaultItems={items}
      {...comboBoxProps}
    >
      {(item) => {
        return (
          <ComboBoxItem key={item.id} textValue={item.name} id={item.id}>
            {item.name}
          </ComboBoxItem>
        );
      }}
    </ComboBox>
  );
}

export function ModelComboBox(props: ModelComboBoxProps) {
  const [queryReference, loadQuery, disposeQuery] =
    useQueryLoader<ModelComboBoxQuery>(modelsQuery);

  useEffect(() => {
    loadQuery({ providerKey: props.provider });
    return () => disposeQuery();
  }, [disposeQuery, loadQuery, props.provider]);

  return queryReference != null ? (
    <ModelComboBoxLoader queryReference={queryReference} {...props} />
  ) : null;
}

graphql`
  query ModelComboBoxQuery($providerKey: GenerativeProviderKey!) {
    models(input: { providerKey: $providerKey }) {
      name
    }
  }
`;
