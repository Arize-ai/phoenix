import { Fragment } from "react";
import { graphql, useFragment } from "react-relay";

import { Tooltip, TooltipTrigger, TriggerWrap } from "@arizeai/components";

import {
  Button,
  Flex,
  Icon,
  Icons,
  Label,
  ListBox,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectProps,
  SelectValue,
} from "@phoenix/components";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import type { ModelProviderSelectFragment$key } from "./__generated__/ModelProviderSelectFragment.graphql";

type ModelProviderSelectProps = {
  onChange: (provider: ModelProvider) => void;
  query: ModelProviderSelectFragment$key;
  provider?: ModelProvider;
} & Omit<SelectProps, "children" | "onSelectionChange" | "selectedKey">;

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
  const hasMissingDependencies =
    installedProviders.length !== data.modelProviders.length;
  const selectedProviderNotInstalled =
    props.provider &&
    !installedProviders.some((provider) => provider.key === props.provider);
  return (
    <Flex direction="row" gap="size-100">
      <Select
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
        {...props}
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
                <SelectItem key={provider.key} id={provider.key}>
                  <Flex direction="row" gap="size-100" alignItems="center">
                    <GenerativeProviderIcon
                      provider={provider.key}
                      height={16}
                    />
                    {provider.name}
                  </Flex>
                </SelectItem>
              );
            })}
          </ListBox>
        </Popover>
      </Select>
      {selectedProviderNotInstalled ? (
        <TooltipTrigger delay={0} offset={5}>
          <span>
            <TriggerWrap>
              <Icon color="red-700" svg={<Icons.InfoOutline />} />
            </TriggerWrap>
          </span>
          <Tooltip>
            The selected provider is not installed. Install{" "}
            {data.modelProviders
              .find((p) => p.key === props.provider)
              ?.dependencies?.join(", ") ?? "the dependencies"}{" "}
            to use its models in Playground.
          </Tooltip>
        </TooltipTrigger>
      ) : hasMissingDependencies ? (
        <TooltipTrigger delay={0} offset={5}>
          <span>
            <TriggerWrap>
              <Icon svg={<Icons.InfoOutline />} />
            </TriggerWrap>
          </span>
          <Tooltip>
            Some providers are missing dependencies. Install them to use their
            models in Playground.
            <br />
            <br />
            Missing providers:
            <br />
            {data.modelProviders
              .filter((provider) => !provider.dependenciesInstalled)
              .map((provider) => (
                <Fragment key={provider.key}>
                  {provider.dependencies?.join(", ") ?? provider.name}
                  <br />
                </Fragment>
              ))}
          </Tooltip>
        </TooltipTrigger>
      ) : null}
    </Flex>
  );
}
