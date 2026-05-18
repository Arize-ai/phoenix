import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  Button,
  FieldError,
  Flex,
  Label,
  ListBox,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  type SelectProps,
  Text,
} from "@phoenix/components";
import { SandboxProviderIcon } from "@phoenix/components/sandbox/SandboxProviderIcon";
import { languageLabel } from "@phoenix/pages/settings/sandboxes/utils";

import type {
  SandboxProviderSelectQuery,
  SandboxProviderSelectQuery$data,
} from "./__generated__/SandboxProviderSelectQuery.graphql";

type SandboxBackend =
  SandboxProviderSelectQuery$data["sandboxBackends"][number];
type SandboxProvider =
  SandboxProviderSelectQuery$data["sandboxProviders"][number];

/**
 * A single selectable sandbox provider, joined with its backend so the option
 * can render the backend's display name + icon.
 */
export type SandboxProviderOption = {
  provider: SandboxProvider;
  backend: SandboxBackend;
};

type SandboxProviderSelectProps = Pick<
  SelectProps,
  "selectedKey" | "onBlur" | "isDisabled" | "isInvalid"
> & {
  onChange?: (sandboxProviderId: string) => void;
  errorMessage?: string;
  /**
   * Optional predicate to narrow which providers are offered (e.g. only those
   * whose backend is available and whose admin toggle is enabled). When
   * omitted, every sandbox provider is listed. The currently `selectedKey` is
   * always kept in the list so a controlled value never disappears.
   */
  filter?: (option: SandboxProviderOption) => boolean;
};

function SandboxProviderOptionContent({
  option,
}: {
  option: SandboxProviderOption;
}) {
  return (
    <Flex direction="row" gap="size-100" alignItems="center">
      <SandboxProviderIcon kind={option.backend.kind} height={18} />
      <Text>{option.backend.displayName}</Text>
      <Text color="text-500">
        {option.provider.supportedLanguages.map(languageLabel).join(" · ")}
      </Text>
    </Flex>
  );
}

/**
 * Self-contained sandbox provider `<Select>`. Fetches the available sandbox
 * providers (and their backends) itself, so it can be dropped into any form
 * without the parent wiring up provider data. Wrap in `<Suspense>`.
 */
export function SandboxProviderSelect({
  selectedKey,
  onChange,
  onBlur,
  isDisabled,
  isInvalid,
  errorMessage,
  filter,
}: SandboxProviderSelectProps) {
  const data = useLazyLoadQuery<SandboxProviderSelectQuery>(
    graphql`
      query SandboxProviderSelectQuery {
        sandboxBackends {
          kind
          displayName
          hostingType
          status
        }
        sandboxProviders {
          id
          kind
          supportedLanguages
          enabled
        }
      }
    `,
    {}
  );

  const options = useMemo(() => {
    const backendByKind = new Map(
      data.sandboxBackends.map((backend) => [backend.kind, backend])
    );
    return data.sandboxProviders
      .map((provider) => ({
        provider,
        backend: backendByKind.get(provider.kind),
      }))
      .filter(
        (option): option is SandboxProviderOption => option.backend != null
      )
      .filter(
        (option) =>
          option.provider.id === selectedKey || filter == null || filter(option)
      )
      .sort((a, b) => {
        // Local providers first, then alphabetical by display name.
        const aLocal = a.backend.hostingType === "LOCAL" ? 0 : 1;
        const bLocal = b.backend.hostingType === "LOCAL" ? 0 : 1;
        if (aLocal !== bLocal) return aLocal - bLocal;
        return a.backend.displayName.localeCompare(b.backend.displayName);
      });
  }, [data.sandboxBackends, data.sandboxProviders, selectedKey, filter]);

  return (
    <Select
      size="M"
      selectedKey={selectedKey}
      isDisabled={isDisabled}
      isInvalid={isInvalid}
      placeholder="Select a sandbox provider"
      onSelectionChange={(key) => {
        if (typeof key === "string") {
          onChange?.(key);
        }
      }}
      onBlur={onBlur}
    >
      <Label>Sandbox Provider</Label>
      <Button>
        <SelectValue />
        <SelectChevronUpDownIcon />
      </Button>
      <Popover>
        <ListBox>
          {options.map((option) => (
            <SelectItem
              key={option.provider.id}
              id={option.provider.id}
              textValue={option.backend.displayName}
            >
              <SandboxProviderOptionContent option={option} />
            </SelectItem>
          ))}
        </ListBox>
      </Popover>
      <FieldError>{errorMessage}</FieldError>
    </Select>
  );
}

/**
 * Fallback to render inside `<Suspense>` while {@link SandboxProviderSelect}
 * loads its provider list — a disabled, empty select that matches the real
 * control's footprint so the form doesn't jump.
 */
export function SandboxProviderSelectFallback() {
  return (
    <Select size="M" isDisabled placeholder="Loading…">
      <Label>Sandbox Provider</Label>
      <Button>
        <SelectValue />
        <SelectChevronUpDownIcon />
      </Button>
      <Popover>
        <ListBox />
      </Popover>
    </Select>
  );
}
