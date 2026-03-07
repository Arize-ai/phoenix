import { css } from "@emotion/react";
import { useCallback, useEffect } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { useShallow } from "zustand/react/shallow";

import { Button, Flex, Label, Text } from "@phoenix/components";
import { SelectChevronUpDownIcon } from "@phoenix/components/icon";
import { ListBox, ListBoxItem } from "@phoenix/components/listbox";
import { Popover } from "@phoenix/components/overlay";
import { Select, SelectValue } from "@phoenix/components/select";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";
import { SandboxMismatchIcon } from "@phoenix/components/evaluators/SandboxMismatchBanner";

import type { SandboxTypeSelectorQuery } from "./__generated__/SandboxTypeSelectorQuery.graphql";

const LOCAL_STORAGE_KEY = "phoenix:sandbox:defaultBackendType";

function getStoredBackendType(): string {
  try {
    return localStorage.getItem(LOCAL_STORAGE_KEY) ?? "WASM";
  } catch {
    return "WASM";
  }
}

function storeBackendType(backendType: string) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, backendType);
  } catch {
    // ignore storage errors
  }
}

export const SandboxTypeSelector = () => {
  const { sandboxBackendType, savedSandboxBackendType, setSandboxBackendType } =
    useEvaluatorStore(
      useShallow((state) => ({
        sandboxBackendType: state.sandboxBackendType,
        savedSandboxBackendType: state.savedSandboxBackendType,
        setSandboxBackendType: state.setSandboxBackendType,
      }))
    );

  const data = useLazyLoadQuery<SandboxTypeSelectorQuery>(
    graphql`
      query SandboxTypeSelectorQuery {
        sandboxBackends {
          key
          label
          status
        }
      }
    `,
    {}
  );

  const availableBackends = data.sandboxBackends.filter(
    (b) => b.status === "AVAILABLE"
  );

  // On mount, initialize from local storage if the store has the default value
  useEffect(() => {
    const stored = getStoredBackendType();
    if (stored !== "WASM" && sandboxBackendType === "WASM") {
      setSandboxBackendType(stored);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = useCallback(
    (value: unknown) => {
      if (typeof value === "string") {
        setSandboxBackendType(value);
        storeBackendType(value);
      }
    },
    [setSandboxBackendType]
  );

  const showTypeSwitchWarning =
    savedSandboxBackendType !== undefined &&
    sandboxBackendType !== savedSandboxBackendType;

  return (
    <Flex direction="column" gap="size-50">
      <Select
        selectionMode="single"
        value={sandboxBackendType}
        onChange={handleChange}
        aria-label="Sandbox backend type"
      >
        <Label>Sandbox Runtime</Label>
        <Button
          trailingVisual={<SelectChevronUpDownIcon />}
          size="S"
          css={css`
            width: 100%;
          `}
        >
          <SelectValue />
        </Button>
        <Popover
          css={css`
            width: var(--trigger-width);
          `}
        >
          <ListBox>
            {availableBackends.map((backend) => (
              <ListBoxItem
                key={backend.key}
                id={backend.key}
                textValue={backend.key}
              >
                <Text>{backend.label}</Text>
              </ListBoxItem>
            ))}
          </ListBox>
        </Popover>
      </Select>
      {showTypeSwitchWarning && (
        <Flex direction="row" gap="size-50" alignItems="center">
          <SandboxMismatchIcon />
          <Text size="S" color="warning">
            {`This evaluator was last saved with ${savedSandboxBackendType}. Switching backends may change behavior.`}
          </Text>
        </Flex>
      )}
    </Flex>
  );
};
