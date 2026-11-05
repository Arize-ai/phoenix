import { css } from "@emotion/react";
import { Suspense, useState } from "react";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";

import {
  Alert,
  Badge,
  Button,
  CredentialField,
  CredentialInput,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Flex,
  Label,
  Loading,
  Text,
  View,
} from "@phoenix/components";
import { useNotifySuccess } from "@phoenix/contexts";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import { useIsAdminOrAuthDisabled } from "@phoenix/contexts/ViewerContext";
import { isModelProvider } from "@phoenix/utils/generativeUtils";
import { redactedPreviewText } from "@phoenix/utils/redactionUtils";

import type { ProviderCredentialsDialogSaveSecretsMutation } from "./__generated__/ProviderCredentialsDialogSaveSecretsMutation.graphql";
import type { ProviderCredentialsDialogSecretsQuery } from "./__generated__/ProviderCredentialsDialogSecretsQuery.graphql";
import { getCredentialWarnings } from "./providerCredentialSources";

export type ProviderCredentialsDialogProvider = {
  readonly name: string;
  readonly key: string;
  readonly credentialRequirements: ReadonlyArray<{
    readonly envVarName: string;
    readonly isRequired: boolean;
    readonly isSetInEnvironment: boolean;
    readonly isSetAsSecret: boolean;
  }>;
};

type CredentialValues = Record<string, string>;

/**
 * Stands in for a stored secret the server could not decrypt: it can be
 * replaced or cleared, but has no value to show.
 */
const UNREADABLE_SECRET = "UNREADABLE";
const MASK = "••••••••";

const sectionCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
`;

/**
 * Every place a provider's credentials can come from, in the order Phoenix
 * uses them: this browser, a Phoenix secret on the server, then the server's
 * environment. Browser credentials and, for administrators, secrets are
 * edited together and saved at once; the environment is read-only.
 */
export function ProviderCredentialsDialog({
  provider,
}: {
  provider: ProviderCredentialsDialogProvider;
}) {
  return (
    <Dialog>
      {({ close }) => (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{provider.name} Credentials</DialogTitle>
          </DialogHeader>
          <Suspense
            fallback={
              <View padding="size-200">
                <Loading />
              </View>
            }
          >
            <ProviderCredentialsForm provider={provider} onClose={close} />
          </Suspense>
        </DialogContent>
      )}
    </Dialog>
  );
}

function ProviderCredentialsForm({
  provider,
  onClose,
}: {
  provider: ProviderCredentialsDialogProvider;
  onClose: () => void;
}) {
  const isAdmin = useIsAdminOrAuthDisabled();
  const notifySuccess = useNotifySuccess();
  const [error, setError] = useState<string | null>(null);
  const requirements = provider.credentialRequirements;
  const envVarNames = requirements.map(({ envVarName }) => envVarName);

  const data = useLazyLoadQuery<ProviderCredentialsDialogSecretsQuery>(
    graphql`
      query ProviderCredentialsDialogSecretsQuery(
        $keys: [String!]!
        $isAdmin: Boolean!
      ) {
        secrets(keys: $keys) @include(if: $isAdmin) {
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
    { keys: envVarNames, isAdmin },
    { fetchPolicy: "network-only" }
  );

  const [commitSecrets, isSavingSecrets] =
    useMutation<ProviderCredentialsDialogSaveSecretsMutation>(graphql`
      mutation ProviderCredentialsDialogSaveSecretsMutation(
        $input: UpsertOrDeleteSecretsMutationInput!
      ) {
        upsertOrDeleteSecrets(input: $input) {
          query {
            ...GenerativeProvidersCard_data
          }
        }
      }
    `);

  const { browserCredentials, setCredential } = useCredentialsContext(
    (state) => ({
      browserCredentials: isModelProvider(provider.key)
        ? state[provider.key]
        : undefined,
      setCredential: state.setCredential,
    })
  );

  const savedSecrets: CredentialValues = {};
  const unreadableSecrets = new Map<string, string>();
  for (const { node } of data.secrets?.edges ?? []) {
    if (node.value.__typename === "DecryptedSecret") {
      savedSecrets[node.key] = node.value.value;
    } else {
      savedSecrets[node.key] = UNREADABLE_SECRET;
      unreadableSecrets.set(
        node.key,
        node.value.__typename === "UnparsableSecret"
          ? node.value.parseError
          : "This client cannot read the stored secret."
      );
    }
  }
  const savedBrowser: CredentialValues = {};
  for (const envVarName of envVarNames) {
    savedBrowser[envVarName] = browserCredentials?.[envVarName] ?? "";
    savedSecrets[envVarName] ??= "";
  }

  const [browserDrafts, setBrowserDrafts] =
    useState<CredentialValues>(savedBrowser);
  const [secretDrafts, setSecretDrafts] =
    useState<CredentialValues>(savedSecrets);

  const changedBrowser = envVarNames.filter(
    (name) => browserDrafts[name] !== savedBrowser[name]
  );
  const changedSecrets = isAdmin
    ? envVarNames.filter((name) => secretDrafts[name] !== savedSecrets[name])
    : [];
  const isDirty = changedBrowser.length > 0 || changedSecrets.length > 0;
  const namesWhere = (isSet: (envVarName: string) => boolean) =>
    new Set(envVarNames.filter(isSet));
  const warnings = getCredentialWarnings({
    requirements,
    presence: {
      browser: namesWhere((name) => browserDrafts[name].trim() !== ""),
      secret: isAdmin
        ? namesWhere((name) => secretDrafts[name].trim() !== "")
        : namesWhere(
            (name) =>
              requirements.find(({ envVarName }) => envVarName === name)
                ?.isSetAsSecret ?? false
          ),
      environment: namesWhere(
        (name) =>
          requirements.find(({ envVarName }) => envVarName === name)
            ?.isSetInEnvironment ?? false
      ),
    },
  });

  const saveBrowser = () => {
    if (!isModelProvider(provider.key)) {
      return;
    }
    for (const envVarName of changedBrowser) {
      setCredential({
        provider: provider.key,
        envVarName,
        value: browserDrafts[envVarName].trim() || null,
      });
    }
  };

  const finish = () => {
    saveBrowser();
    notifySuccess({
      title: "Credentials saved",
      message: `${provider.name} credentials were updated.`,
    });
    onClose();
  };

  const save = () => {
    setError(null);
    if (changedSecrets.length === 0) {
      finish();
      return;
    }
    commitSecrets({
      variables: {
        input: {
          secrets: changedSecrets.map((key) => ({
            key,
            value: secretDrafts[key].trim() || null,
          })),
        },
      },
      onCompleted: finish,
      onError: (mutationError) => setError(mutationError.message),
    });
  };

  return (
    <>
      <View padding="size-200">
        <Flex direction="column" gap="size-200">
          {error ? <Alert variant="danger">{error}</Alert> : null}
          <Text size="XS" color="text-700">
            Phoenix uses the first of these that is set, in this order.
          </Text>
          <section css={sectionCSS}>
            <SectionHeading
              title="This browser"
              location="Local"
              description="Only usable by you in this browser. Sent with your requests and never stored on the server."
            />
            {envVarNames.map((envVarName) => (
              <CredentialField
                key={envVarName}
                value={browserDrafts[envVarName]}
                onChange={(value) =>
                  setBrowserDrafts((drafts) => ({
                    ...drafts,
                    [envVarName]: value,
                  }))
                }
              >
                <Label>{envVarName}</Label>
                <CredentialInput />
                {savedBrowser[envVarName] && !browserDrafts[envVarName] ? (
                  <Text slot="description">Removed when you save.</Text>
                ) : null}
              </CredentialField>
            ))}
          </section>
          <section css={sectionCSS}>
            <SectionHeading
              title="Phoenix secret"
              location="Server"
              description="Shared by everyone, stored on the server."
            />
            {[...unreadableSecrets].map(([envVarName, parseError]) => (
              <Alert key={envVarName} variant="danger" title={envVarName}>
                {parseError}
              </Alert>
            ))}
            {requirements.map(({ envVarName, isSetAsSecret }) =>
              isAdmin ? (
                <StoredSecretField
                  key={envVarName}
                  envVarName={envVarName}
                  savedValue={savedSecrets[envVarName]}
                  value={secretDrafts[envVarName]}
                  onChange={(value) =>
                    setSecretDrafts((drafts) => ({
                      ...drafts,
                      [envVarName]: value,
                    }))
                  }
                />
              ) : (
                <ReadOnlyCredential
                  key={envVarName}
                  envVarName={envVarName}
                  isSet={isSetAsSecret}
                />
              )
            )}
          </section>
          <section css={sectionCSS}>
            <SectionHeading
              title="Environment variable"
              location="Server"
              description="Shared by everyone. Modify in env vars."
            />
            {requirements.map(({ envVarName, isSetInEnvironment }) => (
              <ReadOnlyCredential
                key={envVarName}
                envVarName={envVarName}
                isSet={isSetInEnvironment}
              />
            ))}
          </section>
          {warnings.map((warning) => (
            <Alert key={warning} variant="warning">
              {warning}
            </Alert>
          ))}
        </Flex>
      </View>
      <DialogFooter>
        <Flex direction="row" gap="size-100">
          <Button variant="default" onPress={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            isDisabled={!isDirty || isSavingSecrets}
            isPending={isSavingSecrets}
            onPress={save}
          >
            Save
          </Button>
        </Flex>
      </DialogFooter>
    </>
  );
}

function SectionHeading({
  title,
  location,
  description,
}: {
  title: string;
  location: string;
  description: string;
}) {
  return (
    <Flex direction="column" gap="size-25">
      <Flex direction="row" gap="size-100" alignItems="center">
        <Text elementType="h3" weight="heavy">
          {title}
        </Text>
        <Badge>{location}</Badge>
      </Flex>
      <Text size="XS" color="text-700">
        {description}
      </Text>
    </Flex>
  );
}

/**
 * An administrator's field for a stored secret. Until it is edited, the
 * stored value shows only as a masked placeholder; clearing it marks the
 * secret for removal.
 */
function StoredSecretField({
  envVarName,
  savedValue,
  value,
  onChange,
}: {
  envVarName: string;
  savedValue: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const isUntouchedSavedValue = savedValue !== "" && value === savedValue;
  return (
    <CredentialField
      value={isUntouchedSavedValue ? "" : value}
      hasHiddenValue={isUntouchedSavedValue}
      onChange={onChange}
    >
      <Label>{envVarName}</Label>
      <CredentialInput
        placeholder={
          isUntouchedSavedValue
            ? (redactedPreviewText(savedValue) ?? MASK)
            : undefined
        }
      />
      {savedValue !== "" && value === "" ? (
        <Text slot="description">Removed when you save.</Text>
      ) : null}
    </CredentialField>
  );
}

function ReadOnlyCredential({
  envVarName,
  isSet,
}: {
  envVarName: string;
  isSet: boolean;
}) {
  return (
    <CredentialField isDisabled value="">
      <Label>{envVarName}</Label>
      <CredentialInput placeholder={isSet ? MASK : "Not set"} />
    </CredentialField>
  );
}
