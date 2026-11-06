import { css } from "@emotion/react";
import { Suspense, useCallback, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";

import {
  Alert,
  Button,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  Flex,
  Form,
  RedactedCredentialField,
  Text,
} from "@phoenix/components";
import { useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { SandboxProviderCredentialsDialogQuery } from "./__generated__/SandboxProviderCredentialsDialogQuery.graphql";
import type { SandboxProviderCredentialsDialogUpsertMutation } from "./__generated__/SandboxProviderCredentialsDialogUpsertMutation.graphql";
import type { BackendInfo } from "./types";

type CredentialSpec = BackendInfo["credentialSpecs"][number];
type CredentialFormValues = Record<string, string>;

const dialogFormCSS = css`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
`;

const dialogBodyCSS = css`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: var(--global-dimension-size-200);
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-200);
`;

const credentialFieldFooterCSS = css`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--global-dimension-size-200);
  margin-top: var(--global-dimension-size-50);
`;

const credentialDescriptionCSS = css`
  flex: 1 1 auto;
  color: var(--global-text-color-700);
  font-size: var(--global-font-size-xs);
`;

const credentialEnvVarCSS = css`
  flex: 0 0 auto;
  font-family: var(--global-font-family-mono);
  font-size: var(--global-font-size-xs);
  color: var(--global-text-color-500);
  white-space: nowrap;
`;

export function SandboxProviderCredentialsDialog({
  backend,
  onClose,
  onRefresh,
}: {
  backend: BackendInfo;
  onClose: () => void;
  onRefresh: () => void;
}) {
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configure {backend.displayName} Credentials</DialogTitle>
          <DialogTitleExtra>
            <DialogCloseButton slot="close" />
          </DialogTitleExtra>
        </DialogHeader>
        <Suspense
          fallback={
            <div css={dialogBodyCSS}>
              <Text color="text-700">Loading credentials…</Text>
            </div>
          }
        >
          <CredentialsForm
            backend={backend}
            onClose={onClose}
            onRefresh={onRefresh}
          />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}

function CredentialsForm({
  backend,
  onClose,
  onRefresh,
}: {
  backend: BackendInfo;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const notifySuccess = useNotifySuccess();
  const [error, setError] = useState<string | null>(null);

  const credentialSpecs = backend.credentialSpecs;
  const secretKeys = useMemo(
    () => credentialSpecs.map((spec) => spec.key),
    [credentialSpecs]
  );

  const data = useLazyLoadQuery<SandboxProviderCredentialsDialogQuery>(
    graphql`
      query SandboxProviderCredentialsDialogQuery($keys: [String!]!) {
        secrets(keys: $keys) {
          edges {
            node {
              key
              value {
                __typename
                ... on DecryptedSecret {
                  value
                }
                ... on UnparsableSecret {
                  parseError
                }
              }
            }
          }
        }
      }
    `,
    { keys: secretKeys },
    { fetchPolicy: "store-and-network" }
  );

  const { savedValues, unparsable } = useMemo(() => {
    const decrypted = new Map<string, string>();
    const errors = new Map<string, string>();
    for (const { node } of data.secrets.edges) {
      const { value } = node;
      if (value.__typename === "DecryptedSecret") {
        const trimmed = value.value?.trim();
        if (trimmed) {
          decrypted.set(node.key, trimmed);
        }
      } else if (value.__typename === "UnparsableSecret") {
        errors.set(node.key, value.parseError);
      } else {
        errors.set(node.key, "Secret type not supported by this client");
      }
    }
    const values: CredentialFormValues = {};
    for (const spec of credentialSpecs) {
      values[spec.key] = decrypted.get(spec.key) ?? "";
    }
    return { savedValues: values, unparsable: errors };
  }, [data.secrets.edges, credentialSpecs]);

  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<CredentialFormValues>({
    defaultValues: savedValues,
    values: savedValues,
    mode: "onChange",
  });

  const [commit, isCommitting] =
    useMutation<SandboxProviderCredentialsDialogUpsertMutation>(graphql`
      mutation SandboxProviderCredentialsDialogUpsertMutation(
        $input: UpsertOrDeleteSecretsMutationInput!
      ) {
        upsertOrDeleteSecrets(input: $input) {
          __typename
        }
      }
    `);

  const existingKeys = useMemo(
    () => [
      ...Object.entries(savedValues)
        .filter(([, v]) => v.trim())
        .map(([k]) => k),
      ...unparsable.keys(),
    ],
    [savedValues, unparsable]
  );

  const runMutation = useCallback(
    (
      secrets: { key: string; value: string | null }[],
      successTitle: string,
      successMessage: string,
      errorFallback: string
    ) => {
      setError(null);
      commit({
        variables: { input: { secrets } },
        onCompleted: () => {
          onRefresh();
          notifySuccess({ title: successTitle, message: successMessage });
          onClose();
        },
        onError: (mutationError) => {
          setError(
            getErrorMessagesFromRelayMutationError(mutationError)?.[0] ??
              errorFallback
          );
        },
      });
    },
    [commit, notifySuccess, onClose, onRefresh]
  );

  const onSubmit = useCallback(
    (formValues: CredentialFormValues) => {
      const secrets = credentialSpecs
        .map((spec) => {
          const next = formValues[spec.key]?.trim() || null;
          const prev = savedValues[spec.key]?.trim() || null;
          if (next === prev) return null;
          return { key: spec.key, value: next };
        })
        .filter((s): s is { key: string; value: string | null } => s !== null);

      if (secrets.length === 0) {
        onClose();
        return;
      }

      runMutation(
        secrets,
        "Credentials updated",
        `${secrets.length} credential${secrets.length === 1 ? "" : "s"} saved`,
        "Failed to update credentials"
      );
    },
    [credentialSpecs, savedValues, runMutation, onClose]
  );

  const handleDelete = useCallback(() => {
    if (existingKeys.length === 0) return;
    const secrets = existingKeys.map((key) => ({ key, value: null }));
    const cleared: CredentialFormValues = {};
    credentialSpecs.forEach((spec) => {
      cleared[spec.key] = "";
    });
    reset(cleared);
    runMutation(
      secrets,
      "Credentials cleared",
      `${existingKeys.length} credential${
        existingKeys.length === 1 ? "" : "s"
      } removed`,
      "Failed to clear credentials"
    );
  }, [existingKeys, credentialSpecs, reset, runMutation]);

  if (credentialSpecs.length === 0) {
    return (
      <div css={dialogBodyCSS}>
        <Text color="text-700">
          This sandbox does not require any credentials.
        </Text>
      </div>
    );
  }

  const unparsableList = credentialSpecs
    .filter((spec) => unparsable.has(spec.key))
    .map((spec) => ({ key: spec.key, parseError: unparsable.get(spec.key)! }));

  return (
    <Form onSubmit={handleSubmit(onSubmit)} css={dialogFormCSS}>
      <div css={dialogBodyCSS}>
        <Text size="XS" color="text-700">
          These environment variables are stored as encrypted secrets and shared
          across the server. They override any matching variables in the process
          environment.
        </Text>
        {error ? <Alert variant="danger">{error}</Alert> : null}
        {unparsableList.map(({ key, parseError }) => (
          <Alert key={key} variant="danger" title={key}>
            {parseError}
          </Alert>
        ))}
        <Flex direction="column" gap="size-200">
          {credentialSpecs.map((spec: CredentialSpec) => (
            <CredentialFormField key={spec.key} spec={spec} control={control} />
          ))}
        </Flex>
      </div>
      <DialogFooter>
        {existingKeys.length > 0 ? (
          <Button
            type="button"
            variant="danger"
            size="M"
            isDisabled={isCommitting}
            onPress={handleDelete}
          >
            Clear
          </Button>
        ) : null}
        <Button
          variant={isDirty ? "primary" : "default"}
          size="M"
          type="submit"
          isDisabled={!isDirty || isCommitting}
          isPending={isCommitting}
        >
          Save
        </Button>
      </DialogFooter>
    </Form>
  );
}

function CredentialFormField({
  spec,
  control,
}: {
  spec: CredentialSpec;
  control: ReturnType<typeof useForm<CredentialFormValues>>["control"];
}) {
  return (
    <Controller
      name={spec.key}
      control={control}
      rules={{
        validate: spec.isRequired
          ? (value) => !!value?.trim() || `${spec.key} is required`
          : undefined,
      }}
      render={({
        field: { name, onChange, onBlur, value },
        fieldState: { error: fieldError },
      }) => (
        <div>
          <RedactedCredentialField
            label={spec.displayName || spec.key}
            isRequired={spec.isRequired}
            name={name}
            value={value ?? ""}
            onChange={onChange}
            onBlur={onBlur}
            errorMessage={fieldError?.message}
          />
          <div css={credentialFieldFooterCSS}>
            {spec.description ? (
              <span css={credentialDescriptionCSS}>{spec.description}</span>
            ) : (
              <span css={credentialDescriptionCSS} />
            )}
            <span css={credentialEnvVarCSS} title="Environment variable name">
              {spec.key}
            </span>
          </div>
        </div>
      )}
    />
  );
}
