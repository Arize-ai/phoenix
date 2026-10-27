import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useMutation } from "react-relay";

import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Flex,
  Form,
  Icon,
  Icons,
  Label,
  Link,
  LinkButton,
  PageHeader,
  Text,
  TextArea,
  TextField,
  View,
  ViewportModal,
  ViewportModalOverlay,
} from "@phoenix/components";
import { useNotifySuccess } from "@phoenix/contexts";
import { ClonePromptDialog } from "@phoenix/pages/prompt/ClonePromptDialog";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { PromptLayout__main$data } from "./__generated__/PromptLayout__main.graphql";
import type { PromptPageHeaderPatchPromptMutation } from "./__generated__/PromptPageHeaderPatchPromptMutation.graphql";
import { PromptLabelConfigButton } from "./PromptLabelConfigButton";

type PromptPageHeaderProps = {
  prompt: PromptLayout__main$data;
  playgroundPath: string;
};

/**
 * The prompt page's header. The edit button opens a dialog for the
 * description; the name cannot be changed.
 */
export function PromptPageHeader({
  prompt,
  playgroundPath,
}: PromptPageHeaderProps) {
  return (
    <PageHeader
      title={prompt.name}
      labels={prompt.labels}
      labelAction={<PromptLabelConfigButton promptId={prompt.id} />}
      caption={
        prompt.sourcePrompt && (
          <Text size="XS" color="text-700">
            cloned from{" "}
            <Link to={`/prompts/${prompt.sourcePrompt.id}`}>
              {prompt.sourcePrompt.name}
            </Link>
          </Text>
        )
      }
      subTitle={prompt.description}
      extra={
        <Flex direction="row" gap="size-100" justifyContent="end">
          <DialogTrigger>
            <Button
              size="M"
              leadingVisual={<Icon svg={<Icons.Edit />} />}
              aria-label="Edit prompt"
            />
            <ViewportModalOverlay>
              <ViewportModal size="S">
                <EditPromptDescriptionDialog prompt={prompt} />
              </ViewportModal>
            </ViewportModalOverlay>
          </DialogTrigger>
          <DialogTrigger>
            <Button size="M" leadingVisual={<Icon svg={<Icons.GitBranch />} />}>
              Clone
            </Button>
            <ViewportModalOverlay>
              <ViewportModal size="M">
                <ClonePromptDialog
                  promptId={prompt.id}
                  promptName={prompt.name}
                  promptDescription={prompt.description ?? undefined}
                  promptMetadata={prompt.metadata ?? undefined}
                />
              </ViewportModal>
            </ViewportModalOverlay>
          </DialogTrigger>
          <LinkButton
            variant="primary"
            leadingVisual={<Icon svg={<Icons.PlayCircle />} />}
            to={playgroundPath}
            size="M"
            aria-label="Open this Prompt version in Playground"
          >
            Playground
          </LinkButton>
        </Flex>
      }
    />
  );
}

function EditPromptDescriptionDialog({
  prompt,
}: {
  prompt: PromptLayout__main$data;
}) {
  const [error, setError] = useState<string | null>(null);
  const notifySuccess = useNotifySuccess();
  const [commit, isCommitting] =
    useMutation<PromptPageHeaderPatchPromptMutation>(graphql`
      mutation PromptPageHeaderPatchPromptMutation($input: PatchPromptInput!) {
        patchPrompt(input: $input) {
          ...PromptLayout__main
        }
      }
    `);
  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<{ description: string }>({
    defaultValues: { description: prompt.description ?? "" },
  });
  return (
    <Dialog>
      {({ close }) => (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit prompt</DialogTitle>
          </DialogHeader>
          <Form
            onSubmit={handleSubmit(({ description }) => {
              setError(null);
              commit({
                variables: {
                  input: {
                    promptId: prompt.id,
                    description: description.trim() || null,
                  },
                },
                onCompleted: () => {
                  close();
                  notifySuccess({
                    title: "Prompt updated",
                    message: `${prompt.name} has been updated.`,
                  });
                },
                onError: (error) => {
                  setError(
                    getErrorMessagesFromRelayMutationError(error)?.[0] ??
                      error.message
                  );
                },
              });
            })}
          >
            <View padding="size-200">
              <Flex direction="column" gap="size-100">
                {error && <Alert variant="danger">{error}</Alert>}
                <Controller
                  name="description"
                  control={control}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextField
                      onChange={onChange}
                      onBlur={onBlur}
                      value={value}
                      isDisabled={isCommitting}
                      autoFocus
                    >
                      <Label>Description</Label>
                      <TextArea rows={4} placeholder="Describe the prompt" />
                    </TextField>
                  )}
                />
              </Flex>
            </View>
            <DialogFooter>
              <Button
                variant="default"
                size="M"
                slot="close"
                isDisabled={isCommitting}
              >
                Cancel
              </Button>
              <Button
                variant={isDirty ? "primary" : "default"}
                size="M"
                type="submit"
                isDisabled={!isDirty || isCommitting}
              >
                {isCommitting ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </Form>
        </DialogContent>
      )}
    </Dialog>
  );
}
