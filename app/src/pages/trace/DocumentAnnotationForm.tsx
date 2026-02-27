import { css } from "@emotion/react";
import { useCallback, useMemo, useState } from "react";
import type { Key } from "react-aria-components";
import { Input, TextArea } from "react-aria-components";
import { graphql, useMutation } from "react-relay";

import {
  Alert,
  Button,
  Flex,
  Label,
  TextField,
  View,
} from "@phoenix/components";
import { ComboBox, ComboBoxItem } from "@phoenix/components/combobox";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";

import type { DocumentAnnotationFormCreateMutation } from "./__generated__/DocumentAnnotationFormCreateMutation.graphql";
import type { DocumentAnnotationFormPatchMutation } from "./__generated__/DocumentAnnotationFormPatchMutation.graphql";

export type DocumentAnnotation = {
  id: string;
  name: string;
  label: string | null;
  score: number | null;
  explanation: string | null;
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
  existingAnnotation?: DocumentAnnotation | null;
  existingAnnotationNames?: string[];
  onSaved?: () => void;
  onCancel: () => void;
}) {
  const notifyError = useNotifyError();
  const notifySuccess = useNotifySuccess();

  const [name, setName] = useState(existingAnnotation?.name ?? "relevance");
  const [label, setLabel] = useState<string | null>(
    existingAnnotation?.label ?? null
  );
  const [score, setScore] = useState<string>(
    existingAnnotation?.score != null ? String(existingAnnotation.score) : ""
  );
  const [scoreManuallyEdited, setScoreManuallyEdited] = useState(false);
  const [explanation, setExplanation] = useState(
    existingAnnotation?.explanation ?? ""
  );

  const takenNamesSet = useMemo(
    () => new Set(existingAnnotationNames),
    [existingAnnotationNames]
  );
  const nameIsTaken = takenNamesSet.has(name.trim());

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

  const handleLabelChange = useCallback(
    (value: string | null) => {
      setLabel(value);
      if (!scoreManuallyEdited && value != null) {
        const mapped = LABEL_SCORE_MAP[value];
        if (mapped != null) {
          setScore(String(mapped));
        }
      }
    },
    [scoreManuallyEdited]
  );

  const handleScoreChange = useCallback((value: string) => {
    setScoreManuallyEdited(true);
    setScore(value);
  }, []);

  const handleSave = useCallback(() => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }
    const parsedScore = score !== "" ? Number(score) : null;
    const finalLabel = label?.trim() || null;
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
  }, [
    name,
    label,
    score,
    explanation,
    existingAnnotation,
    commitPatch,
    commitCreate,
    spanNodeId,
    documentPosition,
    notifySuccess,
    notifyError,
    onSaved,
  ]);

  return (
    <View padding="size-200">
      <Flex direction="column" gap="size-100">
        <TextField size="S" value={name} onChange={setName}>
          <Label>Name</Label>
          <Input placeholder="e.g. relevance" />
        </TextField>
        {nameIsTaken && (
          <Alert variant="danger">
            An annotation with this name already exists
          </Alert>
        )}
        <Flex direction="row" gap="size-100" alignItems="end">
          <ComboBox
            label="Label"
            placeholder="Select or type a label"
            allowsCustomValue
            selectedKey={label as Key}
            inputValue={label ?? ""}
            onInputChange={handleLabelChange}
            onSelectionChange={(key) => {
              if (key != null) {
                handleLabelChange(String(key));
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
              <ComboBoxItem key={item.id} id={item.id} textValue={item.name}>
                {item.name}
              </ComboBoxItem>
            ))}
          </ComboBox>
          <TextField
            size="S"
            value={score}
            onChange={handleScoreChange}
            css={css`
              flex: 1 1 0%;
              min-width: 0;
            `}
          >
            <Label>Score</Label>
            <Input type="number" placeholder="e.g. 1" />
          </TextField>
        </Flex>
        <TextField
          size="S"
          value={explanation}
          onChange={setExplanation}
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
        <Flex direction="row" gap="size-100" justifyContent="end">
          <Button size="S" onPress={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="S"
            onPress={handleSave}
            isDisabled={isBusy || !name.trim() || nameIsTaken}
          >
            Save
          </Button>
        </Flex>
      </Flex>
    </View>
  );
}
