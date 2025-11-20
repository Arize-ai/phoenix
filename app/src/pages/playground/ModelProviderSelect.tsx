import { graphql, useFragment } from "react-relay";

import {
  Button,
  Flex,
  Label,
  ListBox,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectProps,
  SelectValue,
  Text,
} from "@phoenix/components";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import type { ModelProviderSelectFragment$key } from "./__generated__/ModelProviderSelectFragment.graphql";

type ModelProviderSelectProps = {
  onChange: (provider: ModelProvider) => void;
  query: ModelProviderSelectFragment$key;
  provider?: ModelProvider;
} & Omit<SelectProps, "children" | "onChange" | "value" | "validate">;

export function ModelProviderSelect({
  onChange,
  query,
  ...props
}: ModelProviderSelectProps) {
  const data = useFragment<ModelProviderSelectFragment$key>(
    graphql`
      fragment ModelProviderSelectFragment on Query {
        modelProviders {
          key
          name
          dependenciesInstalled
          dependencies
        }
      }
    `,
    query
  );
  const installedProviders = data.modelProviders.filter(
    (provider) => provider.dependenciesInstalled
  );
  const selectedProviderNotInstalled =
    props.provider &&
    !installedProviders.some((provider) => provider.key === props.provider);
  return (
    <Select
      {...props}
      key="model-provider-select"
      data-testid="model-provider-picker"
      selectionMode="single"
      value={props.provider ?? undefined}
      isInvalid={selectedProviderNotInstalled}
      aria-label="Model Provider"
      placeholder="Select a provider"
      onChange={(key) => {
        const provider = key as string;
        if (isModelProvider(provider)) {
          onChange(provider);
        }
      }}
    >
      <Label>Provider</Label>
      <Button>
        <SelectValue />
        <SelectChevronUpDownIcon />
      </Button>
      <Popover>
        <ListBox>
          {data.modelProviders.map((provider) => {
            return (
              <SelectItem
                key={provider.key}
                id={provider.key}
                textValue={provider.name}
              >
                <Flex direction="row" gap="size-100" alignItems="center">
                  <GenerativeProviderIcon provider={provider.key} height={16} />
                  <Text>{provider.name}</Text>
                </Flex>
              </SelectItem>
            );
          })}
        </ListBox>
      </Popover>
      {selectedProviderNotInstalled ? (
        <Text slot="errorMessage" color="danger">
          Provider not installed
        </Text>
      ) : null}
    </Select>
  );
}
