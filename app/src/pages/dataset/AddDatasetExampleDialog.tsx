import { useCallback, useState } from "react";
import {
  Control,
  Controller,
  useForm,
  UseFormHandleSubmit,
} from "react-hook-form";
import { useHotkeys } from "react-hotkeys-hook";
import { graphql, useMutation } from "react-relay";
import { css } from "@emotion/react";

import {
  Alert,
  Button,
  Card,
  CardProps,
  Checkbox,
  Dialog,
  FieldError,
  Flex,
  Icon,
  Icons,
  Keyboard,
  Label,
  Text,
  TextArea,
  TextField,
  View,
  VisuallyHidden,
} from "@phoenix/components";
import { JSONEditor } from "@phoenix/components/code";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/dialog";
import { useModifierKey } from "@phoenix/hooks/useModifierKey";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";
import {
  createEmptyJSONStructure,
  isJSONObjectString,
} from "@phoenix/utils/jsonUtils";

import { AddDatasetExampleDialogMutation } from "./__generated__/AddDatasetExampleDialogMutation.graphql";

type DatasetExamplePatch = {
  input: string;
  output: string;
  metadata: string;
  description?: string;
};

export type AddDatasetExampleDialogProps = {
  datasetId: string;
  onCompleted: () => void;
};

const defaultCardProps: Partial<CardProps> = {
  backgroundColor: "light",
  borderColor: "light",
  collapsible: true,
};

export function AddDatasetExampleDialog(props: AddDatasetExampleDialogProps) {
  const { datasetId, onCompleted } = props;
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createMore, setCreateMore] = useState(false);
  const modifierKey = useModifierKey();
  const [commit, isCommitting] = useMutation<AddDatasetExampleDialogMutation>(
    graphql`
      mutation AddDatasetExampleDialogMutation(
        $input: AddExamplesToDatasetInput!
      ) {
        addExamplesToDataset(input: $input) {
          __typename
        }
      }
    `
  );
  const {
    control,
    setError,
    handleSubmit,
    reset,
    formState: { isValid },
  } = useForm<DatasetExamplePatch>({
    defaultValues: {
      input: "{\n  \n}",
      output: "{\n  \n}",
      metadata: "{\n  \n}",
    },
  });

  const onSubmit = useCallback(
    (newExample: DatasetExamplePatch, close: () => void) => {
      setSubmitError(null);
      if (!isJSONObjectString(newExample?.input)) {
        return setError("input", {
          message: "Input must be a valid JSON object",
        });
      }
      if (!isJSONObjectString(newExample?.output)) {
        return setError("output", {
          message: "Output must be a valid JSON object",
        });
      }
      if (!isJSONObjectString(newExample?.metadata)) {
        return setError("metadata", {
          message: "Metadata must be a valid JSON object",
        });
      }

      commit({
        variables: {
          input: {
            datasetId,
            examples: [
              {
                input: JSON.parse(newExample.input),
                output: JSON.parse(newExample.output),
                metadata: JSON.parse(newExample.metadata),
              },
            ],
            datasetVersionDescription: newExample.description,
          },
        },
        onCompleted: () => {
          onCompleted();

          if (createMore) {
            // Clear all form fields and keep dialog open
            // Preserve structure but clear values from previous example
            reset({
              input: createEmptyJSONStructure(newExample.input),
              output: createEmptyJSONStructure(newExample.output),
              metadata: createEmptyJSONStructure(newExample.metadata),
              description: "",
            });
          } else {
            // Close dialog (existing behavior)
            close();
          }
        },
        onError: (error) => {
          const formattedError = getErrorMessagesFromRelayMutationError(error);
          setSubmitError(formattedError?.[0] ?? error.message);
        },
      });
    },
    [commit, datasetId, setError, onCompleted, createMore, reset]
  );

  return (
    <Dialog>
      {({ close }) => (
        <AddExampleDialogContent
          close={close}
          control={control}
          submitError={submitError}
          isValid={isValid}
          isCommitting={isCommitting}
          createMore={createMore}
          setCreateMore={setCreateMore}
          modifierKey={modifierKey}
          onSubmit={onSubmit}
          handleSubmit={handleSubmit}
        />
      )}
    </Dialog>
  );
}

type AddExampleDialogContentProps = {
  close: () => void;
  control: Control<DatasetExamplePatch>;
  submitError: string | null;
  isValid: boolean;
  isCommitting: boolean;
  createMore: boolean;
  setCreateMore: (value: boolean) => void;
  modifierKey: string;
  onSubmit: (data: DatasetExamplePatch, close: () => void) => void;
  handleSubmit: UseFormHandleSubmit<DatasetExamplePatch>;
};

function AddExampleDialogContent(props: AddExampleDialogContentProps) {
  const {
    close,
    control,
    submitError,
    isValid,
    isCommitting,
    createMore,
    setCreateMore,
    modifierKey,
    onSubmit,
    handleSubmit,
  } = props;

  // Add hotkey handler with access to close function
  useHotkeys(
    "mod+enter",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (isValid && !isCommitting) {
        handleSubmit((data: DatasetExamplePatch) => onSubmit(data, close))();
      }
    },
    {
      enableOnFormTags: true,
      enableOnContentEditable: true,
      preventDefault: true,
    },
    [isValid, isCommitting, handleSubmit, onSubmit, close]
  );

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Add Example</DialogTitle>
        <DialogTitleExtra>
          <DialogCloseButton slot="close" />
        </DialogTitleExtra>
      </DialogHeader>
      <div
        css={css`
          overflow-y: auto;
          padding: var(--ac-global-dimension-size-400);
        `}
      >
        <Flex direction="row" justifyContent="center">
          <View width="900px" paddingStart="auto" paddingEnd="auto">
            <Flex direction="column" gap="size-200">
              {submitError ? (
                <Alert variant="danger">{submitError}</Alert>
              ) : null}
              <Controller
                control={control}
                name={"input"}
                render={({
                  field: { onChange, onBlur, value },
                  fieldState: { invalid, error },
                }) => (
                  <Card
                    title="Input"
                    subTitle="The input to the LLM, retriever, program, etc."
                    {...defaultCardProps}
                  >
                    {invalid ? (
                      <Alert variant="danger" banner>
                        {error?.message}
                      </Alert>
                    ) : null}
                    <JSONEditor
                      value={value}
                      onChange={onChange}
                      onBlur={onBlur}
                    />
                  </Card>
                )}
              />
              <Controller
                control={control}
                name={"output"}
                render={({
                  field: { onChange, onBlur, value },
                  fieldState: { invalid, error },
                }) => (
                  <Card
                    title="Output"
                    subTitle="The output of the LLM or program to be used as an expected output"
                    {...defaultCardProps}
                    backgroundColor="green-100"
                    borderColor="green-700"
                  >
                    {invalid ? (
                      <Alert variant="danger" banner>
                        {error?.message}
                      </Alert>
                    ) : null}
                    <JSONEditor
                      value={value}
                      onChange={onChange}
                      onBlur={onBlur}
                    />
                  </Card>
                )}
              />
              <Controller
                control={control}
                name={"metadata"}
                render={({
                  field: { onChange, onBlur, value },
                  fieldState: { invalid, error },
                }) => (
                  <Card
                    title="Metadata"
                    subTitle="All data from the span to use during experimentation or evaluation"
                    {...defaultCardProps}
                  >
                    {invalid ? (
                      <Alert variant="danger" banner>
                        {error?.message}
                      </Alert>
                    ) : null}
                    <JSONEditor
                      value={value}
                      onChange={onChange}
                      onBlur={onBlur}
                    />
                  </Card>
                )}
              />
              <Controller
                control={control}
                name={"description"}
                render={({
                  field: { onChange, onBlur, value },
                  fieldState: { invalid, error },
                }) => (
                  <TextField
                    value={value}
                    onChange={onChange}
                    onBlur={onBlur}
                    isInvalid={invalid}
                  >
                    <Label>Version Description</Label>
                    <TextArea />
                    {error ? (
                      <FieldError>{error.message}</FieldError>
                    ) : (
                      <Text slot="description">
                        A description of the changes made. Will be displayed in
                        the version history.
                      </Text>
                    )}
                  </TextField>
                )}
              />
            </Flex>
          </View>
        </Flex>
      </div>
      <View padding="size-200" borderTopColor="light" borderTopWidth="thin">
        <Flex direction="row" justifyContent="space-between" gap="size-100">
          <Checkbox isSelected={createMore} onChange={setCreateMore}>
            Create more
          </Checkbox>
          <Button
            variant="primary"
            size="M"
            isDisabled={!isValid || isCommitting}
            leadingVisual={
              isCommitting ? <Icon svg={<Icons.LoadingOutline />} /> : null
            }
            trailingVisual={
              <Keyboard>
                <VisuallyHidden>{modifierKey}</VisuallyHidden>
                <span aria-hidden="true">
                  {modifierKey === "Cmd" ? "⌘" : "Ctrl"}
                </span>
                <VisuallyHidden>enter</VisuallyHidden>
                <span aria-hidden="true">⏎</span>
              </Keyboard>
            }
            onPress={() =>
              handleSubmit((data: DatasetExamplePatch) =>
                onSubmit(data, close)
              )()
            }
          >
            {isCommitting ? "Adding Example..." : "Add Example"}
          </Button>
        </Flex>
      </View>
    </DialogContent>
  );
}
