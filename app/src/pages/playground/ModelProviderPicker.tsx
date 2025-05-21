import { graphql, useFragment } from "react-relay";

import {
  Item,
  Picker,
  PickerProps,
  Tooltip,
  TooltipTrigger,
  TriggerWrap,
} from "@arizeai/components";

import { Flex, Icon, Icons } from "@phoenix/components";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import type { ModelProviderPickerFragment$key } from "./__generated__/ModelProviderPickerFragment.graphql";

type ModelProviderPickerProps = {
  onChange: (provider: ModelProvider) => void;
  query: ModelProviderPickerFragment$key;
  provider?: ModelProvider;
} & Omit<
  PickerProps<ModelProvider>,
  "children" | "onSelectionChange" | "defaultSelectedKey"
>;

export function ModelProviderPicker({
  onChange,
  query,
  ...props
}: ModelProviderPickerProps) {
  const data = useFragment<ModelProviderPickerFragment$key>(
    graphql`
      fragment ModelProviderPickerFragment on Query {
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
      <Picker
        label={"Provider"}
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
        width={"100%"}
        {...props}
      >
        {data.modelProviders.map((provider) => {
          return (
            <Item key={provider.key}>
              <Flex direction="row" gap="size-100" alignItems="center">
                <GenerativeProviderIcon provider={provider.key} height={16} />
                {provider.name}
              </Flex>
            </Item>
          );
        })}
      </Picker>
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
                <>
                  {provider.dependencies?.join(", ") ?? provider.name}
                  <br />
                </>
              ))}
          </Tooltip>
        </TooltipTrigger>
      ) : null}
    </Flex>
  );
}
