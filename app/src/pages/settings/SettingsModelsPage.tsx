import { startTransition, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { css } from "@emotion/react";

import { Card } from "@arizeai/components";

import {
  Button,
  Flex,
  Input,
  ListBox,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  Text,
  TextField,
} from "@phoenix/components";
import { GenerativeModelKind } from "@phoenix/pages/settings/__generated__/ModelsTable_generativeModels.graphql";
import { SettingsModelsPageQuery } from "@phoenix/pages/settings/__generated__/SettingsModelsPageQuery.graphql";

import { ModelsTable } from "./ModelsTable";
import { NewModelButton } from "./NewModelButton";

const ModelKindFilterOptions = [
  { label: "All", value: "ALL" },
  { label: "Custom", value: "CUSTOM" },
  { label: "Built-in", value: "BUILT_IN" },
];

export function SettingsModelsPage() {
  const [kindFilter, setKindFilter] = useState<"ALL" | GenerativeModelKind>(
    "ALL"
  );
  const [search, setSearch] = useState("");
  const data = useLazyLoadQuery<SettingsModelsPageQuery>(
    graphql`
      query SettingsModelsPageQuery {
        ...ModelsTable_generativeModels
      }
    `,
    {}
  );

  return (
    <Flex direction="column" gap="size-200">
      <Flex gap="size-200" alignItems="center" justifyContent="space-between">
        <TextField
          aria-label="Search models"
          defaultValue={search}
          onChange={(value) => {
            startTransition(() => {
              setSearch(value);
            });
          }}
        >
          <Input placeholder="Search models" />
        </TextField>
        <Select
          selectedKey={kindFilter}
          onSelectionChange={(value) => {
            startTransition(() => {
              setKindFilter(value as typeof kindFilter);
            });
          }}
        >
          <Button>
            <span
              css={css`
                text-transform: capitalize;
              `}
            >
              {
                ModelKindFilterOptions.find(
                  (option) => option.value === kindFilter
                )?.label
              }
            </span>
            <SelectChevronUpDownIcon />
          </Button>
          <Popover>
            <ListBox>
              {ModelKindFilterOptions.map((option) => (
                <SelectItem key={option.value} id={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </ListBox>
          </Popover>
        </Select>
      </Flex>
      <Card
        title="Models"
        variant="compact"
        extra={
          <Flex direction="row" gap="size-200" alignItems="center">
            <Text color="text-500" size="S">
              All costs shown in USD per 1M tokens
            </Text>
            <NewModelButton />
          </Flex>
        }
        bodyStyle={{ padding: 0 }}
      >
        <ModelsTable modelsRef={data} kindFilter={kindFilter} search={search} />
      </Card>
    </Flex>
  );
}
