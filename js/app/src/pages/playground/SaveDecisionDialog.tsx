import { css } from "@emotion/react";
import { Suspense, useCallback, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";

import {
  Alert,
  Button,
  Checkbox,
  ComboBox,
  ComboBoxItem,
  Dialog,
  Flex,
  Form,
  Label,
  Loading,
  Text,
  TextArea,
  TextField,
  View,
} from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import { DEFAULT_PROMPT_VERSION_TAGS } from "@phoenix/constants";
import { useNotifySuccess } from "@phoenix/contexts";
import { usePlaygroundStore } from "@phoenix/contexts/PlaygroundContext";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";
import { validateIdentifier } from "@phoenix/utils/identifierUtils";

import type { SaveDecisionDialogCreateMutation } from "./__generated__/SaveDecisionDialogCreateMutation.graphql";
import type { SaveDecisionDialogQuery } from "./__generated__/SaveDecisionDialogQuery.graphql";
import type { SaveDecisionDialogVersionMutation } from "./__generated__/SaveDecisionDialogVersionMutation.graphql";
import { toDecisionVersionInput } from "./savedDecisionUtils";

type SaveDecisionFormValues = {
  name: string;
  description: string;
  tags: string[];
};

/**
 * Saves an instance's decision request and model as a saved decision: a new
 * decision when the name is new, or a new version of the one picked. The
 * instance is then tied to the saved version, so a later save adds another
 * version and dataset runs record which version they ran.
 */
export function SaveDecisionDialog({ instanceId }: { instanceId: number }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog>
      {({ close }) => (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save decision</DialogTitle>
            <DialogTitleExtra>
              <DialogCloseButton />
            </DialogTitleExtra>
          </DialogHeader>
          {error ? (
            <View paddingX="size-200" paddingTop="size-100">
              <Alert variant="danger" banner>
                {error}
              </Alert>
            </View>
          ) : null}
          <Suspense fallback={<Loading />}>
            <SaveDecisionForm
              instanceId={instanceId}
              onError={setError}
              onClose={close}
            />
          </Suspense>
        </DialogContent>
      )}
    </Dialog>
  );
}

function SaveDecisionForm({
  instanceId,
  onError,
  onClose,
}: {
  instanceId: number;
  onError: (message: string | null) => void;
  onClose: () => void;
}) {
  const store = usePlaygroundStore();
  const notifySuccess = useNotifySuccess();
  const loadedDecision = store
    .getState()
    .instances.find((instance) => instance.id === instanceId)?.decision;
  const data = useLazyLoadQuery<SaveDecisionDialogQuery>(
    graphql`
      query SaveDecisionDialogQuery {
        decisions(first: 200) {
          edges {
            decision: node {
              id
              name
              versionTags {
                name
              }
            }
          }
        }
      }
    `,
    {},
    { fetchPolicy: "network-only" }
  );
  const decisions = useMemo(
    () => data.decisions.edges.map((edge) => edge.decision),
    [data]
  );
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(
    loadedDecision?.id ?? null
  );
  const selectedDecision = decisions.find(
    (decision) => decision.id === selectedDecisionId
  );
  const mode: "create" | "update" = selectedDecision ? "update" : "create";
  const availableTags = useMemo(
    () =>
      Array.from(
        new Set([
          ...DEFAULT_PROMPT_VERSION_TAGS.map((tag) => tag.name),
          ...(selectedDecision?.versionTags.map((tag) => tag.name) ?? []),
        ])
      ),
    [selectedDecision]
  );

  const [createDecision, isCreating] =
    useMutation<SaveDecisionDialogCreateMutation>(graphql`
      mutation SaveDecisionDialogCreateMutation($input: CreateDecisionInput!) {
        createDecision(input: $input) {
          id
          name
          version {
            id
          }
        }
      }
    `);
  const [createVersion, isCreatingVersion] =
    useMutation<SaveDecisionDialogVersionMutation>(graphql`
      mutation SaveDecisionDialogVersionMutation(
        $input: CreateDecisionVersionInput!
      ) {
        createDecisionVersion(input: $input) {
          id
          name
          version {
            id
          }
        }
      }
    `);

  const {
    control,
    handleSubmit,
    formState: { isDirty, isValid },
  } = useForm<SaveDecisionFormValues>({
    values: {
      name: selectedDecision?.name ?? loadedDecision?.name ?? "",
      description: "",
      tags: loadedDecision?.tag ? [loadedDecision.tag] : [],
    },
    mode: "onChange",
  });

  const onSaved = useCallback(
    ({
      id,
      name,
      versionId,
      tag,
    }: {
      id: string;
      name: string;
      versionId: string;
      tag: string | null;
    }) => {
      store.getState().updateInstance({
        instanceId,
        patch: { decision: { id, name, versionId, tag } },
        dirty: false,
      });
      notifySuccess({ title: `Saved decision ${name}` });
      onClose();
    },
    [instanceId, notifySuccess, onClose, store]
  );

  const onSubmit = useCallback(
    (values: SaveDecisionFormValues) => {
      onError(null);
      const state = store.getState();
      const instance = state.instances.find((item) => item.id === instanceId);
      if (!instance) return;
      let version;
      try {
        version = toDecisionVersionInput({
          instance,
          templateFormat: state.templateFormat,
          description: values.description,
        });
      } catch (error) {
        onError(error instanceof Error ? error.message : String(error));
        return;
      }
      const tags = values.tags.map((name) => ({ name }));
      const onMutationError = (error: Error) =>
        onError(
          getErrorMessagesFromRelayMutationError(error)?.[0] ??
            "The decision could not be saved."
        );
      if (selectedDecision) {
        createVersion({
          variables: {
            input: { decisionId: selectedDecision.id, version, tags },
          },
          onCompleted: ({ createDecisionVersion }) =>
            onSaved({
              id: createDecisionVersion.id,
              name: createDecisionVersion.name,
              versionId: createDecisionVersion.version?.id ?? "",
              tag: values.tags[0] ?? null,
            }),
          onError: onMutationError,
        });
        return;
      }
      createDecision({
        variables: { input: { name: values.name.trim(), version, tags } },
        onCompleted: ({ createDecision }) =>
          onSaved({
            id: createDecision.id,
            name: createDecision.name,
            versionId: createDecision.version?.id ?? "",
            tag: values.tags[0] ?? null,
          }),
        onError: onMutationError,
      });
    },
    [
      createDecision,
      createVersion,
      instanceId,
      onError,
      onSaved,
      selectedDecision,
      store,
    ]
  );

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <View padding="size-200">
        <Flex direction="column" gap="size-200">
          <Controller
            name="name"
            control={control}
            rules={{ validate: validateIdentifier }}
            render={({ field: { onBlur, onChange }, fieldState }) => (
              <ComboBox
                label="Decision"
                description="The decision to add a version to, or a new decision's name"
                placeholder="Select or enter a new decision name"
                isRequired
                allowsCustomValue
                menuTrigger="focus"
                width="100%"
                defaultItems={decisions}
                selectedKey={selectedDecisionId}
                defaultInputValue={selectedDecision?.name ?? ""}
                onBlur={onBlur}
                onInputChange={(value) => {
                  onChange(value);
                  const match = decisions.find(
                    (decision) => decision.name === value
                  );
                  setSelectedDecisionId(match?.id ?? null);
                }}
                onSelectionChange={(key) => {
                  const match = decisions.find(
                    (decision) => decision.id === key
                  );
                  setSelectedDecisionId(match?.id ?? null);
                  if (match) onChange(match.name);
                }}
                errorMessage={fieldState.error?.message}
              >
                {(decision) => (
                  <ComboBoxItem
                    key={decision.id}
                    id={decision.id}
                    textValue={decision.name}
                  >
                    {decision.name}
                  </ComboBoxItem>
                )}
              </ComboBox>
            )}
          />
          <Controller
            name="description"
            control={control}
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField
                size="S"
                value={value}
                onChange={onChange}
                onBlur={onBlur}
              >
                <Label>Description (optional)</Label>
                <TextArea />
                <Text slot="description">
                  {mode === "create"
                    ? "What this decision decides"
                    : "What changed in this version"}
                </Text>
              </TextField>
            )}
          />
          <Flex direction="column" gap="size-50">
            <Label>Tags (optional)</Label>
            <Text color="text-700" size="XS">
              Tags to point at the saved version. A tag already on another
              version moves to this one.
            </Text>
            <Controller
              name="tags"
              control={control}
              render={({ field: { value, onChange } }) => (
                <ul
                  css={css`
                    display: flex;
                    flex-direction: column;
                    gap: var(--global-dimension-size-50);
                  `}
                >
                  {availableTags.map((tag) => (
                    <li key={tag}>
                      <Checkbox
                        name={tag}
                        isSelected={value.includes(tag)}
                        onChange={(checked) =>
                          onChange(
                            checked
                              ? [...value, tag]
                              : value.filter((item) => item !== tag)
                          )
                        }
                      >
                        {tag}
                      </Checkbox>
                    </li>
                  ))}
                </ul>
              )}
            />
          </Flex>
        </Flex>
      </View>
      <View
        paddingEnd="size-200"
        paddingY="size-100"
        borderTopColor="default"
        borderTopWidth="thin"
      >
        <Flex direction="row" justifyContent="end" gap="size-100">
          <Button variant="default" size="S" onPress={onClose}>
            Cancel
          </Button>
          <Button
            variant={isDirty || mode === "update" ? "primary" : "default"}
            size="S"
            type="submit"
            isDisabled={!isValid || isCreating || isCreatingVersion}
          >
            {mode === "create" ? "Create decision" : "Save new version"}
          </Button>
        </Flex>
      </View>
    </Form>
  );
}
