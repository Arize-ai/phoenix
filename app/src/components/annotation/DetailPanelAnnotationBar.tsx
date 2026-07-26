import { css } from "@emotion/react";
import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useInteractOutside } from "react-aria";

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
  IDBadge,
  Icon,
  IconButton,
  Icons,
  Input,
  Label,
  LinkButton,
  Menu,
  MenuItem,
  Modal,
  ModalOverlay,
  NumberField,
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
  getInferredAnnotationConfigDraft,
  getNewAnnotationConfigDraft,
  groupAnnotationsByName,
} from "@phoenix/components/annotation/annotationBarUtils";
import { AnnotationConfigStatus } from "@phoenix/components/annotation/AnnotationConfigStatus";
import { AnnotationLabel } from "@phoenix/components/annotation/AnnotationLabel";
import type { AnnotationValueDraft } from "@phoenix/components/annotation/AnnotationValueDraft";
import { CategoricalQuickCreate } from "@phoenix/components/annotation/CategoricalQuickCreate";
import type {
  Annotation,
  AnnotationConfig,
} from "@phoenix/components/annotation/types";
import { CodeEditorFieldWrapper, JSONEditor } from "@phoenix/components/code";
import { EmptyState, EmptyStateGraphic } from "@phoenix/components/core/empty";
import { UserPicture } from "@phoenix/components/user/UserPicture";
import { classNames } from "@phoenix/utils/classNames";
import { isPlainObject } from "@phoenix/utils/jsonUtils";
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

export type { AnnotationValueDraft } from "@phoenix/components/annotation/AnnotationValueDraft";

export type AnnotationBarMutationResult =
  | { success: true }
  | { error: string; success: false };

export type AnnotationBarCreateResult =
  | { annotation: Annotation; success: true }
  | { error: string; success: false };

export type DetailPanelAnnotationBarProps = {
  allAnnotationConfigs: readonly AnnotationConfig[];
  onAddAnnotationConfigToProject: (
    configId: string
  ) => Promise<AnnotationBarMutationResult>;
  onCreateAnnotation: (params: {
    annotationName: string;
    target: AnnotationBarTarget;
    value: AnnotationValueDraft;
  }) => Promise<AnnotationBarCreateResult>;
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
  z-index: var(--global-z-index-local-raised);
  display: flex;
  flex-direction: column;
  flex: none;
  width: 100%;
  box-sizing: border-box;
  border-top: 1px solid var(--global-border-color-default);
  border-bottom: 1px solid var(--global-border-color-default);
  background: var(--global-background-color-default);

  & > * + * {
    border-top: 1px solid var(--global-border-color-default);
  }
`;

const annotationRowCSS = css`
  display: grid;
  grid-template-columns: minmax(72px, auto) minmax(0, 1fr);
  gap: var(--global-dimension-size-100);
  align-items: center;
  padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
`;

const annotationLabelsCSS = css`
  display: flex;
  flex-flow: row wrap;
  align-items: center;
  gap: var(--global-dimension-size-50);
  min-width: 0;

  & > * {
    max-width: min(280px, 100%);
  }
`;

const annotationMessageCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
  padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
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
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-50);
  padding: var(--global-dimension-size-150) var(--global-dimension-size-200);

  & + & {
    border-top: 1px solid var(--global-border-color-default);
  }

  .annotation-entry__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--global-dimension-size-100);
    min-width: 0;
  }

  .annotation-entry__value {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-200);
    min-width: 0;
    white-space: nowrap;
  }

  .annotation-entry__actions {
    display: flex;
    flex: none;
    gap: var(--global-dimension-size-25);
  }

  .annotation-entry__actions--deleting {
    gap: var(--global-dimension-size-100);
  }

  .annotation-entry__explanation {
    width: 100%;
    overflow-wrap: anywhere;
  }

  .annotation-entry__explanation--deleting {
    opacity: 0.2;
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

const quickCreatePopoverCSS = css`
  width: min(320px, calc(100vw - var(--global-dimension-size-400)));
  max-height: min(620px, calc(100vh - var(--global-dimension-size-800)));
  overflow: auto;
`;

const annotationValueFieldsCSS = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--global-dimension-size-1200);
  gap: var(--global-dimension-size-100);
  align-items: start;
`;

const annotationValueEditorCSS = css`
  .annotation-value-editor__explanation {
    width: 100%;
    flex: none;
  }

  .annotation-value-editor__explanation > .text-field {
    width: 100%;
  }

  .annotation-value-editor__explanation .react-aria-TextArea {
    display: block;
    width: 100%;
    resize: none;
  }
`;

const annotationFormFieldCSS = css`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
  max-width: 100%;
`;

const annotationFormLabelCSS = css`
  display: inline-block;
  padding: 5px 0;
  font-size: var(--global-font-size-xs);
  line-height: var(--global-line-height-xs);
  font-weight: var(--font-weight-heavy);
`;

const annotationAdvancedFieldsCSS = css`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--global-dimension-size-200) var(--global-dimension-size-100);

  .annotation-value-editor__select {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .annotation-value-editor__select select {
    width: 100%;
    height: var(--global-input-height-m);
    padding: 0 var(--global-dimension-size-125);
    border: var(--global-border-size-thin) solid
      var(--global-input-field-border-color);
    border-radius: var(--global-rounding-small);
    color: var(--global-text-color-900);
    background-color: var(--global-input-field-background-color);
  }

  .annotation-value-editor__metadata {
    grid-column: 1 / -1;
    min-width: 0;
  }
`;

const annotationValueEditorFooterExtraCSS = css`
  margin-right: auto;
`;

const annotationConfigActionsCSS = css`
  border-top: 1px solid var(--global-border-color-default);
`;

const annotationConfigListCSS = css`
  list-style: none;
  margin: 0;
  padding: var(--global-menu-item-gap);

  li + li {
    margin-top: var(--global-menu-item-gap);
  }
`;

const annotationConfigListItemCSS = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--global-menu-item-gap);

  & > button:first-of-type {
    justify-content: flex-start;
    min-width: 0;
  }
`;

function getValueDraft({
  annotation,
  annotationType,
}: {
  annotation?: Annotation;
  annotationType?: AnnotationConfig["annotationType"];
}): AnnotationValueDraft {
  const isLegacyFreeformValue =
    annotationType === "FREEFORM" &&
    annotation?.score == null &&
    !annotation?.label &&
    Boolean(annotation?.explanation);
  return {
    annotatorKind: annotation?.annotatorKind ?? "HUMAN",
    label:
      annotationType === "FREEFORM" && isLegacyFreeformValue
        ? (annotation?.explanation ?? "")
        : (annotation?.label ?? null),
    score: annotation?.score ?? null,
    explanation: isLegacyFreeformValue ? "" : (annotation?.explanation ?? ""),
    metadata: annotation?.metadata ?? {},
    source: annotation?.source ?? "APP",
  };
}

function parseAnnotationMetadata(
  metadataText: string
): Record<string, unknown> | null {
  try {
    const metadata: unknown = JSON.parse(metadataText);
    return isPlainObject(metadata) ? metadata : null;
  } catch {
    return null;
  }
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
      return undefined;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
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
  const hasVisibleAnnotationLabels =
    projectAnnotationConfigs.length > 0 ||
    rows.some(
      (row) => row.kind === "target" && row.target.annotations.length > 0
    );
  // The full affordance helps when the annotation area is otherwise empty. Once
  // a ghost or real annotation label is visible, the compact icon avoids clutter.
  const isAddAnnotationButtonCompact = hasVisibleAnnotationLabels;
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
            isAddAnnotationButtonCompact={isAddAnnotationButtonCompact}
            {...sharedProps}
          />
        )
      )}
    </div>
  );
}

type SharedAnnotationBarProps = Omit<DetailPanelAnnotationBarProps, "rows">;

type AnnotationBarConfigState = {
  config: AnnotationConfig | null;
  id: string;
  name: string;
};

function AnnotationTargetRow({
  allAnnotationConfigs,
  isAddAnnotationButtonCompact,
  projectAnnotationConfigs,
  target,
  ...sharedProps
}: SharedAnnotationBarProps & {
  isAddAnnotationButtonCompact: boolean;
  target: AnnotationBarTarget;
}) {
  const annotationsByName = groupAnnotationsByName({
    annotations: target.annotations,
  });
  const rowConfigs: AnnotationBarConfigState[] = projectAnnotationConfigs.map(
    (config) => ({
      config,
      id: config.id,
      name: config.name,
    })
  );
  for (const annotationName of Object.keys(annotationsByName)) {
    if (rowConfigs.some(({ name }) => name === annotationName)) {
      continue;
    }
    const existingConfig = allAnnotationConfigs.find(
      (config) => config.name === annotationName
    );
    rowConfigs.push({
      config: existingConfig ?? null,
      id: existingConfig?.id ?? `unconfigured-${annotationName}`,
      name: annotationName,
    });
  }
  return (
    <div css={annotationRowCSS} data-annotation-target={target.kind}>
      <Text size="XS" color="text-500" weight="heavy">
        {target.label}
      </Text>
      <div css={annotationLabelsCSS}>
        {rowConfigs.map(({ config, id, name }) => {
          const annotations = annotationsByName[name] ?? [];
          return (
            <AnnotationValuePopover
              key={`${target.id}-${id}`}
              annotationName={name}
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
          isAddAnnotationButtonCompact={isAddAnnotationButtonCompact}
          projectAnnotationConfigs={projectAnnotationConfigs}
          {...sharedProps}
        />
      </div>
    </div>
  );
}

type AnnotationPopoverView = "config" | "quick-create" | "summary" | "value";

function AnnotationValuePopover({
  annotationName,
  annotations,
  config,
  onCreateAnnotation,
  onCreateAnnotationConfig,
  onDeleteAnnotation,
  onUpdateAnnotation,
  onUpdateAnnotationConfig,
  target,
}: Pick<
  SharedAnnotationBarProps,
  | "onCreateAnnotation"
  | "onCreateAnnotationConfig"
  | "onDeleteAnnotation"
  | "onUpdateAnnotation"
  | "onUpdateAnnotationConfig"
> & {
  annotationName: string;
  annotations: readonly Annotation[];
  config: AnnotationConfig | null;
  target: AnnotationBarTarget;
}) {
  const [createdAnnotation, setCreatedAnnotation] = useState<Annotation | null>(
    null
  );
  const isCreatedAnnotationInProps =
    createdAnnotation?.id != null &&
    annotations.some(({ id }) => id === createdAnnotation.id);
  const displayedAnnotations =
    createdAnnotation && !isCreatedAnnotationInProps
      ? [...annotations, createdAnnotation]
      : annotations;
  const hasAnnotations = displayedAnnotations.length > 0;
  const initialView = hasAnnotations
    ? "summary"
    : config?.annotationType === "CATEGORICAL"
      ? "quick-create"
      : "value";
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<AnnotationPopoverView>(initialView);
  const [returnView, setReturnView] =
    useState<AnnotationPopoverView>(initialView);
  const [editingAnnotation, setEditingAnnotation] = useState<Annotation | null>(
    null
  );
  const [valueDraft, setValueDraft] = useState<AnnotationValueDraft>(() =>
    getValueDraft({ annotationType: config?.annotationType })
  );
  const [configDraft, setConfigDraft] = useState<AnnotationConfigDraft>(() =>
    config
      ? getAnnotationConfigDraft({ config })
      : getInferredAnnotationConfigDraft({
          name: annotationName,
          annotations,
        })
  );
  const [deletingAnnotationId, setDeletingAnnotationId] = useState<
    string | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [shouldFocusExplanation, setShouldFocusExplanation] = useState(false);
  const aggregate = getAnnotationAggregate({
    annotations: displayedAnnotations,
  });
  const isShowingQuickCreate = view === "quick-create";
  const resetPopover = useCallback(() => {
    setView(initialView);
    setReturnView(initialView);
    setEditingAnnotation(null);
    setValueDraft(getValueDraft({ annotationType: config?.annotationType }));
    setConfigDraft(
      config
        ? getAnnotationConfigDraft({ config })
        : getInferredAnnotationConfigDraft({
            name: annotationName,
            annotations,
          })
    );
    setDeletingAnnotationId(null);
    setShouldFocusExplanation(false);
    setError(null);
  }, [annotationName, annotations, config, initialView]);
  const handleOpenChange = useCallback(
    (nextIsOpen: boolean) => {
      if (!nextIsOpen || !isOpen) {
        resetPopover();
      }
      setIsOpen(nextIsOpen);
    },
    [isOpen, resetPopover]
  );
  const handleEscape = useCallback(() => {
    if (view !== initialView) {
      resetPopover();
      return;
    }
    handleOpenChange(false);
  }, [handleOpenChange, initialView, resetPopover, view]);
  useDismissPopoverOnEscape({
    isOpen,
    onDismiss: handleEscape,
  });
  useInteractOutside({
    ref: popoverRef,
    isDisabled: !isOpen,
    onInteractOutside: (event) => {
      if (
        triggerRef.current &&
        event.composedPath().includes(triggerRef.current)
      ) {
        return;
      }
      handleOpenChange(false);
    },
  });

  const openConfigEditor = () => {
    setConfigDraft(
      config
        ? getAnnotationConfigDraft({ config })
        : getInferredAnnotationConfigDraft({
            name: annotationName,
            annotations,
          })
    );
    setReturnView(view);
    setView("config");
  };
  const openValueEditor = (annotation?: Annotation) => {
    setShouldFocusExplanation(false);
    setEditingAnnotation(annotation ?? null);
    setValueDraft(
      getValueDraft({ annotation, annotationType: config?.annotationType })
    );
    setView("value");
  };
  const openExplanationEditor = (draft: AnnotationValueDraft) => {
    setShouldFocusExplanation(true);
    setEditingAnnotation(null);
    setValueDraft(draft);
    setView("value");
  };

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={handleOpenChange}>
      <AnnotationLabel
        ref={triggerRef}
        annotation={{
          name: annotationName,
          label: aggregate.label,
          score: aggregate.score,
        }}
        annotationDisplayPreference={
          aggregate.isMixed ? "none" : "score-and-label"
        }
        clickable
        variant={hasAnnotations ? "default" : "ghost"}
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
        ref={popoverRef}
        placement="bottom start"
        css={
          isShowingQuickCreate ? quickCreatePopoverCSS : annotationPopoverCSS
        }
        isNonModal
        isKeyboardDismissDisabled={false}
        shouldCloseOnInteractOutside={(element) =>
          !triggerRef.current?.contains(element)
        }
      >
        <PopoverArrow />
        <Dialog aria-label={`${annotationName} annotation`}>
          {error ? (
            <View padding="size-100">
              <Alert variant="danger">{error}</Alert>
            </View>
          ) : null}
          {view === "config" ? (
            <AnnotationConfigEditor
              draft={configDraft}
              mode={config ? "edit" : "create"}
              onDraftChange={setConfigDraft}
              onCancel={() => setView(returnView)}
              onSave={async () => {
                setError(null);
                const nextConfig = getAnnotationConfigFromDraft({
                  draft: configDraft,
                });
                const result = config
                  ? await onUpdateAnnotationConfig(nextConfig)
                  : await onCreateAnnotationConfig(nextConfig);
                if (isMutationFailure(result)) {
                  setError(result.error);
                  return;
                }
                setView(returnView);
              }}
            />
          ) : isShowingQuickCreate ? (
            <CategoricalQuickCreate
              annotationName={annotationName}
              config={config}
              onCreate={async ({ shouldExplain, value }) => {
                setError(null);
                if (shouldExplain) {
                  openExplanationEditor(value);
                  return;
                }
                const result = await onCreateAnnotation({
                  annotationName,
                  target,
                  value,
                });
                if (isMutationFailure(result)) {
                  setError(result.error);
                  return;
                }
                setCreatedAnnotation(result.annotation);
                handleOpenChange(false);
              }}
            />
          ) : view === "value" ? (
            <AnnotationValueEditor
              annotation={editingAnnotation}
              annotationName={annotationName}
              config={config}
              draft={valueDraft}
              shouldFocusExplanation={shouldFocusExplanation}
              onDraftChange={setValueDraft}
              onCancel={() => {
                if (view !== initialView) {
                  resetPopover();
                } else {
                  handleOpenChange(false);
                }
              }}
              onSubmit={async () => {
                setError(null);
                if (editingAnnotation) {
                  const result = await onUpdateAnnotation({
                    annotation: editingAnnotation,
                    target,
                    value: valueDraft,
                  });
                  if (isMutationFailure(result)) {
                    setError(result.error);
                    return;
                  }
                  if (createdAnnotation?.id === editingAnnotation.id) {
                    setCreatedAnnotation({
                      ...editingAnnotation,
                      ...valueDraft,
                    });
                  }
                } else {
                  const result = await onCreateAnnotation({
                    annotationName,
                    target,
                    value: valueDraft,
                  });
                  if (isMutationFailure(result)) {
                    setError(result.error);
                    return;
                  }
                  setCreatedAnnotation(result.annotation);
                }
                setEditingAnnotation(null);
                setView("summary");
              }}
            />
          ) : (
            <>
              <AnnotationPopoverHeader
                annotationName={annotationName}
                config={config}
                onCreateConfig={config ? undefined : openConfigEditor}
                onEditConfig={config ? openConfigEditor : undefined}
              />
              <AnnotationSummaryList
                annotations={displayedAnnotations}
                deletingAnnotationId={deletingAnnotationId}
                onCancelDelete={() => setDeletingAnnotationId(null)}
                onConfirmDelete={async (annotation) => {
                  setError(null);
                  const isDeletingLastAnnotation =
                    displayedAnnotations.length === 1;
                  const result = await onDeleteAnnotation({
                    annotation,
                    target,
                  });
                  if (isMutationFailure(result)) {
                    setError(result.error);
                    return;
                  }
                  if (createdAnnotation?.id === annotation.id) {
                    setCreatedAnnotation(null);
                  }
                  setDeletingAnnotationId(null);
                  if (isDeletingLastAnnotation) {
                    handleOpenChange(false);
                  }
                }}
                onDelete={setDeletingAnnotationId}
                onEdit={openValueEditor}
              />
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
            </>
          )}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

function AnnotationPopoverHeader({
  annotationName,
  config,
  onCreateConfig,
  onEditConfig,
}: {
  annotationName: string;
  config: AnnotationConfig | null;
  onCreateConfig?: () => void;
  onEditConfig?: () => void;
}) {
  const optimizationDirection =
    config?.optimizationDirection === "MAXIMIZE"
      ? "maximize"
      : config?.optimizationDirection === "MINIMIZE"
        ? "minimize"
        : null;
  return (
    <DialogHeader>
      <Flex direction="row" gap="size-100" alignItems="center" wrap>
        <DialogTitle>{annotationName}</DialogTitle>
        {config ? (
          <AnnotationConfigStatus annotationType={config.annotationType} />
        ) : null}
        {optimizationDirection ? (
          <Token size="S">{optimizationDirection}</Token>
        ) : null}
      </Flex>
      {onEditConfig || onCreateConfig ? (
        <DialogTitleExtra>
          {onEditConfig ? (
            <Button
              css={compactIconButtonCSS}
              size="S"
              variant="quiet"
              leadingVisual={<Icon svg={<Icons.Options />} />}
              aria-label={`Edit ${annotationName} annotation configuration`}
              onPress={onEditConfig}
            />
          ) : (
            <>
              <AnnotationConfigStatus />
              <Button size="S" variant="quiet" onPress={onCreateConfig}>
                Create
              </Button>
            </>
          )}
        </DialogTitleExtra>
      ) : null}
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
          <li
            key={annotationKey}
            className="annotation-entry"
            css={annotationEntryCSS}
          >
            <div className="annotation-entry__header">
              <div className="annotation-entry__value">
                {isConfirmingDelete ? (
                  <Text>Confirm</Text>
                ) : (
                  <>
                    {annotation.score != null ? (
                      <Text fontFamily="mono">
                        {formatFloat(annotation.score)}
                      </Text>
                    ) : null}
                    {annotation.label ? (
                      <Text>{annotation.label}</Text>
                    ) : (
                      <Text color="text-500">--</Text>
                    )}
                  </>
                )}
              </div>
              <div
                className={classNames("annotation-entry__actions", {
                  "annotation-entry__actions--deleting": isConfirmingDelete,
                })}
              >
                {isConfirmingDelete ? (
                  <>
                    <Button size="S" variant="quiet" onPress={onCancelDelete}>
                      Cancel
                    </Button>
                    <Button
                      size="S"
                      variant="quiet-danger"
                      onPress={() => onConfirmDelete(annotation)}
                    >
                      Delete
                    </Button>
                  </>
                ) : (
                  <>
                    <IconButton
                      size="S"
                      aria-label="Edit annotation"
                      onPress={() => onEdit(annotation)}
                    >
                      <Icon svg={<Icons.Edit />} />
                    </IconButton>
                    <IconButton
                      size="S"
                      variant="danger"
                      aria-label="Delete annotation"
                      onPress={() => annotation.id && onDelete(annotation.id)}
                    >
                      <Icon svg={<Icons.Trash />} />
                    </IconButton>
                  </>
                )}
              </div>
            </div>
            {annotation.explanation ? (
              <Text
                className={classNames("annotation-entry__explanation", {
                  "annotation-entry__explanation--deleting": isConfirmingDelete,
                })}
                size="XS"
                color="text-500"
              >
                {annotation.explanation}
              </Text>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function AnnotationValueEditor({
  annotation,
  annotationName,
  config,
  draft,
  onCancel,
  onDraftChange,
  onSubmit,
  shouldFocusExplanation = false,
}: {
  annotation: Annotation | null;
  annotationName: string;
  config: AnnotationConfig | null;
  draft: AnnotationValueDraft;
  onCancel: () => void;
  onDraftChange: (draft: AnnotationValueDraft) => void;
  onSubmit: () => Promise<void>;
  shouldFocusExplanation?: boolean;
}) {
  const [isAdvanced, setIsAdvanced] = useState(false);
  const selectionLabelId = useId();
  const initialDraft = getValueDraft({
    annotation: annotation ?? undefined,
    annotationType: config?.annotationType,
  });
  const initialMetadataText = JSON.stringify(initialDraft.metadata, null, 2);
  const [metadataText, setMetadataText] = useState(() =>
    JSON.stringify(draft.metadata, null, 2)
  );
  const parsedMetadata = parseAnnotationMetadata(metadataText);
  const metadataError = parsedMetadata
    ? null
    : "Metadata must be a valid JSON object.";
  const isBasicDirty =
    draft.explanation !== initialDraft.explanation ||
    draft.label !== initialDraft.label ||
    draft.score !== initialDraft.score;
  const isAdvancedDirty =
    draft.annotatorKind !== initialDraft.annotatorKind ||
    draft.source !== initialDraft.source ||
    metadataText !== initialMetadataText;
  const isDirty = isBasicDirty || isAdvancedDirty;
  const canSubmit = isDirty && parsedMetadata != null;
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSubmit) {
      void onSubmit();
    }
  };
  const handleMetadataChange = (nextMetadataText: string) => {
    setMetadataText(nextMetadataText);
    const nextMetadata = parseAnnotationMetadata(nextMetadataText);
    if (nextMetadata) {
      onDraftChange({ ...draft, metadata: nextMetadata });
    }
  };
  const updateBasicDraft = (nextDraft: AnnotationValueDraft) => {
    onDraftChange(nextDraft);
  };
  const updateAdvancedDraft = (nextDraft: AnnotationValueDraft) => {
    onDraftChange(nextDraft);
  };
  const username = annotation?.user?.username ?? "system";
  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>
          {annotation ? "Edit Annotation" : "Add Annotation"}
        </DialogTitle>
      </DialogHeader>
      <View padding="size-200">
        <Flex direction="column" gap="size-200" css={annotationValueEditorCSS}>
          {config?.annotationType === "CATEGORICAL" ? (
            <div
              className="annotation-value-editor__selection"
              css={annotationFormFieldCSS}
            >
              <Label id={selectionLabelId} css={annotationFormLabelCSS}>
                Selection
              </Label>
              <Menu
                style={{ boxSizing: "border-box", minWidth: 0, width: "100%" }}
                aria-labelledby={selectionLabelId}
                selectionMode="single"
                selectedKeys={draft.label == null ? [] : [draft.label]}
                shouldCloseOnSelect={false}
                onSelectionChange={(selectedKeys) => {
                  if (selectedKeys === "all") {
                    return;
                  }
                  const selectedLabel = selectedKeys.values().next().value;
                  if (typeof selectedLabel !== "string") {
                    return;
                  }
                  const selectedValue = config.values?.find(
                    (value) => value.label === selectedLabel
                  );
                  if (!selectedValue) {
                    return;
                  }
                  updateBasicDraft({
                    ...draft,
                    label: selectedValue.label,
                    score: selectedValue.score ?? null,
                  });
                }}
              >
                {(config.values ?? []).map((value) => (
                  <MenuItem
                    key={value.label}
                    id={value.label}
                    textValue={value.label}
                    trailingContent={
                      <Text fontFamily="mono" color="text-500">
                        {value.score == null ? "—" : formatFloat(value.score)}
                      </Text>
                    }
                  >
                    <Text>{value.label}</Text>
                  </MenuItem>
                ))}
              </Menu>
            </div>
          ) : null}
          {config?.annotationType === "FREEFORM" ? (
            <TextField
              value={draft.label ?? ""}
              onChange={(label) => updateBasicDraft({ ...draft, label })}
              aria-label={`${annotationName} value`}
              autoFocus
              css={{ width: "100%" }}
            >
              <Input placeholder="Enter annotation value" />
            </TextField>
          ) : null}
          {config?.annotationType === "CONTINUOUS" ? (
            <Slider
              label={annotationName}
              minValue={config.lowerBound ?? 0}
              maxValue={config.upperBound ?? 1}
              step={0.01}
              value={draft.score ?? config.lowerBound ?? 0}
              onChange={(score) => {
                const nextScore = Array.isArray(score) ? score[0] : score;
                updateBasicDraft({ ...draft, score: nextScore ?? null });
              }}
            >
              <SliderNumberField
                aria-label={`${annotationName} exact value`}
                value={draft.score ?? config.lowerBound ?? 0}
                onChange={(score) => updateBasicDraft({ ...draft, score })}
              />
            </Slider>
          ) : null}
          {!config ? (
            <div
              className="annotation-value-editor__value-row"
              css={annotationValueFieldsCSS}
            >
              <TextField
                value={draft.label ?? ""}
                onChange={(label) => updateBasicDraft({ ...draft, label })}
                autoFocus
              >
                <Label>Label</Label>
                <Input placeholder="Enter a label" />
              </TextField>
              <NumberField
                value={draft.score ?? undefined}
                onChange={(score) =>
                  updateBasicDraft({
                    ...draft,
                    score: Number.isNaN(score) ? null : score,
                  })
                }
              >
                <Label>Score</Label>
                <Input placeholder="Enter a score" />
              </NumberField>
            </div>
          ) : null}
          <div className="annotation-value-editor__explanation">
            <TextField
              value={draft.explanation}
              onChange={(explanation) =>
                updateBasicDraft({ ...draft, explanation })
              }
            >
              <Label>Explanation</Label>
              <TextArea
                autoFocus={shouldFocusExplanation}
                rows={3}
                placeholder="Why did you choose this value?"
              />
            </TextField>
          </div>
          {isAdvanced && annotation ? (
            <div
              className="annotation-value-editor__advanced"
              css={annotationAdvancedFieldsCSS}
            >
              <label className="annotation-value-editor__select">
                <Text size="XS" weight="heavy">
                  Source
                </Text>
                <select
                  aria-label="Annotation source"
                  value={draft.source}
                  onChange={(event) =>
                    updateAdvancedDraft({
                      ...draft,
                      source: event.target.value === "API" ? "API" : "APP",
                    })
                  }
                >
                  <option value="APP">App</option>
                  <option value="API">API</option>
                </select>
              </label>
              <label className="annotation-value-editor__select">
                <Text size="XS" weight="heavy">
                  Annotator kind
                </Text>
                <select
                  aria-label="Annotator kind"
                  value={draft.annotatorKind}
                  onChange={(event) => {
                    const annotatorKind = event.target.value;
                    if (
                      annotatorKind === "CODE" ||
                      annotatorKind === "HUMAN" ||
                      annotatorKind === "LLM"
                    ) {
                      updateAdvancedDraft({ ...draft, annotatorKind });
                    }
                  }}
                >
                  <option value="HUMAN">Human</option>
                  <option value="LLM">LLM</option>
                  <option value="CODE">Code</option>
                </select>
              </label>
              <div className="annotation-value-editor__metadata">
                <CodeEditorFieldWrapper
                  label="Metadata"
                  errorMessage={metadataError}
                  description="A JSON object containing annotation metadata."
                >
                  <JSONEditor
                    value={metadataText}
                    onChange={handleMetadataChange}
                    height="120px"
                    basicSetup={{ lineNumbers: false }}
                  />
                </CodeEditorFieldWrapper>
              </div>
            </div>
          ) : null}
          {isAdvanced && annotation ? (
            <Flex
              className="annotation-value-editor__identity"
              direction="row"
              gap="size-200"
              alignItems="center"
            >
              <Flex direction="row" gap="size-100" alignItems="center">
                <UserPicture
                  name={username}
                  profilePictureUrl={annotation.user?.profilePictureUrl}
                  size={20}
                />
                <Text>{username}</Text>
              </Flex>
              {annotation.id ? (
                <IDBadge id={annotation.id} tooltipText="Copy Annotation ID" />
              ) : (
                <Text fontFamily="mono" color="text-500">
                  --
                </Text>
              )}
            </Flex>
          ) : null}
        </Flex>
      </View>
      <DialogFooter>
        {annotation ? (
          <Flex css={annotationValueEditorFooterExtraCSS}>
            <Button
              type="button"
              size="S"
              variant="quiet"
              isDisabled={isAdvanced && isAdvancedDirty}
              onPress={() =>
                setIsAdvanced((isCurrentlyAdvanced) => !isCurrentlyAdvanced)
              }
            >
              {isAdvanced ? "Hide Advanced" : "Advanced"}
            </Button>
          </Flex>
        ) : null}
        <Button type="button" size="S" variant="default" onPress={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          size="S"
          variant={canSubmit ? "primary" : "default"}
          isDisabled={!canSubmit}
        >
          Save annotation
        </Button>
      </DialogFooter>
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
  isAddAnnotationButtonCompact,
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
> & {
  isAddAnnotationButtonCompact: boolean;
  target: AnnotationBarTarget;
}) {
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
  const [previewConfig, setPreviewConfig] = useState<AnnotationConfig | null>(
    null
  );
  const previewTriggerRef = useRef<Element>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const closePreview = () => setPreviewConfig(null);
  const handlePopoverOpenChange = (nextOpen: boolean) => {
    setIsOpen(nextOpen);
    if (!nextOpen) {
      closePreview();
    }
  };
  const openPreview = ({
    config,
    trigger,
  }: {
    config: AnnotationConfig;
    trigger: Element;
  }) => {
    previewTriggerRef.current = trigger;
    setPreviewConfig(config);
  };
  useInteractOutside({
    ref: previewRef,
    isDisabled: previewConfig == null,
    onInteractOutside: (event) => {
      if (
        previewTriggerRef.current &&
        event.composedPath().includes(previewTriggerRef.current)
      ) {
        return;
      }
      closePreview();
    },
  });
  useDismissPopoverOnEscape({
    isOpen,
    onDismiss: () => {
      if (!isCreatingConfig && searchValue.trim()) {
        setSearchValue("");
        return;
      }
      handlePopoverOpenChange(false);
    },
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
  const hasResults = activeConfigs.length > 0 || inactiveConfigs.length > 0;
  const openConfigCreator = () => {
    setConfigDraft(
      getNewAnnotationConfigDraft({
        name: searchValue.trim(),
      })
    );
    setIsCreatingConfig(true);
  };

  return (
    <>
      <DialogTrigger isOpen={isOpen} onOpenChange={handlePopoverOpenChange}>
        {isAddAnnotationButtonCompact ? (
          <IconButton size="S" aria-label="Add annotation">
            <Icon svg={<Icons.Plus />} />
          </IconButton>
        ) : (
          <Button size="S" variant="quiet" aria-label="Add annotation">
            Add annotation
          </Button>
        )}
        <Popover
          placement="bottom end"
          css={annotationPopoverCSS}
          layer="non-modal"
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
                  <DialogTitle>Project annotations</DialogTitle>
                  <DialogTitleExtra>
                    <LinkButton
                      size="S"
                      variant="quiet"
                      to="/settings/annotations"
                    >
                      Manage
                    </LinkButton>
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
                    <EmptyState
                      graphic={<EmptyStateGraphic variant="annotation" />}
                      description="No matching annotations"
                      action={{
                        type: "strip",
                        items: [
                          {
                            kind: "button",
                            variant: "primary",
                            children: `Create “${searchValue.trim()}”`,
                            onPress: openConfigCreator,
                          },
                        ],
                      }}
                    />
                  </View>
                ) : (
                  <View maxHeight="360px" overflow="auto">
                    {activeConfigs.length > 0 ? (
                      <AnnotationConfigListSection title="On this project">
                        {activeConfigs.map((config) =>
                          renderAnnotationConfigListItem({
                            config,
                            action: "remove",
                            onAction: () => {
                              closePreview();
                              setPendingRemoval(config);
                            },
                            onPreviewClose: closePreview,
                            onPreviewOpen: openPreview,
                          })
                        )}
                      </AnnotationConfigListSection>
                    ) : null}
                    {inactiveConfigs.length > 0 ? (
                      <AnnotationConfigListSection
                        ariaLabel="Available annotations"
                        title={
                          activeConfigs.length > 0
                            ? "Available annotations"
                            : undefined
                        }
                      >
                        {inactiveConfigs.map((config) =>
                          renderAnnotationConfigListItem({
                            config,
                            action: "add",
                            onPreviewClose: closePreview,
                            onPreviewOpen: openPreview,
                            onAction: async () => {
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
                            },
                          })
                        )}
                      </AnnotationConfigListSection>
                    ) : null}
                  </View>
                )}
                <div css={annotationConfigActionsCSS}>
                  <ul
                    css={annotationConfigListCSS}
                    aria-label="Annotation config actions"
                  >
                    <li css={annotationConfigListItemCSS}>
                      <Button
                        size="S"
                        variant="quiet"
                        onPress={openConfigCreator}
                      >
                        New annotation config
                      </Button>
                    </li>
                  </ul>
                </div>
              </>
            )}
            <Popover
              ref={previewRef}
              triggerRef={previewTriggerRef}
              isOpen={previewConfig != null}
              onOpenChange={(nextOpen) => {
                if (!nextOpen) {
                  closePreview();
                }
              }}
              placement="right top"
              trigger="SubmenuTrigger"
              css={annotationPopoverCSS}
              layer="non-modal"
              isNonModal
              shouldCloseOnInteractOutside={(element) =>
                !previewTriggerRef.current?.contains(element)
              }
            >
              {previewConfig ? (
                <Dialog aria-label={`${previewConfig.name} annotation preview`}>
                  <AnnotationConfigPreview config={previewConfig} />
                </Dialog>
              ) : null}
            </Popover>
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

function AnnotationConfigListSection({
  ariaLabel,
  children,
  title,
}: {
  ariaLabel?: string;
  children: ReactNode;
  title?: string;
}) {
  return (
    <section aria-label={ariaLabel ?? title}>
      {title ? (
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
      ) : null}
      <ul css={annotationConfigListCSS} aria-label={ariaLabel ?? title}>
        {children}
      </ul>
    </section>
  );
}

function renderAnnotationConfigListItem({
  action,
  config,
  onAction,
  onPreviewClose,
  onPreviewOpen,
}: {
  action: "add" | "remove";
  config: AnnotationConfig;
  onAction: () => void | Promise<void>;
  onPreviewClose: () => void;
  onPreviewOpen: (params: {
    config: AnnotationConfig;
    trigger: Element;
  }) => void;
}) {
  return (
    <li key={`${action}-${config.id}`} css={annotationConfigListItemCSS}>
      <Button
        size="S"
        variant="quiet"
        leadingVisual={
          action === "add" ? <Icon svg={<Icons.Plus />} /> : undefined
        }
        onPress={action === "add" ? () => void onAction() : undefined}
        onHoverStart={(event) =>
          onPreviewOpen({ config, trigger: event.target })
        }
        onHoverEnd={onPreviewClose}
        onFocus={(event) =>
          onPreviewOpen({ config, trigger: event.currentTarget })
        }
        onBlur={onPreviewClose}
      >
        {config.name}
      </Button>
      {action === "remove" ? (
        <IconButton
          size="S"
          variant="danger"
          aria-label={`Remove ${config.name} from project`}
          onPress={() => void onAction()}
        >
          <Icon svg={<Icons.Minus />} />
        </IconButton>
      ) : null}
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
            <Flex direction="column" gap="size-100" alignItems="end">
              <TextField
                isDisabled
                aria-label={`${config.name} preview`}
                css={{ width: "100%" }}
              >
                <Input placeholder="Enter annotation value" />
              </TextField>
              <Button isDisabled size="S" variant="default">
                Save annotation
              </Button>
            </Flex>
          )}
        </div>
      </Flex>
    </View>
  );
}
