import { css } from "@emotion/react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";

import {
  Alert,
  Button,
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Input,
  Label,
  LinkButton,
  Modal,
  ModalOverlay,
  Popover,
  PopoverArrow,
  SearchField,
  Slider,
  SliderNumberField,
  Text,
  TextArea,
  TextField,
  Token,
  View,
} from "@phoenix/components";
import {
  type AnnotationConfigDraft,
  getAnnotationAggregate,
  getAnnotationConfigDraft,
  getAnnotationConfigFromDraft,
  getNewAnnotationConfigDraft,
  groupAnnotationsByName,
} from "@phoenix/components/annotation/annotationBarUtils";
import { AnnotationLabel } from "@phoenix/components/annotation/AnnotationLabel";
import type {
  Annotation,
  AnnotationConfig,
} from "@phoenix/components/annotation/types";
import { formatFloat } from "@phoenix/utils/numberFormatUtils";

export type AnnotationTargetKind = "session" | "trace" | "span";

export type AnnotationBarTarget = {
  annotations: readonly Annotation[];
  id: string;
  kind: AnnotationTargetKind;
  label: string;
};

export type AnnotationBarRow =
  | { id: string; kind: "target"; target: AnnotationBarTarget }
  | { id: string; kind: "message"; text: string };

export type AnnotationValueDraft = {
  explanation: string;
  label: string | null;
  score: number | null;
};

export type AnnotationBarMutationResult =
  | { success: true }
  | { error: string; success: false };

export type DetailPanelAnnotationBarProps = {
  allAnnotationConfigs: readonly AnnotationConfig[];
  onAddAnnotationConfigToProject: (
    configId: string
  ) => Promise<AnnotationBarMutationResult>;
  onCreateAnnotation: (params: {
    config: AnnotationConfig;
    target: AnnotationBarTarget;
    value: AnnotationValueDraft;
  }) => Promise<AnnotationBarMutationResult>;
  onCreateAnnotationConfig: (
    config: AnnotationConfig
  ) => Promise<AnnotationBarMutationResult>;
  onDeleteAnnotation: (params: {
    annotation: Annotation;
    target: AnnotationBarTarget;
  }) => Promise<AnnotationBarMutationResult>;
  onRemoveAnnotationConfigFromProject: (
    configId: string
  ) => Promise<AnnotationBarMutationResult>;
  onUpdateAnnotation: (params: {
    annotation: Annotation;
    target: AnnotationBarTarget;
    value: AnnotationValueDraft;
  }) => Promise<AnnotationBarMutationResult>;
  onUpdateAnnotationConfig: (
    config: AnnotationConfig
  ) => Promise<AnnotationBarMutationResult>;
  projectAnnotationConfigs: readonly AnnotationConfig[];
  rows: readonly AnnotationBarRow[];
};

const annotationBarCSS = css`
  position: relative;
  z-index: 2;
  flex: none;
  border-bottom: 1px solid var(--global-border-color-default);
  background: var(--global-background-color-default);
`;

const annotationRowCSS = css`
  display: grid;
  grid-template-columns: minmax(72px, auto) minmax(0, 1fr);
  gap: var(--global-dimension-size-100);
  align-items: start;
  padding: var(--global-dimension-size-100) var(--global-dimension-size-200);

  & + & {
    border-top: 1px solid var(--global-border-color-default);
  }
`;

const annotationLabelsCSS = css`
  display: flex;
  flex-flow: row wrap;
  gap: var(--global-dimension-size-50);
  min-width: 0;

  & > * {
    min-width: min(128px, 100%);
    max-width: min(280px, 100%);
  }
`;

const annotationMessageCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
  padding: var(--global-dimension-size-50) var(--global-dimension-size-200);
  border-top: 1px solid var(--global-border-color-default);
  color: var(--global-text-color-500);
  font-size: var(--global-font-size-xs);

  &::before,
  &::after {
    content: "";
    flex: 1 1 auto;
    border-top: 1px dotted var(--global-border-color-default);
  }
`;

const annotationPopoverCSS = css`
  width: min(420px, calc(100vw - var(--global-dimension-size-400)));
  max-height: min(620px, calc(100vh - var(--global-dimension-size-800)));
  overflow: auto;
`;

const compactIconButtonCSS = css`
  flex: none;
  padding: var(--global-dimension-size-50);
  min-width: var(--global-dimension-size-300);
`;

const annotationEntryListCSS = css`
  list-style: none;
  margin: 0;
  padding: 0;
`;

const annotationEntryCSS = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--global-dimension-size-100);
  align-items: start;
  padding: var(--global-dimension-size-150) var(--global-dimension-size-200);

  & + & {
    border-top: 1px solid var(--global-border-color-default);
  }

  .annotation-entry__actions {
    display: flex;
    gap: var(--global-dimension-size-50);
    opacity: 0;
  }

  &:hover .annotation-entry__actions,
  &:focus-within .annotation-entry__actions {
    opacity: 1;
  }

  @media (hover: none) {
    .annotation-entry__actions {
      opacity: 1;
    }
  }
`;

const categoricalOptionsCSS = css`
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-small);
  overflow: hidden;

  li + li {
    border-top: 1px solid var(--global-border-color-default);
  }

  button {
    display: flex;
    width: 100%;
    justify-content: space-between;
    align-items: center;
    gap: var(--global-dimension-size-200);
    padding: var(--global-dimension-size-100) var(--global-dimension-size-150);
    border: 0;
    border-radius: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  button:hover,
  button:focus-visible,
  button[aria-pressed="true"] {
    background: var(--global-list-item-hover-background-color);
  }
`;

const inlinePromptCSS = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--global-dimension-size-50);
  align-items: end;
`;

const configListCSS = css`
  list-style: none;
  margin: 0;
  padding: 0;

  li + li {
    border-top: 1px solid var(--global-border-color-default);
  }
`;

const configListItemCSS = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--global-dimension-size-100);
  padding: var(--global-dimension-size-100) var(--global-dimension-size-150);

  & > button:first-of-type {
    justify-content: flex-start;
    min-width: 0;
  }
`;

function getValueDraft({
  annotation,
  config,
}: {
  annotation?: Annotation;
  config: AnnotationConfig;
}): AnnotationValueDraft {
  const isLegacyFreeformValue =
    config.annotationType === "FREEFORM" &&
    !annotation?.label &&
    Boolean(annotation?.explanation);
  return {
    label:
      config.annotationType === "FREEFORM" && isLegacyFreeformValue
        ? (annotation?.explanation ?? "")
        : (annotation?.label ?? null),
    score: annotation?.score ?? null,
    explanation: isLegacyFreeformValue ? "" : (annotation?.explanation ?? ""),
  };
}

function isMutationFailure(
  result: AnnotationBarMutationResult
): result is { error: string; success: false } {
  return !result.success;
}

/** Keeps Escape dismissal reliable when a popover swaps its focused form. */
function useDismissPopoverOnEscape({
  isOpen,
  onDismiss,
}: {
  isOpen: boolean;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onDismiss();
      }
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, onDismiss]);
}

export function DetailPanelAnnotationBar({
  allAnnotationConfigs,
  onAddAnnotationConfigToProject,
  onCreateAnnotation,
  onCreateAnnotationConfig,
  onDeleteAnnotation,
  onRemoveAnnotationConfigFromProject,
  onUpdateAnnotation,
  onUpdateAnnotationConfig,
  projectAnnotationConfigs,
  rows,
}: DetailPanelAnnotationBarProps) {
  const sharedProps = {
    allAnnotationConfigs,
    onAddAnnotationConfigToProject,
    onCreateAnnotation,
    onCreateAnnotationConfig,
    onDeleteAnnotation,
    onRemoveAnnotationConfigFromProject,
    onUpdateAnnotation,
    onUpdateAnnotationConfig,
    projectAnnotationConfigs,
  };
  return (
    <div css={annotationBarCSS} aria-label="Annotations bar">
      {rows.map((row) =>
        row.kind === "message" ? (
          <div key={row.id} css={annotationMessageCSS} role="note">
            {row.text}
          </div>
        ) : (
          <AnnotationTargetRow
            key={row.id}
            target={row.target}
            {...sharedProps}
          />
        )
      )}
    </div>
  );
}

type SharedAnnotationBarProps = Omit<DetailPanelAnnotationBarProps, "rows">;

function AnnotationTargetRow({
  allAnnotationConfigs,
  projectAnnotationConfigs,
  target,
  ...sharedProps
}: SharedAnnotationBarProps & { target: AnnotationBarTarget }) {
  const annotationsByName = groupAnnotationsByName({
    annotations: target.annotations,
  });
  const hasAnyAnnotations = Object.keys(annotationsByName).length > 0;
  const rowConfigs = [...projectAnnotationConfigs];
  for (const annotationName of Object.keys(annotationsByName)) {
    if (rowConfigs.some((config) => config.name === annotationName)) {
      continue;
    }
    const existingConfig = allAnnotationConfigs.find(
      (config) => config.name === annotationName
    );
    rowConfigs.push(
      existingConfig ?? {
        id: `unconfigured-${annotationName}`,
        name: annotationName,
        description: "This annotation no longer has a saved configuration.",
        annotationType: "FREEFORM",
        optimizationDirection: "NONE",
      }
    );
  }
  const shouldShowEmptyParentMessage =
    !hasAnyAnnotations &&
    (target.kind === "trace" || target.label === "Session");

  return (
    <div css={annotationRowCSS} data-annotation-target={target.kind}>
      <Text size="XS" color="text-500" weight="heavy">
        {target.label}
      </Text>
      <div css={annotationLabelsCSS}>
        {shouldShowEmptyParentMessage ? (
          <Text size="XS" color="text-500">
            No {target.kind} annotations
          </Text>
        ) : null}
        {!hasAnyAnnotations &&
        rowConfigs.length === 0 &&
        !shouldShowEmptyParentMessage ? (
          <Text size="XS" color="text-500">
            No {target.kind} annotations
          </Text>
        ) : null}
        {rowConfigs.map((config) => {
          const annotations = annotationsByName[config.name] ?? [];
          return (
            <AnnotationValuePopover
              key={`${target.id}-${config.id}`}
              annotations={annotations}
              config={config}
              target={target}
              {...sharedProps}
            />
          );
        })}
        <AddAnnotationPopover
          target={target}
          allAnnotationConfigs={allAnnotationConfigs}
          projectAnnotationConfigs={projectAnnotationConfigs}
          {...sharedProps}
        />
      </div>
    </div>
  );
}

type AnnotationPopoverView = "config" | "summary" | "value";

function AnnotationValuePopover({
  annotations,
  config,
  onCreateAnnotation,
  onDeleteAnnotation,
  onUpdateAnnotation,
  onUpdateAnnotationConfig,
  target,
}: Pick<
  SharedAnnotationBarProps,
  | "onCreateAnnotation"
  | "onDeleteAnnotation"
  | "onUpdateAnnotation"
  | "onUpdateAnnotationConfig"
> & {
  annotations: readonly Annotation[];
  config: AnnotationConfig;
  target: AnnotationBarTarget;
}) {
  const hasAnnotations = annotations.length > 0;
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<AnnotationPopoverView>(
    hasAnnotations ? "summary" : "value"
  );
  const [returnView, setReturnView] = useState<AnnotationPopoverView>(
    hasAnnotations ? "summary" : "value"
  );
  const [editingAnnotation, setEditingAnnotation] = useState<Annotation | null>(
    null
  );
  const [valueDraft, setValueDraft] = useState<AnnotationValueDraft>(() =>
    getValueDraft({ config })
  );
  const [configDraft, setConfigDraft] = useState<AnnotationConfigDraft>(() =>
    getAnnotationConfigDraft({ config })
  );
  const [deletingAnnotationId, setDeletingAnnotationId] = useState<
    string | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const aggregate = getAnnotationAggregate({ annotations });
  useDismissPopoverOnEscape({
    isOpen,
    onDismiss: () => setIsOpen(false),
  });

  const openConfigEditor = () => {
    setConfigDraft(getAnnotationConfigDraft({ config }));
    setReturnView(view);
    setView("config");
  };
  const openValueEditor = (annotation?: Annotation) => {
    setEditingAnnotation(annotation ?? null);
    setValueDraft(getValueDraft({ annotation, config }));
    setView("value");
  };

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <AnnotationLabel
        annotation={{
          name: config.name,
          label: aggregate.label,
          score: aggregate.score,
        }}
        annotationDisplayPreference={
          aggregate.isMixed ? "none" : "score-and-label"
        }
        clickable
        variant={hasAnnotations ? "default" : "ghost"}
        onClick={() => setIsOpen(true)}
        onHoverStart={() => {
          if (hasAnnotations) {
            setIsOpen(true);
          }
        }}
      >
        {aggregate.isMixed ? (
          <Flex direction="row" gap="size-100" minWidth={0}>
            <Text
              color="text-500"
              css={css`
                font-style: italic;
              `}
            >
              mixed
            </Text>
            {aggregate.score != null ? (
              <Text fontFamily="mono">{formatFloat(aggregate.score)}</Text>
            ) : null}
          </Flex>
        ) : null}
      </AnnotationLabel>
      <Popover
        placement="bottom start"
        css={annotationPopoverCSS}
        isKeyboardDismissDisabled={false}
        shouldCloseOnInteractOutside={() => true}
      >
        <PopoverArrow />
        <Dialog aria-label={`${config.name} annotation`}>
          {error ? (
            <View padding="size-100">
              <Alert variant="danger">{error}</Alert>
            </View>
          ) : null}
          {view === "config" ? (
            <AnnotationConfigEditor
              draft={configDraft}
              mode="edit"
              onDraftChange={setConfigDraft}
              onCancel={() => setView(returnView)}
              onSave={async () => {
                setError(null);
                const result = await onUpdateAnnotationConfig(
                  getAnnotationConfigFromDraft({ draft: configDraft })
                );
                if (isMutationFailure(result)) {
                  setError(result.error);
                  return;
                }
                setView(returnView);
              }}
            />
          ) : (
            <>
              <AnnotationPopoverHeader
                config={config}
                onEditConfig={openConfigEditor}
              />
              {view === "summary" ? (
                <AnnotationSummaryList
                  annotations={annotations}
                  deletingAnnotationId={deletingAnnotationId}
                  onCancelDelete={() => setDeletingAnnotationId(null)}
                  onConfirmDelete={async (annotation) => {
                    setError(null);
                    const result = await onDeleteAnnotation({
                      annotation,
                      target,
                    });
                    if (isMutationFailure(result)) {
                      setError(result.error);
                      return;
                    }
                    setDeletingAnnotationId(null);
                  }}
                  onDelete={setDeletingAnnotationId}
                  onEdit={openValueEditor}
                />
              ) : (
                <AnnotationValueEditor
                  config={config}
                  draft={valueDraft}
                  onDraftChange={setValueDraft}
                  onCancel={() => {
                    if (hasAnnotations) {
                      setView("summary");
                    } else {
                      setIsOpen(false);
                    }
                  }}
                  onSubmit={async () => {
                    setError(null);
                    const result = editingAnnotation
                      ? await onUpdateAnnotation({
                          annotation: editingAnnotation,
                          target,
                          value: valueDraft,
                        })
                      : await onCreateAnnotation({
                          config,
                          target,
                          value: valueDraft,
                        });
                    if (isMutationFailure(result)) {
                      setError(result.error);
                      return;
                    }
                    setEditingAnnotation(null);
                    setView("summary");
                  }}
                />
              )}
              {view === "summary" ? (
                <DialogFooter>
                  <Button
                    size="S"
                    variant="default"
                    leadingVisual={<Icon svg={<Icons.Plus />} />}
                    onPress={() => openValueEditor()}
                  >
                    Add annotation
                  </Button>
                </DialogFooter>
              ) : null}
            </>
          )}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

function AnnotationPopoverHeader({
  config,
  onEditConfig,
}: {
  config: AnnotationConfig;
  onEditConfig: () => void;
}) {
  return (
    <DialogHeader>
      <DialogTitle>{config.name}</DialogTitle>
      <DialogTitleExtra>
        <Button
          css={compactIconButtonCSS}
          size="S"
          variant="quiet"
          leadingVisual={<Icon svg={<Icons.Edit />} />}
          aria-label={`Edit ${config.name} annotation configuration`}
          onPress={onEditConfig}
        />
      </DialogTitleExtra>
    </DialogHeader>
  );
}

function AnnotationSummaryList({
  annotations,
  deletingAnnotationId,
  onCancelDelete,
  onConfirmDelete,
  onDelete,
  onEdit,
}: {
  annotations: readonly Annotation[];
  deletingAnnotationId: string | null;
  onCancelDelete: () => void;
  onConfirmDelete: (annotation: Annotation) => Promise<void>;
  onDelete: (annotationId: string) => void;
  onEdit: (annotation: Annotation) => void;
}) {
  return (
    <ul css={annotationEntryListCSS} aria-label="Annotation values">
      {annotations.map((annotation, annotationIndex) => {
        const annotationKey = annotation.id ?? `annotation-${annotationIndex}`;
        const isConfirmingDelete = deletingAnnotationId === annotation.id;
        return (
          <li key={annotationKey} css={annotationEntryCSS}>
            {isConfirmingDelete ? (
              <Flex direction="column" gap="size-100">
                <Text>Delete this annotation?</Text>
                <Flex direction="row" gap="size-100">
                  <Button size="S" variant="default" onPress={onCancelDelete}>
                    Cancel
                  </Button>
                  <Button
                    size="S"
                    variant="danger"
                    onPress={() => onConfirmDelete(annotation)}
                  >
                    Delete
                  </Button>
                </Flex>
              </Flex>
            ) : (
              <>
                <Flex direction="column" gap="size-50" minWidth={0}>
                  <Flex direction="row" gap="size-200" wrap>
                    {annotation.score != null ? (
                      <Text fontFamily="mono">
                        Score {formatFloat(annotation.score)}
                      </Text>
                    ) : null}
                    {annotation.label ? (
                      <Text>Label {annotation.label}</Text>
                    ) : null}
                    {annotation.score == null && !annotation.label ? (
                      <Text color="text-500">No value</Text>
                    ) : null}
                  </Flex>
                  {annotation.explanation ? (
                    <Text size="XS" color="text-500">
                      {annotation.explanation}
                    </Text>
                  ) : null}
                </Flex>
                <div className="annotation-entry__actions">
                  <Button
                    css={compactIconButtonCSS}
                    size="S"
                    variant="quiet"
                    leadingVisual={<Icon svg={<Icons.Edit />} />}
                    aria-label="Edit annotation"
                    onPress={() => onEdit(annotation)}
                  />
                  <Button
                    css={compactIconButtonCSS}
                    size="S"
                    variant="quiet"
                    leadingVisual={<Icon svg={<Icons.Trash />} />}
                    aria-label="Delete annotation"
                    onPress={() => annotation.id && onDelete(annotation.id)}
                  />
                </div>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function AnnotationValueEditor({
  config,
  draft,
  onCancel,
  onDraftChange,
  onSubmit,
}: {
  config: AnnotationConfig;
  draft: AnnotationValueDraft;
  onCancel: () => void;
  onDraftChange: (draft: AnnotationValueDraft) => void;
  onSubmit: () => Promise<void>;
}) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSubmit();
  };
  return (
    <form onSubmit={handleSubmit}>
      <View padding="size-200">
        <Flex direction="column" gap="size-200">
          {config.annotationType === "CATEGORICAL" ? (
            <ul
              css={categoricalOptionsCSS}
              aria-label={`${config.name} values`}
            >
              {(config.values ?? []).map((value) => (
                <li key={value.label}>
                  <button
                    type="button"
                    aria-pressed={draft.label === value.label}
                    onClick={() =>
                      onDraftChange({
                        ...draft,
                        label: value.label,
                        score: value.score ?? null,
                      })
                    }
                  >
                    <Text>{value.label}</Text>
                    <Text fontFamily="mono" color="text-500">
                      {value.score == null ? "—" : formatFloat(value.score)}
                    </Text>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {config.annotationType === "FREEFORM" ? (
            <div css={inlinePromptCSS}>
              <TextField
                value={draft.label ?? ""}
                onChange={(label) => onDraftChange({ ...draft, label })}
                aria-label={`${config.name} value`}
                autoFocus
              >
                <Input placeholder="Enter annotation value" />
              </TextField>
              <Button
                css={compactIconButtonCSS}
                type="submit"
                size="S"
                variant="primary"
                leadingVisual={<Icon svg={<Icons.ArrowUp />} />}
                aria-label="Submit annotation"
              />
            </div>
          ) : null}
          {config.annotationType === "CONTINUOUS" ? (
            <Slider
              label={config.name}
              minValue={config.lowerBound ?? 0}
              maxValue={config.upperBound ?? 1}
              step={0.01}
              value={draft.score ?? config.lowerBound ?? 0}
              onChange={(score) => {
                const nextScore = Array.isArray(score) ? score[0] : score;
                onDraftChange({ ...draft, score: nextScore ?? null });
              }}
            >
              <SliderNumberField
                aria-label={`${config.name} exact value`}
                value={draft.score ?? config.lowerBound ?? 0}
                onChange={(score) => onDraftChange({ ...draft, score })}
              />
            </Slider>
          ) : null}
          <TextField
            value={draft.explanation}
            onChange={(explanation) => onDraftChange({ ...draft, explanation })}
          >
            <Label>Explanation</Label>
            <TextArea rows={2} placeholder="Why did you choose this value?" />
          </TextField>
        </Flex>
      </View>
      {config.annotationType !== "FREEFORM" ? (
        <DialogFooter>
          <Button type="button" size="S" variant="default" onPress={onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="S" variant="primary">
            Save annotation
          </Button>
        </DialogFooter>
      ) : (
        <DialogFooter>
          <Button type="button" size="S" variant="default" onPress={onCancel}>
            Cancel
          </Button>
        </DialogFooter>
      )}
    </form>
  );
}

function AnnotationConfigEditor({
  draft,
  mode,
  onCancel,
  onDraftChange,
  onSave,
}: {
  draft: AnnotationConfigDraft;
  mode: "create" | "edit";
  onCancel: () => void;
  onDraftChange: (draft: AnnotationConfigDraft) => void;
  onSave: () => Promise<void>;
}) {
  const canSave =
    Boolean(draft.name.trim()) &&
    (draft.annotationType !== "CATEGORICAL" ||
      draft.values.every((value) => Boolean(value.label.trim())));
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (canSave) {
          void onSave();
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>
          {mode === "edit"
            ? `Edit ${draft.name}`
            : "Add annotation configuration"}
        </DialogTitle>
      </DialogHeader>
      <View padding="size-200">
        <Flex direction="column" gap="size-200">
          <TextField
            value={draft.name}
            onChange={(name) => onDraftChange({ ...draft, name })}
            isRequired
            autoFocus={mode === "create"}
          >
            <Label>Name</Label>
            <Input />
          </TextField>
          <TextField
            value={draft.description}
            onChange={(description) => onDraftChange({ ...draft, description })}
          >
            <Label>Description</Label>
            <TextArea rows={2} />
          </TextField>
          <label>
            <Text size="XS" weight="heavy">
              Type
            </Text>
            <select
              value={draft.annotationType}
              disabled={mode === "edit"}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  annotationType: event.target
                    .value as AnnotationConfig["annotationType"],
                })
              }
              css={css`
                display: block;
                width: 100%;
                margin-top: var(--global-dimension-size-50);
                padding: var(--global-dimension-size-100);
                border: 1px solid var(--global-border-color-default);
                border-radius: var(--global-rounding-small);
                color: inherit;
                background: var(--global-background-color-default);
              `}
            >
              <option value="CATEGORICAL">Categorical</option>
              <option value="CONTINUOUS">Continuous</option>
              <option value="FREEFORM">Freeform</option>
            </select>
          </label>
          {draft.annotationType !== "FREEFORM" ? (
            <label>
              <Text size="XS" weight="heavy">
                Optimization direction
              </Text>
              <select
                value={draft.optimizationDirection}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    optimizationDirection: event.target
                      .value as AnnotationConfigDraft["optimizationDirection"],
                  })
                }
                css={css`
                  display: block;
                  width: 100%;
                  margin-top: var(--global-dimension-size-50);
                  padding: var(--global-dimension-size-100);
                  border: 1px solid var(--global-border-color-default);
                  border-radius: var(--global-rounding-small);
                  color: inherit;
                  background: var(--global-background-color-default);
                `}
              >
                <option value="MAXIMIZE">Maximize</option>
                <option value="MINIMIZE">Minimize</option>
                <option value="NONE">No direction</option>
              </select>
            </label>
          ) : null}
          {draft.annotationType === "CONTINUOUS" ? (
            <Flex direction="row" gap="size-100">
              <TextField
                value={draft.lowerBound}
                onChange={(lowerBound) =>
                  onDraftChange({ ...draft, lowerBound })
                }
                inputMode="decimal"
              >
                <Label>Minimum</Label>
                <Input />
              </TextField>
              <TextField
                value={draft.upperBound}
                onChange={(upperBound) =>
                  onDraftChange({ ...draft, upperBound })
                }
                inputMode="decimal"
              >
                <Label>Maximum</Label>
                <Input />
              </TextField>
            </Flex>
          ) : null}
          {draft.annotationType === "CATEGORICAL" ? (
            <Flex direction="column" gap="size-100">
              <Text size="XS" weight="heavy">
                Categories
              </Text>
              {draft.values.map((value, valueIndex) => (
                <Flex key={valueIndex} direction="row" gap="size-50">
                  <TextField
                    value={value.label}
                    onChange={(label) => {
                      const values = draft.values.map(
                        (currentValue, currentIndex) =>
                          currentIndex === valueIndex
                            ? { ...currentValue, label }
                            : currentValue
                      );
                      onDraftChange({ ...draft, values });
                    }}
                    aria-label={`Category ${valueIndex + 1}`}
                  >
                    <Input placeholder="Label" />
                  </TextField>
                  <TextField
                    value={value.score}
                    onChange={(score) => {
                      const values = draft.values.map(
                        (currentValue, currentIndex) =>
                          currentIndex === valueIndex
                            ? { ...currentValue, score }
                            : currentValue
                      );
                      onDraftChange({ ...draft, values });
                    }}
                    aria-label={`Category ${valueIndex + 1} score`}
                    inputMode="decimal"
                  >
                    <Input placeholder="Score" />
                  </TextField>
                  <Button
                    css={compactIconButtonCSS}
                    size="S"
                    variant="quiet"
                    leadingVisual={<Icon svg={<Icons.Trash />} />}
                    aria-label={`Remove category ${valueIndex + 1}`}
                    onPress={() =>
                      onDraftChange({
                        ...draft,
                        values: draft.values.filter(
                          (_currentValue, currentIndex) =>
                            currentIndex !== valueIndex
                        ),
                      })
                    }
                  />
                </Flex>
              ))}
              <Button
                size="S"
                variant="default"
                leadingVisual={<Icon svg={<Icons.Plus />} />}
                onPress={() =>
                  onDraftChange({
                    ...draft,
                    values: [...draft.values, { label: "", score: "" }],
                  })
                }
              >
                Add category
              </Button>
            </Flex>
          ) : null}
        </Flex>
      </View>
      <DialogFooter>
        <Button size="S" variant="default" type="button" onPress={onCancel}>
          Cancel
        </Button>
        <Button
          size="S"
          variant={canSave ? "primary" : "default"}
          type="submit"
          isDisabled={!canSave}
        >
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}

function AddAnnotationPopover({
  allAnnotationConfigs,
  onAddAnnotationConfigToProject,
  onCreateAnnotationConfig,
  onRemoveAnnotationConfigFromProject,
  projectAnnotationConfigs,
  target,
}: Pick<
  SharedAnnotationBarProps,
  | "allAnnotationConfigs"
  | "onAddAnnotationConfigToProject"
  | "onCreateAnnotationConfig"
  | "onRemoveAnnotationConfigFromProject"
  | "projectAnnotationConfigs"
> & { target: AnnotationBarTarget }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [pendingRemoval, setPendingRemoval] = useState<AnnotationConfig | null>(
    null
  );
  const [isCreatingConfig, setIsCreatingConfig] = useState(false);
  const [configDraft, setConfigDraft] = useState<AnnotationConfigDraft>(() =>
    getNewAnnotationConfigDraft()
  );
  const [error, setError] = useState<string | null>(null);
  useDismissPopoverOnEscape({
    isOpen,
    onDismiss: () => setIsOpen(false),
  });
  const projectIds = new Set(
    projectAnnotationConfigs.map((config) => config.id)
  );
  const normalizedSearch = searchValue.trim().toLocaleLowerCase();
  const matchesSearch = (config: AnnotationConfig) =>
    config.name.toLocaleLowerCase().includes(normalizedSearch);
  const activeConfigs = projectAnnotationConfigs.filter(matchesSearch);
  const inactiveConfigs = allAnnotationConfigs.filter(
    (config) => !projectIds.has(config.id) && matchesSearch(config)
  );
  const hasExactMatch = allAnnotationConfigs.some(
    (config) => config.name.toLocaleLowerCase() === normalizedSearch
  );
  const hasResults = activeConfigs.length > 0 || inactiveConfigs.length > 0;

  return (
    <>
      <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
        <AnnotationLabel
          annotation={{ name: "Add annotation" }}
          annotationDisplayPreference="none"
          clickable
          variant="ghost"
          onClick={() => setIsOpen(true)}
        />
        <Popover
          placement="bottom end"
          css={annotationPopoverCSS}
          isKeyboardDismissDisabled={false}
          shouldCloseOnInteractOutside={() => true}
        >
          <PopoverArrow />
          <Dialog
            aria-label={`Manage ${target.label.toLocaleLowerCase()} annotations`}
          >
            {error ? (
              <View padding="size-100">
                <Alert variant="danger">{error}</Alert>
              </View>
            ) : null}
            {isCreatingConfig ? (
              <AnnotationConfigEditor
                draft={configDraft}
                mode="create"
                onDraftChange={setConfigDraft}
                onCancel={() => setIsCreatingConfig(false)}
                onSave={async () => {
                  setError(null);
                  const result = await onCreateAnnotationConfig(
                    getAnnotationConfigFromDraft({ draft: configDraft })
                  );
                  if (isMutationFailure(result)) {
                    setError(result.error);
                    return;
                  }
                  setIsCreatingConfig(false);
                  setSearchValue("");
                }}
              />
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Annotations</DialogTitle>
                  <DialogTitleExtra>
                    <LinkButton
                      css={compactIconButtonCSS}
                      size="S"
                      variant="quiet"
                      leadingVisual={<Icon svg={<Icons.Settings />} />}
                      aria-label="Open annotation configuration settings"
                      to="/settings/annotations"
                    />
                  </DialogTitleExtra>
                </DialogHeader>
                <View padding="size-100">
                  <SearchField
                    aria-label="Filter annotations"
                    value={searchValue}
                    onChange={setSearchValue}
                    autoFocus
                  >
                    <Input placeholder="Filter annotations" />
                  </SearchField>
                </View>
                {!hasResults && normalizedSearch ? (
                  <View padding="size-200">
                    <Flex direction="column" gap="size-100" alignItems="center">
                      <Text color="text-500">No matching annotations</Text>
                      {!hasExactMatch ? (
                        <Button
                          size="S"
                          variant="primary"
                          onPress={() => {
                            setConfigDraft(
                              getNewAnnotationConfigDraft({
                                name: searchValue.trim(),
                              })
                            );
                            setIsCreatingConfig(true);
                          }}
                        >
                          Add “{searchValue.trim()}”
                        </Button>
                      ) : null}
                    </Flex>
                  </View>
                ) : (
                  <View maxHeight="360px" overflow="auto">
                    {activeConfigs.length > 0 ? (
                      <AnnotationConfigMenuSection title="On this project">
                        {activeConfigs.map((config) => (
                          <AnnotationConfigMenuItem
                            key={config.id}
                            config={config}
                            action="remove"
                            onAction={() => setPendingRemoval(config)}
                          />
                        ))}
                      </AnnotationConfigMenuSection>
                    ) : null}
                    {inactiveConfigs.length > 0 ? (
                      <AnnotationConfigMenuSection title="Available annotations">
                        {inactiveConfigs.map((config) => (
                          <AnnotationConfigMenuItem
                            key={config.id}
                            config={config}
                            action="add"
                            onAction={async () => {
                              setError(null);
                              if (!config.id) {
                                setError(
                                  "The annotation configuration does not have an ID."
                                );
                                return;
                              }
                              const result =
                                await onAddAnnotationConfigToProject(config.id);
                              if (isMutationFailure(result)) {
                                setError(result.error);
                              }
                            }}
                          />
                        ))}
                      </AnnotationConfigMenuSection>
                    ) : null}
                  </View>
                )}
              </>
            )}
          </Dialog>
        </Popover>
      </DialogTrigger>
      <ModalOverlay
        isOpen={pendingRemoval != null}
        isDismissable={false}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setPendingRemoval(null);
            setIsOpen(true);
          }
        }}
      >
        <Modal size="S">
          <Dialog
            data-annotation-removal-modal
            aria-label="Remove annotation from project"
          >
            <DialogHeader>
              <DialogTitle>Remove annotation from project</DialogTitle>
            </DialogHeader>
            <View padding="size-200">
              <Text>
                This will remove {pendingRemoval?.name} from the project, but it
                will not change existing annotations.
              </Text>
            </View>
            <DialogFooter>
              <Button
                variant="default"
                onPress={() => {
                  setPendingRemoval(null);
                  setIsOpen(true);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onPress={async () => {
                  if (!pendingRemoval) {
                    return;
                  }
                  setError(null);
                  if (!pendingRemoval.id) {
                    setError(
                      "The annotation configuration does not have an ID."
                    );
                    setPendingRemoval(null);
                    setIsOpen(true);
                    return;
                  }
                  const result = await onRemoveAnnotationConfigFromProject(
                    pendingRemoval.id
                  );
                  if (isMutationFailure(result)) {
                    setError(result.error);
                  }
                  setPendingRemoval(null);
                  setIsOpen(true);
                }}
              >
                Continue
              </Button>
            </DialogFooter>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </>
  );
}

function AnnotationConfigMenuSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section aria-label={title}>
      <View
        paddingX="size-150"
        paddingY="size-100"
        borderTopWidth="thin"
        borderBottomWidth="thin"
        borderColor="default"
      >
        <Text size="XS" color="text-500" weight="heavy">
          {title}
        </Text>
      </View>
      <ul css={configListCSS}>{children}</ul>
    </section>
  );
}

function AnnotationConfigMenuItem({
  action,
  config,
  onAction,
}: {
  action: "add" | "remove";
  config: AnnotationConfig;
  onAction: () => void | Promise<void>;
}) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  return (
    <li css={configListItemCSS}>
      <DialogTrigger isOpen={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <Button
          variant="quiet"
          size="S"
          onHoverStart={() => setIsPreviewOpen(true)}
          onFocus={() => setIsPreviewOpen(true)}
          onPress={() => {
            if (action === "add") {
              void onAction();
            }
          }}
        >
          {config.name}
        </Button>
        <Popover placement="right top" css={annotationPopoverCSS} isNonModal>
          <Dialog aria-label={`${config.name} annotation preview`}>
            <AnnotationConfigPreview config={config} />
          </Dialog>
        </Popover>
      </DialogTrigger>
      {action === "remove" ? (
        <Button
          css={compactIconButtonCSS}
          size="S"
          variant="quiet"
          leadingVisual={<Icon svg={<Icons.Close />} />}
          aria-label={`Remove ${config.name} from project`}
          onPress={() => void onAction()}
        />
      ) : (
        <Icon svg={<Icons.Plus />} />
      )}
    </li>
  );
}

function AnnotationConfigPreview({ config }: { config: AnnotationConfig }) {
  const direction =
    config.optimizationDirection === "MAXIMIZE"
      ? "maximize"
      : config.optimizationDirection === "MINIMIZE"
        ? "minimize"
        : "no direction";
  return (
    <View padding="size-150" minWidth="260px">
      <Flex direction="column" gap="size-150">
        <Flex
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Text weight="heavy">{config.name}</Text>
          <Token size="S">{direction}</Token>
        </Flex>
        {config.description ? (
          <Text size="XS" color="text-500">
            {config.description}
          </Text>
        ) : null}
        <div aria-disabled="true">
          {config.annotationType === "CATEGORICAL" ? (
            <ul css={categoricalOptionsCSS}>
              {(config.values ?? []).map((value) => (
                <li key={value.label}>
                  <button type="button" disabled>
                    <span>{value.label}</span>
                    <span>{value.score ?? "—"}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : config.annotationType === "CONTINUOUS" ? (
            <Slider
              isDisabled
              label={config.name}
              minValue={config.lowerBound ?? 0}
              maxValue={config.upperBound ?? 1}
              defaultValue={config.lowerBound ?? 0}
            >
              <SliderNumberField isDisabled />
            </Slider>
          ) : (
            <div css={inlinePromptCSS}>
              <TextField isDisabled aria-label={`${config.name} preview`}>
                <Input placeholder="Enter annotation value" />
              </TextField>
              <Button
                isDisabled
                size="S"
                leadingVisual={<Icon svg={<Icons.ArrowUp />} />}
                aria-label="Submit preview"
              />
            </div>
          )}
        </div>
      </Flex>
    </View>
  );
}
