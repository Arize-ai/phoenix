import { Suspense } from "react";

import { Button, Card, Flex, Loading, Text, View } from "@phoenix/components";
import type { ModelMenuValue } from "@phoenix/components/generative";
import { ModelMenu } from "@phoenix/components/generative";
import {
  DEFAULT_MODEL_NAME,
  DEFAULT_MODEL_PROVIDER,
  ModelProviders,
} from "@phoenix/constants/generativeConstants";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

/**
 * Settings card that lets the user choose the default provider + model used
 * when the playground (or related surfaces) opens for the first time.
 *
 * The preference is stored in the browser via the persisted preferences store.
 * When unset, the playground falls back to {@link DEFAULT_MODEL_PROVIDER} and
 * {@link DEFAULT_MODEL_NAME}.
 */
export function DefaultPlaygroundModelCard() {
  return (
    <Card title="Default Provider and Model">
      <View padding="size-200">
        <Flex direction="column" gap="size-150" alignItems="start">
          <Text size="XS" color="text-700">
            The provider and model to use as the default when opening the
            playground. When unset, the playground defaults to{" "}
            {ModelProviders[DEFAULT_MODEL_PROVIDER]} {DEFAULT_MODEL_NAME}.
          </Text>
          <Suspense fallback={<Loading size="S" />}>
            <DefaultModelControls />
          </Suspense>
        </Flex>
      </View>
    </Card>
  );
}

function DefaultModelControls() {
  const defaultModelProvider = usePreferencesContext(
    (state) => state.defaultModelProvider
  );
  const defaultModelName = usePreferencesContext(
    (state) => state.defaultModelName
  );
  const setDefaultModelProvider = usePreferencesContext(
    (state) => state.setDefaultModelProvider
  );
  const setDefaultModelName = usePreferencesContext(
    (state) => state.setDefaultModelName
  );

  const value: ModelMenuValue | null =
    defaultModelProvider && defaultModelName
      ? { provider: defaultModelProvider, modelName: defaultModelName }
      : null;

  const isDefaultSet = defaultModelProvider != null || defaultModelName != null;

  return (
    <Flex direction="row" gap="size-100" alignItems="center">
      <ModelMenu
        value={value}
        onChange={(next) => {
          setDefaultModelProvider(next.provider);
          setDefaultModelName(next.modelName);
        }}
      />
      {isDefaultSet ? (
        <Button
          size="S"
          variant="quiet"
          onPress={() => {
            setDefaultModelProvider(undefined);
            setDefaultModelName(undefined);
          }}
        >
          Reset
        </Button>
      ) : null}
    </Flex>
  );
}
