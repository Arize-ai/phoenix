import { css } from "@emotion/react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useFragment, useMutation } from "react-relay";

import { Alert, Button, Flex, Form, Label } from "@phoenix/components";
import {
  CodeEditorFieldWrapper,
  JSONBlock,
  JSONEditor,
} from "@phoenix/components/code";
import { ConfirmNavigationDialog } from "@phoenix/components/ConfirmNavigation";
import { fieldBaseCSS } from "@phoenix/components/core/field/styles";
import { useNotifySuccess } from "@phoenix/contexts";
import { useUnsavedChangesBlocker } from "@phoenix/hooks";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";
import { isJSONObjectString } from "@phoenix/utils/jsonUtils";

import type { PromptDetails_data$key } from "./__generated__/PromptDetails_data.graphql";
import type { PromptDetailsPatchPromptMutation } from "./__generated__/PromptDetailsPatchPromptMutation.graphql";

const detailSectionCSS = css(
  fieldBaseCSS,
  css`
    display: flex;
    flex-direction: column;
  `
);

type PromptDetailsFormParams = {
  metadata: string;
};

/**
 * The prompt's own metadata, which applies to every version of the prompt.
 * The description is edited from the page header.
 */
export function PromptDetails({ prompt }: { prompt: PromptDetails_data$key }) {
  const data = useFragment<PromptDetails_data$key>(
    graphql`
      fragment PromptDetails_data on Prompt {
        id
        metadata
      }
    `,
    prompt
  );
  const [isEditing, setIsEditing] = useState(false);
  const savedValues: PromptDetailsFormParams = {
    metadata: data.metadata ? JSON.stringify(data.metadata, null, 2) : "{}",
  };
  if (isEditing) {
    return (
      <PromptDetailsEditor
        promptId={data.id}
        savedValues={savedValues}
        onDone={() => setIsEditing(false)}
      />
    );
  }
  return (
    <Flex direction="column" gap="size-100">
      <section css={detailSectionCSS}>
        <Label elementType="span">Metadata</Label>
        <JSONBlock value={savedValues.metadata} />
      </section>
      <Flex direction="row" justifyContent="end">
        <Button size="S" onPress={() => setIsEditing(true)}>
          Edit metadata
        </Button>
      </Flex>
    </Flex>
  );
}

/**
 * Edits the metadata in place. While the draft differs from the saved value,
 * leaving the page asks for confirmation.
 */
function PromptDetailsEditor({
  promptId,
  savedValues,
  onDone,
}: {
  promptId: string;
  savedValues: PromptDetailsFormParams;
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const notifySuccess = useNotifySuccess();
  const [mutatePrompt, isMutating] =
    useMutation<PromptDetailsPatchPromptMutation>(graphql`
      mutation PromptDetailsPatchPromptMutation($input: PatchPromptInput!) {
        patchPrompt(input: $input) {
          ...PromptDetails_data
          ...PromptLayout__main
        }
      }
    `);
  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<PromptDetailsFormParams>({ defaultValues: savedValues });
  const blocker = useUnsavedChangesBlocker({ hasUnsavedChanges: isDirty });
  const onSubmit = ({ metadata }: PromptDetailsFormParams) => {
    if (!isDirty) {
      onDone();
      return;
    }
    setError(null);
    mutatePrompt({
      variables: {
        input: {
          promptId,
          metadata: metadata.trim() ? JSON.parse(metadata) : null,
        },
      },
      onCompleted: () => {
        onDone();
        notifySuccess({
          title: "Prompt updated",
          message: "The prompt has been updated successfully",
        });
      },
      onError: (error) => {
        setError(
          getErrorMessagesFromRelayMutationError(error)?.[0] ??
            "Error updating prompt"
        );
      },
    });
  };
  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <Flex direction="column" gap="size-200">
        {error && <Alert variant="danger">{error}</Alert>}
        <Controller
          name="metadata"
          control={control}
          rules={{
            validate: (value) =>
              !value.trim() || isJSONObjectString(value)
                ? true
                : "Metadata must be a valid JSON object",
          }}
          render={({
            field: { onChange, onBlur, value },
            fieldState: { error },
          }) => (
            <CodeEditorFieldWrapper
              label="Metadata"
              errorMessage={error?.message}
              description="A JSON object containing metadata for the prompt"
            >
              <JSONEditor value={value} onChange={onChange} onBlur={onBlur} />
            </CodeEditorFieldWrapper>
          )}
        />
        <Flex direction="row" gap="size-100" justifyContent="end">
          <Button size="S" onPress={onDone} isDisabled={isMutating}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="S"
            type="submit"
            isDisabled={isMutating}
          >
            {isMutating ? "Saving..." : "Save"}
          </Button>
        </Flex>
      </Flex>
      <ConfirmNavigationDialog
        blocker={blocker}
        message="You have unsaved prompt metadata. Leaving this page will discard it."
      />
    </Form>
  );
}
