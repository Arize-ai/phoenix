import { css } from "@emotion/react";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";

import {
  Button,
  CredentialField,
  CredentialInput,
  FieldError,
  Flex,
  Form,
  Label,
  Text,
  View,
} from "@phoenix/components";
import { useNotifySuccess } from "@phoenix/contexts";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import type { ProviderServerCredentialsPanelProvider } from "./ProviderServerCredentialsPanel";

type BrowserCredentialsFormValues = Record<string, string>;

/**
 * A form for a user's personal provider credentials, persisted only in the
 * browser's local storage. Mirrors the form pattern of
 * ProviderServerCredentialsPanel so the two credential destinations present
 * the same way.
 */
export function ProviderBrowserCredentialsPanel({
  provider,
  onSaved,
}: {
  provider: ProviderServerCredentialsPanelProvider;
  /**
   * Called after the credentials are successfully saved
   */
  onSaved?: () => void;
}) {
  return (
    <>
      <View paddingBottom="size-100">
        <Text size="XS" color="text-700">
          Stored only in this browser. Sent with your API requests and never
          saved on the server.
        </Text>
      </View>
      <Form>
        <BrowserCredentials provider={provider} onSaved={onSaved} />
      </Form>
    </>
  );
}

function BrowserCredentials({
  provider,
  onSaved,
}: {
  provider: ProviderServerCredentialsPanelProvider;
  onSaved?: () => void;
}) {
  const providerKey = provider.key;
  const isValidProvider = isModelProvider(providerKey);
  const notifySuccess = useNotifySuccess();

  const { setCredential, credentials } = useCredentialsContext((state) => ({
    setCredential: state.setCredential,
    credentials: isValidProvider ? state[providerKey] : undefined,
  }));
  const credentialRequirements = provider.credentialRequirements;

  // Values currently persisted in the browser
  const savedValues = useMemo(() => {
    const values: BrowserCredentialsFormValues = {};
    credentialRequirements.forEach(({ envVarName }) => {
      values[envVarName] = credentials?.[envVarName] ?? "";
    });
    return values;
  }, [credentials, credentialRequirements]);

  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<BrowserCredentialsFormValues>({
    defaultValues: savedValues,
    values: savedValues, // Syncs form when the store changes after save/clear
    mode: "onChange",
  });

  const hasSavedCredentials = credentialRequirements.some(
    ({ envVarName }) => !!credentials?.[envVarName]
  );

  const onSubmit = (formValues: BrowserCredentialsFormValues) => {
    if (!isValidProvider) return;
    credentialRequirements.forEach(({ envVarName }) => {
      setCredential({
        provider: providerKey,
        envVarName,
        value: formValues[envVarName]?.trim() || null,
      });
    });
    notifySuccess({
      title: "Browser credentials saved",
      message: `${provider.name} credentials are stored in this browser.`,
    });
    onSaved?.();
  };

  const handleClear = () => {
    if (!isValidProvider) return;
    const emptyValues: BrowserCredentialsFormValues = {};
    credentialRequirements.forEach(({ envVarName }) => {
      setCredential({
        provider: providerKey,
        envVarName,
        value: null,
      });
      emptyValues[envVarName] = "";
    });
    reset(emptyValues);
    notifySuccess({
      title: "Browser credentials cleared",
      message: `${provider.name} credentials were removed from this browser.`,
    });
  };

  if (!isValidProvider) {
    return <Text color="warning">Unknown provider type: {providerKey}</Text>;
  }

  if (credentialRequirements.length === 0) {
    return <Text color="text-700">Browser credentials are not required.</Text>;
  }

  return (
    <Flex direction="column" gap="size-100">
      {credentialRequirements.map(({ envVarName, isRequired }) => (
        <Controller
          key={envVarName}
          name={envVarName}
          control={control}
          rules={{
            validate: isRequired
              ? (value) => !!value?.trim() || `${envVarName} is required`
              : undefined,
          }}
          render={({
            field: { name, onChange, onBlur, value },
            fieldState: { error },
          }) => (
            <CredentialField
              name={name}
              isRequired={isRequired}
              isInvalid={!!error}
              value={value ?? ""}
              onChange={onChange}
              onBlur={onBlur}
            >
              <Label>{envVarName}</Label>
              <CredentialInput />
              {error && <FieldError>{error.message}</FieldError>}
            </CredentialField>
          )}
        />
      ))}
      <Flex
        direction="row"
        gap="size-100"
        justifyContent="end"
        width="100%"
        css={css`
          margin-top: var(--global-dimension-size-100);
        `}
      >
        {hasSavedCredentials && (
          <Button variant="danger" onPress={handleClear}>
            Clear
          </Button>
        )}
        <Button
          variant={isDirty ? "primary" : "default"}
          isDisabled={!isDirty}
          onPress={() => handleSubmit(onSubmit)()}
        >
          Save
        </Button>
      </Flex>
    </Flex>
  );
}
