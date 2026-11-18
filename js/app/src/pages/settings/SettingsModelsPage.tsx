import { startTransition, useState } from "react";
import { usePreloadedQuery } from "react-relay";
import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import {
  Button,
  Card,
  DebouncedSearch,
  DocumentationHelp,
  Flex,
  ListBox,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  Text,
  View,
} from "@phoenix/components";
import type { GenerativeModelKind } from "@phoenix/pages/settings/__generated__/ModelsTable_generativeModels.graphql";
import type { settingsModelsLoaderQuery } from "@phoenix/pages/settings/__generated__/settingsModelsLoaderQuery.graphql";
import type { SettingsModelsLoaderType } from "@phoenix/pages/settings/settingsModelsLoader";
import { settingsModelsLoaderGql } from "@phoenix/pages/settings/settingsModelsLoader";

import { ModelsTable } from "./ModelsTable";
import { NewModelButton } from "./NewModelButton";
import { useModelCostManifestDescription } from "./useModelCostManifestDescription";

const ModelKindFilterOptions = [
  { label: "All", id: "ALL" },
  { label: "Custom", id: "CUSTOM" },
  { label: "Built-in", id: "BUILT_IN" },
];

export function SettingsModelsPage() {
  const [kindFilter, setKindFilter] = useState<"ALL" | GenerativeModelKind>(
    "ALL"
  );
  const [search, setSearch] = useState("");
  const loaderData = useLoaderData<SettingsModelsLoaderType>();
  invariant(loaderData, "loaderData is required");
  const data = usePreloadedQuery<settingsModelsLoaderQuery>(
    settingsModelsLoaderGql,
    loaderData
  );
  const modelCostManifestDescription = useModelCostManifestDescription(data);

  return (
    <Card
      title="Model Costs"
      subTitle={modelCostManifestDescription}
      titleExtra={
        <DocumentationHelp topic="modelPricing">
          Manage the model matching rules and token prices Phoenix uses to
          calculate costs.
        </DocumentationHelp>
      }
      flex="1 1 auto"
      minHeight={0}
      extra={
        <Flex direction="row" gap="size-200" alignItems="center">
          <Text color="text-500" size="S">
            All costs shown in USD per 1M tokens
          </Text>
          <NewModelButton />
        </Flex>
      }
    >
      <Flex direction="column" height="100%">
        <View
          paddingX="size-200"
          paddingY="size-100"
          borderBottomWidth="thin"
          borderBottomColor="default"
          flex="none"
        >
          <Flex direction="row" alignItems="center" gap="size-100">
            <DebouncedSearch
              aria-label="Search model costs"
              placeholder="Search model costs"
              onChange={(value) => {
                setSearch(value);
              }}
              defaultValue={search}
            />
            <Select
              aria-label="Filter model costs by source"
              value={kindFilter}
              onChange={(value) => {
                startTransition(() => {
                  setKindFilter(value as typeof kindFilter);
                });
              }}
              selectionMode="single"
            >
              <Button>
                <SelectValue />
                <SelectChevronUpDownIcon />
              </Button>
              <Popover>
                <ListBox items={ModelKindFilterOptions}>
                  {(item) => (
                    <SelectItem id={item.id} textValue={item.label}>
                      {item.label}
                    </SelectItem>
                  )}
                </ListBox>
              </Popover>
            </Select>
          </Flex>
        </View>
        <View flex="1 1 auto" minHeight={0}>
          <ModelsTable
            modelsRef={data}
            kindFilter={kindFilter}
            search={search}
          />
        </View>
      </Flex>
    </Card>
  );
}
