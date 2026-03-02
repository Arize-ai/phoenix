import { css } from "@emotion/react";
import { useCallback, useEffect, useMemo } from "react";
import type { Key } from "react-aria-components";
import { Input, TextArea } from "react-aria-components";
import { Controller, useForm } from "react-hook-form";
import { graphql, useMutation } from "react-relay";

import {
  Button,
  FieldError,
  Flex,
  Label,
  TextField,
  View,
} from "@phoenix/components";
import { ComboBox, ComboBoxItem } from "@phoenix/components/combobox";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";

import type { DocumentAnnotationFormCreateMutation } from "./__generated__/DocumentAnnotationFormCreateMutation.graphql";
import type { DocumentAnnotationFormPatchMutation } from "./__generated__/DocumentAnnotationFormPatchMutation.graphql";

export type DocumentAnnotationFormData = {
  id: string;
  name: string;
  label: string | null;
  score: number | null;
  explanation: string | null;
};

type FormValues = {
  name: string;
  label: string;
  score: string;
  explanation: string;
};

const LABEL_SCORE_MAP: Record<string, number> = {
  relevant: 1,
  irrelevant: 0,
};

const PRESET_LABELS = [
  { id: "relevant", name: "relevant" },
  { id: "irrelevant", name: "irrelevant" },
];

export function DocumentAnnotationForm({
  spanNodeId,
  documentPosition,
  existingAnnotation,
  existingAnnotationNames = [],
  onSaved,
  onCancel,
}: {
  spanNodeId: string;
  documentPosition: number;
  existingAnnotation?: DocumentAnnotationFormData | null;
  existingAnnotationNames?: string[];
  onSaved?: () => void;
  onCancel: () => void;
}) {
  const notifyError = useNotifyError();
  const notifySuccess = useNotifySuccess();

  const {
    control,
    setValue,
    trigger,
    handleSubmit,
    formState: { isValid },
  } = useForm<FormValues>({
    defaultValues: {
      name: existingAnnotation?.name ?? "relevance",
      label: existingAnnotation?.label ?? "",
      score:
        existingAnnotation?.score != null
          ? String(existingAnnotation.score)
          : "",
      explanation: existingAnnotation?.explanation ?? "",
    },
    mode: "onChange",
  });

  useEffect(() => {
    trigger("name");
  }, [trigger]);

  const takenNamesSet = useMemo(
    () => new Set(existingAnnotationNames),
    [existingAnnotationNames]
  );

  const validateNameUnique = useCallback(
    (value: string) =>
      !takenNamesSet.has(value.trim()) ||
      "An annotation with this name already exists",
    [takenNamesSet]
  );

  const [commitCreate, isCreating] =
    useMutation<DocumentAnnotationFormCreateMutation>(graphql`
      mutation DocumentAnnotationFormCreateMutation(
        $input: [CreateDocumentAnnotationInput!]!
        $spanId: ID!
      ) {
        createDocumentAnnotations(input: $input) {
          query {
            node(id: $spanId) {
              ... on Span {
                documentEvaluations {
                  id
                  annotatorKind
                  documentPosition
                  name
                  label
                  score
                  explanation
                  createdAt
                  updatedAt
                  user {
                    username
                    profilePictureUrl
                  }
                }
              }
            }
          }
        }
      }
    `);

  const [commitPatch, isPatching] =
    useMutation<DocumentAnnotationFormPatchMutation>(graphql`
      mutation DocumentAnnotationFormPatchMutation(
        $input: [PatchAnnotationInput!]!
        $spanId: ID!
      ) {
        patchDocumentAnnotations(input: $input) {
          query {
            node(id: $spanId) {
              ... on Span {
                documentEvaluations {
                  id
                  annotatorKind
                  documentPosition
                  name
                  label
                  score
                  explanation
                  createdAt
                  updatedAt
                  user {
                    username
                    profilePictureUrl
                  }
                }
              }
            }
          }
        }
      }
    `);

  const isBusy = isCreating || isPatching;

  const onSubmit = ({ name, label, score, explanation }: FormValues) => {
    const trimmedName = name.trim();
    const parsedScore = score !== "" ? Number(score) : null;
    const finalLabel = label.trim() || null;
    const finalExplanation = explanation.trim() || null;

    if (existingAnnotation) {
      commitPatch({
        variables: {
          input: [
            {
              annotationId: existingAnnotation.id,
              name: trimmedName,
              label: finalLabel,
              score: parsedScore,
              explanation: finalExplanation,
              annotatorKind: "HUMAN",
              source: "APP",
            },
          ],
          spanId: spanNodeId,
        },
        onCompleted: () => {
          notifySuccess({
            title: "Annotation updated",
            message: "Document annotation saved successfully.",
          });
          onSaved?.();
        },
        onError: (error) => {
          notifyError({
            title: "Error updating annotation",
            message: error.message,
          });
        },
      });
    } else {
      commitCreate({
        variables: {
          input: [
            {
              spanId: spanNodeId,
              documentPosition,
              name: trimmedName,
              annotatorKind: "HUMAN",
              label: finalLabel,
              score: parsedScore,
              explanation: finalExplanation,
              metadata: {},
              source: "APP",
            },
          ],
          spanId: spanNodeId,
        },
        onCompleted: () => {
          notifySuccess({
            title: "Annotation created",
            message: "Document annotation saved successfully.",
          });
          onSaved?.();
        },
        onError: (error) => {
          notifyError({
            title: "Error creating annotation",
            message: error.message,
          });
        },
      });
    }
  };

  return (
    <View padding="size-200">
      <Flex direction="column" gap="size-100">
        <Controller
          name="name"
          control={control}
          rules={{
            required: "Name is required",
            validate: { unique: validateNameUnique },
          }}
          render={({ field, fieldState: { invalid, error } }) => (
            <TextField
              size="S"
              value={field.value}
              onChange={field.onChange}
              isInvalid={invalid}
            >
              <Label>Name</Label>
              <Input placeholder="e.g. relevance" />
              {error?.message && <FieldError>{error.message}</FieldError>}
            </TextField>
          )}
        />
        <Flex direction="row" gap="size-100" alignItems="end">
          <Controller
            name="label"
            control={control}
            render={({ field }) => (
              <ComboBox
                label="Label"
                placeholder="Select or type a label"
                allowsCustomValue
                selectedKey={field.value as Key}
                inputValue={field.value}
                onInputChange={(value) => {
                  field.onChange(value);
                  const mapped = LABEL_SCORE_MAP[value];
                  if (mapped != null) {
                    setValue("score", String(mapped));
                  }
                }}
                onSelectionChange={(key) => {
                  if (key != null) {
                    const value = String(key);
                    field.onChange(value);
                    const mapped = LABEL_SCORE_MAP[value];
                    if (mapped != null) {
                      setValue("score", String(mapped));
                    }
                  }
                }}
                size="M"
                css={css`
                  flex: 1 1 0%;
                  min-width: 0;
                  .combobox__container {
                    min-width: 0;
                  }
                `}
              >
                {PRESET_LABELS.map((item) => (
                  <ComboBoxItem
                    key={item.id}
                    id={item.id}
                    textValue={item.name}
                  >
                    {item.name}
                  </ComboBoxItem>
                ))}
              </ComboBox>
            )}
          />
          <Controller
            name="score"
            control={control}
            render={({ field }) => (
              <TextField
                size="S"
                value={field.value}
                onChange={field.onChange}
                css={css`
                  flex: 1 1 0%;
                  min-width: 0;
                `}
              >
                <Label>Score</Label>
                <Input type="number" placeholder="e.g. 1" />
              </TextField>
            )}
          />
        </Flex>
        <Controller
          name="explanation"
          control={control}
          render={({ field }) => (
            <TextField
              size="S"
              value={field.value}
              onChange={field.onChange}
              css={css`
                width: 100%;
                & .react-aria-TextArea {
                  resize: vertical;
                  transition: none;
                }
              `}
            >
              <Label>Explanation</Label>
              <TextArea rows={2} placeholder="Optional explanation" />
            </TextField>
          )}
        />
        <Flex direction="row" gap="size-100" justifyContent="end">
          <Button size="S" onPress={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="S"
            onPress={() => handleSubmit(onSubmit)()}
            isDisabled={isBusy || !isValid}
          >
            Save
          </Button>
        </Flex>
      </Flex>
    </View>
  );
}
