import React, { useMemo, useState } from "react";
import { graphql, useFragment } from "react-relay";

import { Flex, Item, Picker, PickerProps, Search } from "@arizeai/components";

import { SearchableSelector } from "@phoenix/components/SearchableSelector";

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
        models(input: { providerKey: $providerKey }) {
          name
        }
      }
    `,
    query
  );

  const [searchTerm, setSearchTerm] = useState("");

  const models = useMemo(() => {
    return data.models.filter(({ name }) =>
      name.toLocaleLowerCase().includes(searchTerm.toLocaleLowerCase())
    );
  }, [data.models, searchTerm]);
  return (
    <Flex direction="column" gap="size-100">
      <Picker
        label={"Model"}
        data-testid="model-picker"
        // Fallback to empty string here otherwise the picker will complain about switching from a controlled to uncontrolled component
        // It can't distinguish between undefined and intentionally null
        selectedKey={props.modelName ?? ""}
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
        {data.models.map(({ name }) => {
          return <Item key={name}>{name}</Item>;
        })}
      </Picker>
      <SearchableSelector
        placeholder="Select a model"
        selectionMode="single"
        selectedKeys={props.modelName ? new Set([props.modelName]) : new Set()}
        onSelectionChange={(keys) => {
          if (keys === "all" || keys.size === 0) {
            return;
          }
          const key = keys.values().next().value;
          typeof key === "string" && onChange(key);
        }}
        items={data.models}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
      >
        {models.map(({ name }) => {
          return <Item key={name}>{name}</Item>;
        })}
      </SearchableSelector>
    </Flex>
  );
}
