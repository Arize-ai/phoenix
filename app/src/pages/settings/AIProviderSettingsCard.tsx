import { Suspense } from "react";

import {
  Button,
  Card,
  DocumentationHelp,
  Flex,
  Label,
  Loading,
  Text,
  View,
} from "@phoenix/components";
import { fieldBaseCSS } from "@phoenix/components/core/field/styles";
import type { ModelMenuValue } from "@phoenix/components/generative";
import { ModelMenu } from "@phoenix/components/generative";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

/**
 * Settings card that lets the user choose the default provider + model used
 * when the playground opens for the first time.
 *
 * The preference is stored in the browser via the persisted preferences store.
 */
export function AIProviderSettingsCard() {
  return (
    <Card
      title="AI Provider Settings"
      titleExtra={
        <DocumentationHelp topic="aiProviderSettings">
          Choose the provider and model selected when you first open the
          Playground.
        </DocumentationHelp>
      }
    >
      <View padding="size-200">
        <Suspense fallback={<Loading size="S" />}>
          <DefaultModelField />
        </Suspense>
      </View>
    </Card>
  );
}

function DefaultModelField() {
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
    <div css={fieldBaseCSS}>
      <Label>Default Model</Label>
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
      <Text slot="description">
        The provider and model to use as the default when opening the
        playground.
      </Text>
    </div>
  );
}
