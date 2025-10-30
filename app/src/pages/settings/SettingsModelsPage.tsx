import { startTransition, useState } from "react";
import { usePreloadedQuery } from "react-relay";
import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import {
  Button,
  Card,
  DebouncedSearch,
  Flex,
  ListBox,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  Text,
} from "@phoenix/components";
import { GenerativeModelKind } from "@phoenix/pages/settings/__generated__/ModelsTable_generativeModels.graphql";
import {
  settingsModelsLoaderGql,
  SettingsModelsLoaderType,
} from "@phoenix/pages/settings/settingsModelsLoader";

import { ModelsTable } from "./ModelsTable";
import { NewModelButton } from "./NewModelButton";

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
  const data = usePreloadedQuery(settingsModelsLoaderGql, loaderData);

  return (
    <Flex direction="column" gap="size-200">
      <Flex gap="size-200" alignItems="center" justifyContent="space-between">
        <DebouncedSearch
          aria-label="Search models"
          placeholder="Search models"
          onChange={(value) => {
            setSearch(value);
          }}
          defaultValue={search}
        />
        <Select
          aria-label="Model kind filter"
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
                <SelectItem id={item.id} textValue={item.id}>
                  {item.label}
                </SelectItem>
              )}
            </ListBox>
          </Popover>
        </Select>
      </Flex>
      <Card
        title="Models"
        extra={
          <Flex direction="row" gap="size-200" alignItems="center">
            <Text color="text-500" size="S">
              All costs shown in USD per 1M tokens
            </Text>
            <NewModelButton />
          </Flex>
        }
      >
        <ModelsTable modelsRef={data} kindFilter={kindFilter} search={search} />
      </Card>
    </Flex>
  );
}
