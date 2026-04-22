import { css } from "@emotion/react";
import { useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useHotkeys } from "react-hotkeys-hook";
import { graphql, useMutation } from "react-relay";

import type { CardProps } from "@phoenix/components";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  DialogFooter,
  FieldError,
  Flex,
  Icon,
  Icons,
  Input,
  Keyboard,
  Label,
  Text,
  TextArea,
  TextField,
  View,
  VisuallyHidden,
} from "@phoenix/components";
import { JSONEditor } from "@phoenix/components/code";
import { useModifierKey } from "@phoenix/hooks/useModifierKey";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";
import {
  createEmptyJSONStructure,
  isJSONObjectString,
} from "@phoenix/utils/jsonUtils";

import type { AddExampleFromScratchFormMutation } from "./__generated__/AddExampleFromScratchFormMutation.graphql";

type DatasetExamplePatch = {
  input: string;
  output: string;
  metadata: string;
  description?: string;
  externalId?: string;
};

export type AddExampleFromScratchFormProps = {
  datasetId: string;
  onExampleAdded: () => void;
  close: () => void;
};

const defaultCardProps: Partial<CardProps> = {
  collapsible: true,
};

export function AddExampleFromScratchForm(
  props: AddExampleFromScratchFormProps
) {
  const { datasetId, onExampleAdded, close } = props;
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createMore, setCreateMore] = useState(true);
  const modifierKey = useModifierKey();
  const [commit, isCommitting] = useMutation<AddExampleFromScratchFormMutation>(
    graphql`
      mutation AddExampleFromScratchFormMutation($input: AddExamplesToDatasetInput!) {
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
      externalId: "",
    },
  });

  const onSubmit = useCallback(
    (newExample: DatasetExamplePatch) => {
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
                ...(newExample.externalId?.trim()
                  ? { externalId: newExample.externalId.trim() }
                  : {}),
              },
            ],
            datasetVersionDescription: newExample.description,
          },
        },
        onCompleted: () => {
          onExampleAdded();

          if (createMore) {
            reset({
              input: createEmptyJSONStructure(newExample.input),
              output: createEmptyJSONStructure(newExample.output),
              metadata: createEmptyJSONStructure(newExample.metadata),
              description: "",
              externalId: "",
            });
          } else {
            close();
          }
        },
        onError: (error) => {
          const formattedError = getErrorMessagesFromRelayMutationError(error);
          setSubmitError(formattedError?.[0] ?? error.message);
        },
      });
    },
    [commit, datasetId, setError, onExampleAdded, createMore, reset, close]
  );

  useHotkeys(
    "mod+enter",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (isValid && !isCommitting) {
        handleSubmit(onSubmit)();
      }
    },
    {
      enableOnFormTags: true,
      enableOnContentEditable: true,
      preventDefault: true,
    },
    [isValid, isCommitting, handleSubmit, onSubmit]
  );

  return (
    <>
      <div
        css={css`
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto;
          padding: var(--global-dimension-size-400);
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
                    backgroundColor="green-200"
                    borderColor="green-300"
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
                name={"externalId"}
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextField value={value} onChange={onChange} onBlur={onBlur}>
                    <Label>ID</Label>
                    <Input placeholder="e.g. example-001" />
                    <Text slot="description">
                      An optional ID for the example. If provided, it must be
                      unique within the dataset. If not provided, an ID will be
                      generated.
                    </Text>
                  </TextField>
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
      <DialogFooter>
        <Flex gap="size-200" alignItems="center">
          <Checkbox isSelected={createMore} onChange={setCreateMore}>
            Create more
          </Checkbox>
          <Button
            variant="primary"
            size="S"
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
            onPress={() => handleSubmit(onSubmit)()}
          >
            {isCommitting ? "Adding Example..." : "Add Example"}
          </Button>
        </Flex>
      </DialogFooter>
    </>
  );
}
