import { css } from "@emotion/react";
import truncate from "lodash/truncate";
import type { FormEvent, ReactNode, Ref, RefObject } from "react";
import {
  Suspense,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useInteractOutside } from "react-aria";
import { MenuSection } from "react-aria-components";

import {
  Alert,
  Button,
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  DialogTrigger,
  FieldError,
  Flex,
  CopyableIDBadge,
  Icon,
  IconButton,
  Icons,
  Input,
  Label,
  LinkButton,
  Loading,
  Menu,
  MenuContainer,
  MenuFooter,
  MenuHeader,
  MenuHeaderTitle,
  MenuItem,
  MenuSectionTitle,
  MenuTrigger,
  Modal,
  ModalOverlay,
  NumberField,
  Popover,
  PopoverArrow,
  SearchField,
  SearchIcon,
  Slider,
  SliderNumberField,
  Text,
  TextArea,
  TextField,
  Token,
  Truncate,
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
import { AnnotationExplanationSummary } from "@phoenix/components/annotation/AnnotationExplanationSummary";
import { formatAnnotationScore } from "@phoenix/components/annotation/annotationFormatUtils";
import { AnnotationLabel } from "@phoenix/components/annotation/AnnotationLabel";
import { AnnotationScoreText } from "@phoenix/components/annotation/AnnotationScoreText";
import { AnnotationValueDisplay } from "@phoenix/components/annotation/AnnotationValueDisplay";
import type { AnnotationValueDraft } from "@phoenix/components/annotation/AnnotationValueDraft";
import { CategoricalQuickCreate } from "@phoenix/components/annotation/CategoricalQuickCreate";
import {
  ContinuousQuickCreate,
  isContinuousQuickCreateConfig,
} from "@phoenix/components/annotation/ContinuousQuickCreate";
import { getOptimizationGradientValueFromConfig } from "@phoenix/components/annotation/optimizationUtils";
import type {
  Annotation,
  AnnotationConfig,
} from "@phoenix/components/annotation/types";
import { CodeEditorFieldWrapper, JSONEditor } from "@phoenix/components/code";
import { EmptyState, EmptyStateGraphic } from "@phoenix/components/core/empty";
import { useOverflowRowPopoverLayout } from "@phoenix/components/core/utility/OverflowRow";
import { UserPicture } from "@phoenix/components/user/UserPicture";
import {
  getUserFeedbackIdentifier,
  USER_FEEDBACK_ANNOTATION_NAME,
} from "@phoenix/constants";
import { useViewer } from "@phoenix/contexts/ViewerContext";
import { AnnotationTooltipFilterActions } from "@phoenix/pages/project/AnnotationTooltipFilterActions";
import { classNames } from "@phoenix/utils/classNames";
import { isPlainObject } from "@phoenix/utils/jsonUtils";

export type AnnotationTargetKind = "session" | "trace" | "span";

export type AnnotationBarTarget = {
  annotations: readonly Annotation[];
  id: string;
  kind: AnnotationTargetKind;
  label?: string;
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

const ANNOTATION_CONFIG_MAX_SIGNIFICANT_DIGITS = 15;
const PROJECT_NAME_SECTION_TITLE_MAX_LENGTH = 40;
const ANNOTATION_CONFIG_NUMBER_FORMAT_OPTIONS = {
  maximumSignificantDigits: ANNOTATION_CONFIG_MAX_SIGNIFICANT_DIGITS,
} satisfies Intl.NumberFormatOptions;
const ANNOTATION_CONFIG_NUMBER_PRECISION_ERROR = `Use ${ANNOTATION_CONFIG_MAX_SIGNIFICANT_DIGITS} or fewer significant digits`;

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
  projectName: string;
  rows: readonly AnnotationBarRow[];
  /** Embeds the annotations as a bar, a menu, or behind a compact row action. */
  variant?:
    | "button"
    | "button-menu"
    | "config-menu"
    | "default"
    | "detail-header";
  configMenuState?: {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
  };
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

  &[data-variant="detail-header"] {
    border: 0;
    background: transparent;

    & > [data-annotation-target] {
      grid-template-columns: minmax(0, 1fr);
      padding: 0;
    }
  }

  &[data-variant="button"] {
    border: 0;
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

const annotationPopoverLayoutCSS = css`
  display: flex;
  flex-direction: column;
  max-height: min(620px, calc(100vh - var(--global-dimension-size-800)));

  > .react-aria-Dialog {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    overscroll-behavior: none;
  }
`;

const annotationPopoverCSS = css`
  ${annotationPopoverLayoutCSS};
  width: min(420px, calc(100vw - var(--global-dimension-size-400)));
`;

const annotationConfigPopoverCSS = css`
  display: flex;
  flex-direction: column;
  width: min(
    var(--global-dimension-size-5000),
    calc(100vw - var(--global-dimension-size-400))
  );
  overflow: hidden;

  > .react-aria-Dialog {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  > .react-aria-Dialog > .annotation-config-editor {
    min-height: 0;
    overflow: auto;
    overscroll-behavior: none;
  }
`;

const annotationButtonMenuCSS = css`
  --menu-min-width: min(320px, calc(100vw - var(--global-dimension-size-400)));
  max-height: min(480px, calc(100vh - var(--global-dimension-size-800)));
`;

const projectAnnotationsMenuCSS = css`
  max-height: 360px;

  &&[data-empty] {
    padding-bottom: var(--global-dimension-size-200);
  }
`;

const compactIconButtonCSS = css`
  flex: none;
  padding: var(--global-dimension-size-50);
  min-width: var(--global-dimension-size-300);
`;

const annotationConfigEditorCSS = css`
  width: min(
    var(--global-dimension-size-5000),
    calc(100vw - var(--global-dimension-size-400))
  );
  max-width: 100%;
  box-sizing: border-box;

  .annotation-config-editor__number-field {
    min-width: 0;
    --field-min-width: 0px;
  }
`;

const continuousConfigFieldsCSS = css`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--global-dimension-size-100);
`;

const categoricalConfigValuesCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-50);
  margin: 0;
  padding: 0;
  list-style: none;

  .annotation-config-editor__category {
    display: grid;
    grid-template-columns:
      minmax(0, 1fr) minmax(var(--global-dimension-size-900), 0.5fr)
      auto;
    gap: var(--global-dimension-size-50);
    align-items: start;
  }
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

const quickCreatePopoverCSS = css`
  ${annotationPopoverLayoutCSS};
  width: min(320px, calc(100vw - var(--global-dimension-size-400)));
`;

const continuousQuickCreatePopoverCSS = css`
  ${annotationPopoverLayoutCSS};
  width: min(520px, calc(100vw - var(--global-dimension-size-400)));
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

function normalizeOptionalNumber(value: number): number | null {
  return Number.isNaN(value) ? null : value;
}

function hasTooManySignificantDigits(value: string): boolean {
  const digits = value.match(/[0-9]/g)?.join("") ?? "";
  return (
    digits.replace(/^0+/, "").length > ANNOTATION_CONFIG_MAX_SIGNIFICANT_DIGITS
  );
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

function isSiblingAnnotationPopoverTrigger({
  element,
  trigger,
}: {
  element: Element;
  trigger: HTMLElement | null;
}): boolean {
  const annotationTarget = trigger?.closest("[data-annotation-target]");
  return (
    annotationTarget != null &&
    annotationTarget === element.closest("[data-annotation-target]") &&
    element.closest('[aria-haspopup="dialog"]') !== null
  );
}

export function DetailPanelAnnotationBar({
  allAnnotationConfigs,
  configMenuState,
  onAddAnnotationConfigToProject,
  onCreateAnnotation,
  onCreateAnnotationConfig,
  onDeleteAnnotation,
  onRemoveAnnotationConfigFromProject,
  onUpdateAnnotation,
  onUpdateAnnotationConfig,
  projectAnnotationConfigs,
  projectName,
  rows,
  variant = "default",
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
    projectName,
  };
  const targetKind = rows.find((row) => row.kind === "target")?.target.kind;
  const annotationMenu = <AnnotationRowsMenu rows={rows} {...sharedProps} />;
  if (variant === "config-menu") {
    if (configMenuState == null) {
      return null;
    }
    return (
      <DetailPanelAnnotationConfigMenu
        allAnnotationConfigs={allAnnotationConfigs}
        isOpen={configMenuState.isOpen}
        onAddAnnotationConfigToProject={onAddAnnotationConfigToProject}
        onCreateAnnotationConfig={onCreateAnnotationConfig}
        onOpenChange={configMenuState.onOpenChange}
        onRemoveAnnotationConfigFromProject={
          onRemoveAnnotationConfigFromProject
        }
        projectAnnotationConfigs={projectAnnotationConfigs}
        projectName={projectName}
      />
    );
  }
  if (variant === "button-menu") {
    return annotationMenu;
  }
  if (variant === "button") {
    return (
      <DetailPanelAnnotationButton targetKind={targetKind}>
        {annotationMenu}
      </DetailPanelAnnotationButton>
    );
  }
  const annotationRows = (
    <div
      css={annotationBarCSS}
      aria-label="Annotations bar"
      data-variant={variant}
    >
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
  return annotationRows;
}

const annotationManagementTriggerCSS = css`
  &[data-focus-visible]:not(:focus-visible) {
    outline: none;
  }
`;

export function DetailPanelAnnotationButton({
  children,
  menuKind = "annotation-values",
  targetKind,
  variant = "icon",
}: {
  children:
    | ReactNode
    | ((props: {
        isOpen: boolean;
        onOpenChange: (isOpen: boolean) => void;
      }) => ReactNode);
  menuKind?: "annotation-configs" | "annotation-values";
  targetKind?: AnnotationTargetKind;
  variant?: "ghost" | "icon";
}) {
  const overflowPopoverLayout = useOverflowRowPopoverLayout();
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const targetLabel = targetKind ? `${targetKind} annotations` : "annotations";
  const handleOpenChange = (nextIsOpen: boolean) => {
    if (nextIsOpen) {
      setHasOpened(true);
    }
    setIsOpen(nextIsOpen);
  };
  const shouldRenderContent =
    menuKind === "annotation-configs" ? hasOpened : isOpen;
  const isProjectAnnotationsTrigger =
    menuKind === "annotation-configs" && overflowPopoverLayout === "vertical";
  const content = shouldRenderContent
    ? typeof children === "function"
      ? children({ isOpen, onOpenChange: handleOpenChange })
      : children
    : null;

  const trigger = isProjectAnnotationsTrigger ? (
    <Button
      css={annotationManagementTriggerCSS}
      size="S"
      variant="quiet"
      aria-label="Project annotations"
      data-annotation-menu-open={isOpen}
      onClick={(event) => event.stopPropagation()}
    >
      Project annotations
    </Button>
  ) : variant === "ghost" ? (
    <AnnotationLabel
      annotation={{ name: "Add annotation" }}
      annotationDisplayPreference="none"
      aria-label="Add annotation"
      clickable
      variant="ghost"
    />
  ) : (
    <IconButton
      css={annotationManagementTriggerCSS}
      size="S"
      aria-label="Add annotation"
      data-annotation-menu-open={isOpen}
      onClick={(event) => event.stopPropagation()}
    >
      <Icon svg={<Icons.Plus />} />
    </IconButton>
  );
  const annotationOverlay =
    menuKind === "annotation-configs" ? (
      <DialogTrigger isOpen={isOpen} onOpenChange={handleOpenChange}>
        {trigger}
        {shouldRenderContent ? (
          <Popover
            data-annotation-overlay
            placement="bottom start"
            stacking="app-floating"
            maxHeight={620}
            css={annotationConfigPopoverCSS}
            aria-label={`Manage ${targetLabel}`}
          >
            <Suspense fallback={<Loading />}>{content}</Suspense>
          </Popover>
        ) : null}
      </DialogTrigger>
    ) : (
      <MenuTrigger isOpen={isOpen} onOpenChange={handleOpenChange}>
        {trigger}
        {shouldRenderContent ? (
          <MenuContainer
            data-annotation-overlay
            placement="bottom start"
            stacking="app-floating"
            // Not a pick-one menu: this is an annotation-management panel that
            // launches from a MenuTrigger. It keeps the modal contract it was
            // built with (automatic dialog role, focus containment) rather than
            // inheriting MenuContainer's non-modal menu default.
            isNonModal={false}
            minHeight={0}
            maxHeight="min(520px, calc(100vh - var(--global-dimension-size-800)))"
            aria-label={`Manage ${targetLabel}`}
          >
            <Suspense fallback={<Loading />}>{content}</Suspense>
          </MenuContainer>
        ) : null}
      </MenuTrigger>
    );
  return isProjectAnnotationsTrigger ? (
    <MenuFooter>{annotationOverlay}</MenuFooter>
  ) : (
    annotationOverlay
  );
}

type SharedAnnotationBarProps = Omit<DetailPanelAnnotationBarProps, "rows">;

type AnnotationBarConfigState = {
  config: AnnotationConfig | null;
  id: string;
  name: string;
};

function getAnnotationBarConfigStates({
  allAnnotationConfigs,
  projectAnnotationConfigs,
  target,
}: {
  allAnnotationConfigs: readonly AnnotationConfig[];
  projectAnnotationConfigs: readonly AnnotationConfig[];
  target: AnnotationBarTarget;
}) {
  const annotationsByName = groupAnnotationsByName({
    annotations: target.annotations,
  });
  const rowConfigs: AnnotationBarConfigState[] = projectAnnotationConfigs.map(
    (config) => ({
      config,
      id: config.id ?? `config-${config.name}`,
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
  const populatedRowConfigs = rowConfigs.filter(
    ({ name }) => (annotationsByName[name]?.length ?? 0) > 0
  );
  const unpopulatedRowConfigs = rowConfigs.filter(
    ({ name }) => (annotationsByName[name]?.length ?? 0) === 0
  );
  return { annotationsByName, populatedRowConfigs, unpopulatedRowConfigs };
}

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
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(
    null
  );
  const { annotationsByName, populatedRowConfigs, unpopulatedRowConfigs } =
    getAnnotationBarConfigStates({
      allAnnotationConfigs,
      projectAnnotationConfigs,
      target,
    });
  const orderedRowConfigs = [...populatedRowConfigs, ...unpopulatedRowConfigs];
  return (
    <div
      css={annotationRowCSS}
      data-annotation-target={target.kind}
      role="group"
      aria-label={`${target.kind} annotations`}
    >
      {target.label ? (
        <Text size="XS" color="text-500" weight="heavy">
          {target.label}
        </Text>
      ) : null}
      <div css={annotationLabelsCSS}>
        {orderedRowConfigs.map(({ config, id, name }, layoutIndex) => {
          const annotations = annotationsByName[name] ?? [];
          const annotationId = `${target.id}-${id}-${name}`;
          return (
            <AnnotationValuePopover
              key={annotationId}
              annotationName={name}
              annotations={annotations}
              config={config}
              displayMode="detail"
              isOpen={activeAnnotationId === annotationId}
              layoutIndex={layoutIndex}
              onOpenChange={(isOpen) => {
                setActiveAnnotationId((currentAnnotationId) =>
                  isOpen
                    ? annotationId
                    : currentAnnotationId === annotationId
                      ? null
                      : currentAnnotationId
                );
              }}
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

function AnnotationRowsMenu({
  allAnnotationConfigs,
  projectAnnotationConfigs,
  rows,
  ...sharedProps
}: SharedAnnotationBarProps & { rows: readonly AnnotationBarRow[] }) {
  const [selectedAnnotation, setSelectedAnnotation] =
    useState<AnnotationValuePopoverCommonProps | null>(null);
  const menuItemElementsRef = useRef(new Map<string, HTMLDivElement>());
  const selectedMenuItemRef = useRef<HTMLDivElement>(null);
  const targetRows = rows.filter(
    (row): row is Extract<AnnotationBarRow, { kind: "target" }> =>
      row.kind === "target"
  );
  const targetLabel =
    targetRows.length === 1
      ? `${targetRows[0].target.kind} annotations`
      : "Annotations";
  return (
    <>
      <Menu
        data-annotation-picker-menu
        css={annotationButtonMenuCSS}
        aria-label={targetLabel}
        shouldCloseOnSelect={false}
        renderEmptyState={() => (
          <Text color="text-500">No annotations available</Text>
        )}
      >
        {targetRows.map(({ id, target }) => (
          <AnnotationTargetMenuSections
            key={id}
            allAnnotationConfigs={allAnnotationConfigs}
            projectAnnotationConfigs={projectAnnotationConfigs}
            target={target}
            onOpenAnnotation={(annotation, menuItemKey) => {
              selectedMenuItemRef.current =
                menuItemElementsRef.current.get(menuItemKey) ?? null;
              setSelectedAnnotation(annotation);
            }}
            onMenuItemRefChange={(menuItemKey, element) => {
              if (element) {
                menuItemElementsRef.current.set(menuItemKey, element);
              } else {
                menuItemElementsRef.current.delete(menuItemKey);
              }
            }}
            {...sharedProps}
          />
        ))}
      </Menu>
      {selectedAnnotation ? (
        <AnnotationValuePopover
          key={`${selectedAnnotation.target.kind}-${selectedAnnotation.target.id}-${selectedAnnotation.annotationName}`}
          {...selectedAnnotation}
          displayMode="menu"
          isOpen
          onOpenChange={(nextIsOpen) => {
            if (!nextIsOpen) {
              setSelectedAnnotation(null);
            }
          }}
          triggerRef={selectedMenuItemRef}
        />
      ) : null}
    </>
  );
}

function AnnotationTargetMenuSections({
  allAnnotationConfigs,
  onMenuItemRefChange,
  onOpenAnnotation,
  projectAnnotationConfigs,
  target,
  ...sharedProps
}: SharedAnnotationBarProps & {
  onMenuItemRefChange: (
    menuItemKey: string,
    element: HTMLDivElement | null
  ) => void;
  onOpenAnnotation: (
    annotation: AnnotationValuePopoverCommonProps,
    menuItemKey: string
  ) => void;
  target: AnnotationBarTarget;
}) {
  const { annotationsByName, populatedRowConfigs, unpopulatedRowConfigs } =
    getAnnotationBarConfigStates({
      allAnnotationConfigs,
      projectAnnotationConfigs,
      target,
    });
  return (
    <>
      {populatedRowConfigs.length > 0 ? (
        <MenuSection>
          <MenuSectionTitle title={`On this ${target.kind}`} />
          {populatedRowConfigs.map(({ config, id, name }) => (
            <AnnotationValueMenuItem
              key={`${target.id}-${id}-${name}`}
              annotationName={name}
              annotations={annotationsByName[name] ?? []}
              config={config}
              onMenuItemRefChange={onMenuItemRefChange}
              onOpenAnnotation={onOpenAnnotation}
              target={target}
              {...sharedProps}
            />
          ))}
        </MenuSection>
      ) : null}
      {unpopulatedRowConfigs.length > 0 ? (
        <MenuSection>
          <MenuSectionTitle title="Available annotations" />
          {unpopulatedRowConfigs.map(({ config, id, name }) => (
            <AnnotationValueMenuItem
              key={`${target.id}-${id}-${name}`}
              annotationName={name}
              annotations={[]}
              config={config}
              onMenuItemRefChange={onMenuItemRefChange}
              onOpenAnnotation={onOpenAnnotation}
              target={target}
              {...sharedProps}
            />
          ))}
        </MenuSection>
      ) : null}
    </>
  );
}

function AnnotationValueMenuItem({
  annotationName,
  annotations,
  config,
  onMenuItemRefChange,
  onOpenAnnotation,
  target,
  ...sharedProps
}: AnnotationValuePopoverCommonProps & {
  onMenuItemRefChange: (
    menuItemKey: string,
    element: HTMLDivElement | null
  ) => void;
  onOpenAnnotation: (
    annotation: AnnotationValuePopoverCommonProps,
    menuItemKey: string
  ) => void;
}) {
  const aggregate = getAnnotationAggregate({ annotations });
  const optimizationValue = getOptimizationGradientValueFromConfig({
    config: config ?? undefined,
    score: aggregate.score,
  });
  const menuItemKey = `${target.kind}-${target.id}-${annotationName}`;
  const annotationPopoverProps = {
    annotationName,
    annotations,
    config,
    target,
    ...sharedProps,
  };
  const hasAnnotations = annotations.length > 0;
  return (
    <MenuItem
      ref={(element) => onMenuItemRefChange(menuItemKey, element)}
      id={menuItemKey}
      textValue={annotationName}
      onAction={() => onOpenAnnotation(annotationPopoverProps, menuItemKey)}
    >
      {hasAnnotations ? (
        <Flex direction="row" gap="size-200" alignItems="start" minWidth={0}>
          <Text
            color="text-700"
            title={annotationName}
            css={css`
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            `}
          >
            {annotationName}
          </Text>
          <Flex direction="column" gap="size-25" minWidth={0}>
            <AnnotationValueDisplay
              label={aggregate.isMixed ? "mixed" : aggregate.label}
              optimizationValue={optimizationValue}
              score={aggregate.score}
            />
            <AnnotationExplanationSummary annotations={annotations} />
          </Flex>
        </Flex>
      ) : (
        <Text
          color="text-500"
          title={annotationName}
          css={css`
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          `}
        >
          {annotationName}
        </Text>
      )}
    </MenuItem>
  );
}

type AnnotationPopoverView =
  | "config"
  | "continuous-quick-create"
  | "quick-create"
  | "summary"
  | "value";

type AnnotationValuePopoverCommonProps = Pick<
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
};

export type AnnotationValuePopoverRenderTrigger = (props: {
  ref: Ref<HTMLButtonElement>;
}) => ReactNode;

export type AnnotationValuePopoverProps = AnnotationValuePopoverCommonProps &
  (
    | {
        displayMode: "detail";
        isOpen: boolean;
        layoutIndex: number;
        onOpenChange: (isOpen: boolean) => void;
        renderTrigger?: never;
      }
    | {
        displayMode: "table";
        renderTrigger: AnnotationValuePopoverRenderTrigger;
      }
    | {
        displayMode: "menu";
        isOpen: boolean;
        onOpenChange: (isOpen: boolean) => void;
        renderTrigger?: never;
        triggerRef: RefObject<HTMLElement | null>;
      }
  );

export function AnnotationValuePopover(props: AnnotationValuePopoverProps) {
  const {
    annotationName,
    annotations,
    config,
    displayMode,
    onCreateAnnotation,
    onCreateAnnotationConfig,
    onDeleteAnnotation,
    onUpdateAnnotation,
    onUpdateAnnotationConfig,
    renderTrigger,
    target,
  } = props;
  const { viewer } = useViewer();
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
  const implicitAppIdentifier = viewer
    ? getUserFeedbackIdentifier(viewer.id)
    : "";
  const hasUnknownAnnotationIdentifier = displayedAnnotations.some(
    ({ identifier }) => identifier == null
  );
  const wouldAddOverrideAnnotation = displayedAnnotations.some(
    ({ identifier }) => identifier === implicitAppIdentifier
  );
  const canAddAnnotation =
    !hasUnknownAnnotationIdentifier && !wouldAddOverrideAnnotation;
  const hasAnnotations = displayedAnnotations.length > 0;
  const quickCreateConfig =
    config?.annotationType === "CATEGORICAL" ? config : null;
  const continuousQuickCreateConfig =
    config?.annotationType === "CONTINUOUS" &&
    isContinuousQuickCreateConfig({ config })
      ? config
      : null;
  const initialView = hasAnnotations
    ? "summary"
    : quickCreateConfig
      ? "quick-create"
      : continuousQuickCreateConfig
        ? "continuous-quick-create"
        : "value";
  const [isUncontrolledOpen, setIsUncontrolledOpen] = useState(false);
  const uncontrolledTriggerRef = useRef<HTMLButtonElement>(null);
  const isMenuDisplay = displayMode === "menu";
  const isControlled = displayMode !== "table";
  const isOpen = isControlled ? props.isOpen : isUncontrolledOpen;
  const onControlledOpenChange = isControlled ? props.onOpenChange : null;
  const layoutIndex = displayMode === "detail" ? props.layoutIndex : null;
  const previousLayoutIndexRef = useRef(layoutIndex);
  const triggerRef: RefObject<HTMLElement | null> = isMenuDisplay
    ? props.triggerRef
    : uncontrolledTriggerRef;
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
  useLayoutEffect(() => {
    const previousLayoutIndex = previousLayoutIndexRef.current;
    previousLayoutIndexRef.current = layoutIndex;
    if (
      isOpen &&
      layoutIndex !== null &&
      previousLayoutIndex !== null &&
      previousLayoutIndex !== layoutIndex
    ) {
      // React Aria repositions popovers on window resize and target resize, but
      // not when an unchanged target moves because its siblings were reordered.
      // Populated annotations sort ahead of ghost annotations, so notify its
      // positioning system after that intentional layout move.
      window.dispatchEvent(new Event("resize"));
    }
  }, [isOpen, layoutIndex]);
  const aggregate = getAnnotationAggregate({
    annotations: displayedAnnotations,
  });
  const aggregateOptimizationValue = getOptimizationGradientValueFromConfig({
    config: config ?? undefined,
    score: aggregate.score,
  });
  const isShowingCategoricalQuickCreate =
    view === "quick-create" && quickCreateConfig !== null;
  const isShowingContinuousQuickCreate =
    view === "continuous-quick-create" && continuousQuickCreateConfig !== null;
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
      if (onControlledOpenChange) {
        onControlledOpenChange(nextIsOpen);
      } else {
        setIsUncontrolledOpen(nextIsOpen);
      }
    },
    [isOpen, onControlledOpenChange, resetPopover]
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
  const shouldIgnoreOutsideInteraction = useCallback(
    (event: PointerEvent) => {
      if (
        triggerRef.current &&
        event.composedPath().includes(triggerRef.current)
      ) {
        return true;
      }
      const eventTarget = event.target;
      return (
        eventTarget instanceof Element &&
        (eventTarget.closest("[data-annotation-actions-menu]") !== null ||
          eventTarget.closest("[data-annotation-filter-menu]") !== null ||
          eventTarget.closest("[data-annotation-picker-menu]") !== null)
      );
    },
    [triggerRef]
  );
  const blockOutsideInteraction = useCallback((event: PointerEvent) => {
    // This popover is non-modal so the page remains available, but its
    // dismissing gesture must not also activate a table row or control beneath
    // it. Consume both the start and completed click of that gesture.
    event.preventDefault();
    event.stopPropagation();
  }, []);
  useInteractOutside({
    ref: popoverRef,
    isDisabled: !isOpen,
    onInteractOutsideStart: (event) => {
      const eventTarget = event.target;
      if (
        shouldIgnoreOutsideInteraction(event) ||
        (eventTarget instanceof Element &&
          isSiblingAnnotationPopoverTrigger({
            element: eventTarget,
            trigger: triggerRef.current,
          }))
      ) {
        return;
      }
      blockOutsideInteraction(event);
    },
    onInteractOutside: (event) => {
      if (shouldIgnoreOutsideInteraction(event)) {
        return;
      }
      const eventTarget = event.target;
      if (
        eventTarget instanceof Element &&
        isSiblingAnnotationPopoverTrigger({
          element: eventTarget,
          trigger: triggerRef.current,
        })
      ) {
        handleOpenChange(false);
        return;
      }
      blockOutsideInteraction(event);
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
  const handleQuickCreate = async ({
    shouldExplain,
    value,
  }: {
    shouldExplain: boolean;
    value: AnnotationValueDraft;
  }) => {
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
  };

  const trigger =
    displayMode === "table" ? (
      renderTrigger({ ref: uncontrolledTriggerRef })
    ) : displayMode === "detail" ? (
      <AnnotationLabel
        ref={uncontrolledTriggerRef}
        annotation={{
          name: annotationName,
          label: aggregate.label,
          score: aggregate.score,
        }}
        annotationDisplayPreference={
          aggregate.isMixed ? "none" : "score-and-label"
        }
        optimizationValue={aggregateOptimizationValue}
        clickable
        variant={hasAnnotations ? "default" : "ghost"}
        aria-haspopup="dialog"
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
              <AnnotationScoreText
                appearance="compact"
                fontFamily="mono"
                optimizationValue={aggregateOptimizationValue}
              >
                {formatAnnotationScore(aggregate.score)}
              </AnnotationScoreText>
            ) : null}
          </Flex>
        ) : null}
      </AnnotationLabel>
    ) : null;
  return (
    <AnnotationValuePopoverTrigger
      isMenuDisplay={isMenuDisplay}
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
    >
      {trigger}
      <Popover
        ref={popoverRef}
        data-annotation-overlay
        triggerRef={triggerRef}
        isOpen={isMenuDisplay ? isOpen : undefined}
        onOpenChange={isMenuDisplay ? handleOpenChange : undefined}
        placement={isMenuDisplay ? "right top" : "bottom start"}
        shouldFlip={isMenuDisplay ? true : undefined}
        css={
          isShowingContinuousQuickCreate
            ? continuousQuickCreatePopoverCSS
            : isShowingCategoricalQuickCreate
              ? quickCreatePopoverCSS
              : annotationPopoverCSS
        }
        isNonModal
        isKeyboardDismissDisabled={false}
        shouldCloseOnInteractOutside={(element) =>
          !triggerRef.current?.contains(element) &&
          !isSiblingAnnotationPopoverTrigger({
            element,
            trigger: triggerRef.current,
          }) &&
          !element.closest("[data-annotation-actions-menu]") &&
          !element.closest("[data-annotation-filter-menu]") &&
          !element.closest("[data-annotation-picker-menu]")
        }
      >
        {isMenuDisplay ? null : <PopoverArrow />}
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
          ) : isShowingCategoricalQuickCreate ? (
            <CategoricalQuickCreate
              annotationName={annotationName}
              config={quickCreateConfig}
              onCreate={handleQuickCreate}
            />
          ) : isShowingContinuousQuickCreate ? (
            <ContinuousQuickCreate
              annotationName={annotationName}
              config={continuousQuickCreateConfig}
              onCreate={handleQuickCreate}
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
                onEditConfig={
                  config && annotationName !== USER_FEEDBACK_ANNOTATION_NAME
                    ? openConfigEditor
                    : undefined
                }
              />
              <AnnotationSummaryList
                annotations={displayedAnnotations}
                config={config}
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
                displayMode={displayMode}
                targetKind={target.kind}
              />
              {canAddAnnotation ? (
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
    </AnnotationValuePopoverTrigger>
  );
}

function AnnotationValuePopoverTrigger({
  children,
  isMenuDisplay,
  isOpen,
  onOpenChange,
}: {
  children: ReactNode;
  isMenuDisplay: boolean;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  if (isMenuDisplay) {
    return children;
  }
  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={onOpenChange}>
      {children}
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
  config,
  deletingAnnotationId,
  onCancelDelete,
  onConfirmDelete,
  onDelete,
  onEdit,
  displayMode,
  targetKind,
}: {
  annotations: readonly Annotation[];
  config: AnnotationConfig | null;
  deletingAnnotationId: string | null;
  onCancelDelete: () => void;
  onConfirmDelete: (annotation: Annotation) => Promise<void>;
  onDelete: (annotationId: string) => void;
  onEdit: (annotation: Annotation) => void;
  displayMode: AnnotationValuePopoverProps["displayMode"];
  targetKind: AnnotationTargetKind;
}) {
  return (
    <ul css={annotationEntryListCSS} aria-label="Annotation values">
      {annotations.map((annotation, annotationIndex) => {
        const annotationKey = annotation.id ?? `annotation-${annotationIndex}`;
        const isConfirmingDelete = deletingAnnotationId === annotation.id;
        const isShowingTableActions =
          displayMode === "table" && !isConfirmingDelete;
        const optimizationValue = getOptimizationGradientValueFromConfig({
          config: config ?? undefined,
          score: annotation.score,
        });
        const modifiedTitle = annotation.updatedAt
          ? `Modified: ${new Date(annotation.updatedAt).toLocaleString()}`
          : undefined;
        return (
          <li
            key={annotationKey}
            className="annotation-entry"
            css={annotationEntryCSS}
          >
            <div className="annotation-entry__header">
              {isConfirmingDelete ? (
                <div className="annotation-entry__value">
                  <Text>Confirm</Text>
                </div>
              ) : (
                <AnnotationValueDisplay
                  className="annotation-entry__value"
                  label={annotation.label}
                  optimizationValue={optimizationValue}
                  score={annotation.score}
                  title={modifiedTitle}
                />
              )}
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
                ) : isShowingTableActions ? (
                  <AnnotationTableActions
                    annotation={annotation}
                    optimizationValue={optimizationValue}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    targetKind={targetKind}
                  />
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

const annotationTableActionsCSS = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--global-dimension-size-25);
  direction: ltr;

  .annotation-table-actions__filters {
    order: 1;
  }

  .annotation-table-actions__more {
    order: 2;
  }
`;

function AnnotationTableActions({
  annotation,
  optimizationValue,
  onDelete,
  onEdit,
  targetKind,
}: {
  annotation: Annotation;
  optimizationValue?: number | null;
  onDelete: (annotationId: string) => void;
  onEdit: (annotation: Annotation) => void;
  targetKind: AnnotationTargetKind;
}) {
  const [activeMenu, setActiveMenu] = useState<"filter" | "more" | null>(null);
  const handleMenuOpenChange = ({
    isOpen,
    menu,
  }: {
    isOpen: boolean;
    menu: "filter" | "more";
  }) => {
    setActiveMenu((currentMenu) =>
      isOpen ? menu : currentMenu === menu ? null : currentMenu
    );
  };

  return (
    <div className="annotation-table-actions" css={annotationTableActionsCSS}>
      <AnnotationTooltipFilterActions
        annotation={{ ...annotation, optimizationValue }}
        className="annotation-table-actions__filters"
        displayMode="collapsible"
        isOpen={activeMenu === "filter"}
        onOpenChange={(isOpen) =>
          handleMenuOpenChange({ isOpen, menu: "filter" })
        }
        targetKind={targetKind}
      />
      <AnnotationActionsMenu
        annotation={annotation}
        className="annotation-table-actions__more"
        isOpen={activeMenu === "more"}
        onDelete={onDelete}
        onEdit={onEdit}
        onOpenChange={(isOpen) =>
          handleMenuOpenChange({ isOpen, menu: "more" })
        }
      />
    </div>
  );
}

function AnnotationActionsMenu({
  annotation,
  className,
  isOpen,
  onDelete,
  onEdit,
  onOpenChange,
}: {
  annotation: Annotation;
  className?: string;
  isOpen: boolean;
  onDelete: (annotationId: string) => void;
  onEdit: (annotation: Annotation) => void;
  onOpenChange: (isOpen: boolean) => void;
}) {
  return (
    <MenuTrigger isOpen={isOpen} onOpenChange={onOpenChange}>
      <IconButton
        className={className}
        size="S"
        aria-label="More annotation actions"
      >
        <Icon svg={<Icons.MoreHorizontal />} />
      </IconButton>
      <Popover placement="bottom start" data-annotation-actions-menu isNonModal>
        <Menu
          aria-label="Annotation actions"
          css={css`
            --menu-min-width: 120px;
          `}
          onAction={(action) => {
            if (action === "edit") {
              onEdit(annotation);
            } else if (action === "delete" && annotation.id) {
              onDelete(annotation.id);
            }
          }}
        >
          <MenuItem id="edit">Edit</MenuItem>
          <MenuItem id="delete">Delete</MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
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
  const continuousConfig =
    config?.annotationType === "CONTINUOUS" ? config : null;
  const hasBoundedContinuousRange =
    typeof continuousConfig?.lowerBound === "number" &&
    typeof continuousConfig.upperBound === "number";
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
                        {value.score == null
                          ? "—"
                          : formatAnnotationScore(value.score)}
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
          {continuousConfig && hasBoundedContinuousRange ? (
            <Slider
              label={annotationName}
              minValue={continuousConfig.lowerBound ?? 0}
              maxValue={continuousConfig.upperBound ?? 1}
              step={0.01}
              value={draft.score ?? continuousConfig.lowerBound ?? 0}
              onChange={(score) => {
                const nextScore = Array.isArray(score) ? score[0] : score;
                updateBasicDraft({ ...draft, score: nextScore ?? null });
              }}
            >
              <SliderNumberField
                aria-label={`${annotationName} exact value`}
                value={draft.score ?? continuousConfig.lowerBound ?? 0}
                onChange={(score) => updateBasicDraft({ ...draft, score })}
              />
            </Slider>
          ) : null}
          {continuousConfig && !hasBoundedContinuousRange ? (
            <NumberField
              value={draft.score ?? undefined}
              minValue={continuousConfig.lowerBound ?? undefined}
              maxValue={continuousConfig.upperBound ?? undefined}
              onChange={(score) =>
                updateBasicDraft({
                  ...draft,
                  score: Number.isNaN(score) ? null : score,
                })
              }
              css={{ width: "100%" }}
            >
              <Label>{annotationName}</Label>
              <Input placeholder="Enter a score" />
            </NumberField>
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
                <CopyableIDBadge
                  id={annotation.id}
                  tooltipText="Copy Annotation ID"
                />
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
  error = null,
  mode,
  onCancel,
  onDraftChange,
  onSave,
}: {
  draft: AnnotationConfigDraft;
  error?: string | null;
  mode: "create" | "edit";
  onCancel: () => void;
  onDraftChange: (draft: AnnotationConfigDraft) => void;
  onSave: () => Promise<void>;
}) {
  const [numberPrecisionErrors, setNumberPrecisionErrors] = useState<{
    lowerBound: boolean;
    scores: boolean[];
    upperBound: boolean;
  }>({ lowerBound: false, scores: [], upperBound: false });
  const hasInvalidContinuousRange =
    draft.annotationType === "CONTINUOUS" &&
    draft.lowerBound != null &&
    draft.upperBound != null &&
    draft.upperBound <= draft.lowerBound;
  const hasNumberPrecisionError =
    draft.annotationType === "CONTINUOUS"
      ? numberPrecisionErrors.lowerBound || numberPrecisionErrors.upperBound
      : draft.annotationType === "CATEGORICAL"
        ? draft.values.some(
            (_value, valueIndex) =>
              numberPrecisionErrors.scores[valueIndex] === true
          )
        : false;
  const canSave =
    Boolean(draft.name.trim()) &&
    !hasInvalidContinuousRange &&
    !hasNumberPrecisionError &&
    (draft.annotationType !== "CATEGORICAL" ||
      draft.values.every((value) => Boolean(value.label.trim())));
  return (
    <form
      className="annotation-config-editor"
      css={annotationConfigEditorCSS}
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
      {error ? (
        <View paddingX="size-200" paddingTop="size-200">
          <Alert variant="danger">{error}</Alert>
        </View>
      ) : null}
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
            <div css={continuousConfigFieldsCSS}>
              <NumberField
                className="annotation-config-editor__number-field"
                formatOptions={ANNOTATION_CONFIG_NUMBER_FORMAT_OPTIONS}
                isInvalid={numberPrecisionErrors.lowerBound}
                value={draft.lowerBound ?? undefined}
                onChange={(lowerBound) =>
                  onDraftChange({
                    ...draft,
                    lowerBound: normalizeOptionalNumber(lowerBound),
                  })
                }
              >
                <Label>Minimum</Label>
                <Input
                  onInput={(event) => {
                    const hasError = hasTooManySignificantDigits(
                      event.currentTarget.value
                    );
                    setNumberPrecisionErrors((currentErrors) => ({
                      ...currentErrors,
                      lowerBound: hasError,
                    }));
                  }}
                />
                <FieldError>
                  {numberPrecisionErrors.lowerBound
                    ? ANNOTATION_CONFIG_NUMBER_PRECISION_ERROR
                    : null}
                </FieldError>
              </NumberField>
              <NumberField
                className="annotation-config-editor__number-field"
                formatOptions={ANNOTATION_CONFIG_NUMBER_FORMAT_OPTIONS}
                value={draft.upperBound ?? undefined}
                onChange={(upperBound) =>
                  onDraftChange({
                    ...draft,
                    upperBound: normalizeOptionalNumber(upperBound),
                  })
                }
                isInvalid={
                  hasInvalidContinuousRange || numberPrecisionErrors.upperBound
                }
              >
                <Label>Maximum</Label>
                <Input
                  onInput={(event) => {
                    const hasError = hasTooManySignificantDigits(
                      event.currentTarget.value
                    );
                    setNumberPrecisionErrors((currentErrors) => ({
                      ...currentErrors,
                      upperBound: hasError,
                    }));
                  }}
                />
                <FieldError>
                  {numberPrecisionErrors.upperBound
                    ? ANNOTATION_CONFIG_NUMBER_PRECISION_ERROR
                    : hasInvalidContinuousRange
                      ? "Maximum must be greater than minimum"
                      : null}
                </FieldError>
              </NumberField>
            </div>
          ) : null}
          {draft.annotationType === "CATEGORICAL" ? (
            <Flex direction="column" gap="size-100">
              <Text size="XS" weight="heavy">
                Categories
              </Text>
              <ul css={categoricalConfigValuesCSS}>
                {draft.values.map((value, valueIndex) => (
                  <li
                    className="annotation-config-editor__category"
                    key={valueIndex}
                  >
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
                    <NumberField
                      className="annotation-config-editor__number-field"
                      formatOptions={ANNOTATION_CONFIG_NUMBER_FORMAT_OPTIONS}
                      isInvalid={
                        numberPrecisionErrors.scores[valueIndex] === true
                      }
                      value={value.score ?? undefined}
                      onChange={(score) => {
                        const values = draft.values.map(
                          (currentValue, currentIndex) =>
                            currentIndex === valueIndex
                              ? {
                                  ...currentValue,
                                  score: normalizeOptionalNumber(score),
                                }
                              : currentValue
                        );
                        onDraftChange({ ...draft, values });
                      }}
                      aria-label={`Category ${valueIndex + 1} score`}
                    >
                      <Input
                        placeholder="Score"
                        onInput={(event) => {
                          const hasError = hasTooManySignificantDigits(
                            event.currentTarget.value
                          );
                          setNumberPrecisionErrors((currentErrors) => {
                            const scores = [...currentErrors.scores];
                            scores[valueIndex] = hasError;
                            return { ...currentErrors, scores };
                          });
                        }}
                      />
                      <FieldError>
                        {numberPrecisionErrors.scores[valueIndex]
                          ? ANNOTATION_CONFIG_NUMBER_PRECISION_ERROR
                          : null}
                      </FieldError>
                    </NumberField>
                    <Button
                      css={compactIconButtonCSS}
                      size="S"
                      variant="quiet"
                      leadingVisual={<Icon svg={<Icons.Trash />} />}
                      aria-label={`Remove category ${valueIndex + 1}`}
                      onPress={() => {
                        setNumberPrecisionErrors((currentErrors) => ({
                          ...currentErrors,
                          scores: currentErrors.scores.filter(
                            (_hasError, currentIndex) =>
                              currentIndex !== valueIndex
                          ),
                        }));
                        onDraftChange({
                          ...draft,
                          values: draft.values.filter(
                            (_currentValue, currentIndex) =>
                              currentIndex !== valueIndex
                          ),
                        });
                      }}
                    />
                  </li>
                ))}
              </ul>
              <Button
                size="S"
                variant="default"
                leadingVisual={<Icon svg={<Icons.Plus />} />}
                onPress={() => {
                  setNumberPrecisionErrors((currentErrors) => ({
                    ...currentErrors,
                    scores: [...currentErrors.scores, false],
                  }));
                  onDraftChange({
                    ...draft,
                    values: [...draft.values, { label: "", score: null }],
                  });
                }}
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

type DetailPanelAnnotationConfigMenuProps = Pick<
  SharedAnnotationBarProps,
  | "allAnnotationConfigs"
  | "onAddAnnotationConfigToProject"
  | "onCreateAnnotationConfig"
  | "onRemoveAnnotationConfigFromProject"
  | "projectAnnotationConfigs"
  | "projectName"
>;

function AddAnnotationPopover({
  isAddAnnotationButtonCompact,
  target,
  ...menuProps
}: DetailPanelAnnotationConfigMenuProps & {
  isAddAnnotationButtonCompact: boolean;
  target: AnnotationBarTarget;
}) {
  const targetLabel = target.label ?? target.kind;
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      {isAddAnnotationButtonCompact ? (
        <IconButton
          css={annotationManagementTriggerCSS}
          size="S"
          aria-label="Add annotation"
        >
          <Icon svg={<Icons.Plus />} />
        </IconButton>
      ) : (
        <Button
          css={annotationManagementTriggerCSS}
          size="S"
          variant="quiet"
          aria-label="Add annotation"
        >
          Add annotation
        </Button>
      )}
      <Popover
        data-annotation-overlay
        placement="bottom start"
        stacking="app-floating"
        maxHeight={620}
        css={annotationConfigPopoverCSS}
        aria-label={`Manage ${targetLabel.toLocaleLowerCase()} annotations`}
      >
        <DetailPanelAnnotationConfigMenu
          {...menuProps}
          isOpen={isOpen}
          onOpenChange={setIsOpen}
        />
      </Popover>
    </DialogTrigger>
  );
}

export function DetailPanelAnnotationConfigMenu({
  allAnnotationConfigs,
  isOpen,
  onOpenChange,
  onAddAnnotationConfigToProject,
  onCreateAnnotationConfig,
  onRemoveAnnotationConfigFromProject,
  projectAnnotationConfigs,
  projectName,
}: DetailPanelAnnotationConfigMenuProps & {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const [searchValue, setSearchValue] = useState("");
  const [pendingRemoval, setPendingRemoval] = useState<AnnotationConfig | null>(
    null
  );
  const [isCreatingConfig, setIsCreatingConfig] = useState(false);
  const [configDraft, setConfigDraft] = useState<AnnotationConfigDraft>(() =>
    getNewAnnotationConfigDraft()
  );
  const [error, setError] = useState<string | null>(null);
  const [previousIsOpen, setPreviousIsOpen] = useState(isOpen);
  if (previousIsOpen !== isOpen) {
    setPreviousIsOpen(isOpen);
    if (!isOpen) {
      setError(null);
      setIsCreatingConfig(false);
      setSearchValue("");
    }
  }
  const projectIds = new Set(
    projectAnnotationConfigs.map((config) => config.id)
  );
  const normalizedSearch = searchValue.trim().toLocaleLowerCase();
  const canCreateFromSearch = normalizedSearch.length >= 3;
  const matchesSearch = (config: AnnotationConfig) =>
    config.name.toLocaleLowerCase().includes(normalizedSearch);
  const activeConfigs = projectAnnotationConfigs.filter(matchesSearch);
  const inactiveConfigs = allAnnotationConfigs.filter(
    (config) => !projectIds.has(config.id) && matchesSearch(config)
  );
  const projectSectionTitle = `Used by ${truncate(projectName, {
    length: PROJECT_NAME_SECTION_TITLE_MAX_LENGTH,
  })}`;
  const openConfigCreator = () => {
    setError(null);
    setConfigDraft(
      getNewAnnotationConfigDraft({
        name: searchValue.trim(),
      })
    );
    setIsCreatingConfig(true);
  };
  const closeConfigCreator = () => {
    setError(null);
    setIsCreatingConfig(false);
  };
  useDismissPopoverOnEscape({
    isOpen: isOpen && isCreatingConfig,
    onDismiss: closeConfigCreator,
  });

  return (
    <>
      <Dialog
        aria-label={
          isCreatingConfig
            ? "Add annotation configuration"
            : "Manage project annotations"
        }
      >
        {error && !isCreatingConfig ? (
          <View padding="size-100">
            <Alert variant="danger">{error}</Alert>
          </View>
        ) : null}
        {isCreatingConfig ? (
          <AnnotationConfigEditor
            draft={configDraft}
            error={error}
            mode="create"
            onDraftChange={setConfigDraft}
            onCancel={closeConfigCreator}
            onSave={async () => {
              setError(null);
              const result = await onCreateAnnotationConfig(
                getAnnotationConfigFromDraft({ draft: configDraft })
              );
              if (isMutationFailure(result)) {
                setError(result.error);
                return;
              }
              setSearchValue("");
              closeConfigCreator();
            }}
          />
        ) : (
          <>
            <MenuHeader>
              <MenuHeaderTitle
                trailingContent={
                  <LinkButton
                    size="S"
                    variant="quiet"
                    to="/settings/annotations"
                  >
                    Manage
                  </LinkButton>
                }
              >
                Project annotations
              </MenuHeaderTitle>
              <SearchField
                aria-label="Filter annotations"
                value={searchValue}
                onChange={setSearchValue}
                variant="quiet"
                autoFocus
              >
                <SearchIcon />
                <Input placeholder="Filter annotations" />
              </SearchField>
            </MenuHeader>
            <Menu
              css={projectAnnotationsMenuCSS}
              aria-label="Project annotations"
              shouldCloseOnSelect={false}
              renderEmptyState={() => (
                <EmptyState
                  graphic={<EmptyStateGraphic variant="annotation" />}
                  description={
                    normalizedSearch
                      ? "No matching annotations"
                      : "No annotation configurations"
                  }
                  action={
                    canCreateFromSearch
                      ? {
                          type: "strip",
                          items: [
                            {
                              kind: "button",
                              variant: "primary",
                              children: `Create “${searchValue.trim()}”`,
                              onPress: openConfigCreator,
                            },
                          ],
                        }
                      : undefined
                  }
                />
              )}
            >
              {activeConfigs.length > 0 ? (
                <MenuSection>
                  <MenuSectionTitle title={projectSectionTitle} />
                  {activeConfigs.map((config) => (
                    <AnnotationConfigMenuItem
                      key={`remove-${config.id}`}
                      action="remove"
                      config={config}
                      onAction={() => setPendingRemoval(config)}
                    />
                  ))}
                </MenuSection>
              ) : null}
              {inactiveConfigs.length > 0 ? (
                <MenuSection>
                  {activeConfigs.length > 0 ? (
                    <MenuSectionTitle title="Available in Phoenix" />
                  ) : null}
                  {inactiveConfigs.map((config) => (
                    <AnnotationConfigMenuItem
                      key={`add-${config.id}`}
                      action="add"
                      config={config}
                      onAction={async () => {
                        setError(null);
                        if (!config.id) {
                          setError(
                            "The annotation configuration does not have an ID."
                          );
                          return;
                        }
                        const result = await onAddAnnotationConfigToProject(
                          config.id
                        );
                        if (isMutationFailure(result)) {
                          setError(result.error);
                        }
                      }}
                    />
                  ))}
                </MenuSection>
              ) : null}
            </Menu>
            <MenuFooter>
              <Button size="S" variant="quiet" onPress={openConfigCreator}>
                New annotation config
              </Button>
            </MenuFooter>
          </>
        )}
      </Dialog>
      <ModalOverlay
        isOpen={pendingRemoval != null}
        isDismissable={false}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setPendingRemoval(null);
            onOpenChange(true);
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
                  onOpenChange(true);
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
                    onOpenChange(true);
                    return;
                  }
                  const result = await onRemoveAnnotationConfigFromProject(
                    pendingRemoval.id
                  );
                  if (isMutationFailure(result)) {
                    setError(result.error);
                  }
                  setPendingRemoval(null);
                  onOpenChange(true);
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

function AnnotationConfigMenuItem({
  action,
  config,
  onAction,
}: {
  action: "add" | "remove";
  config: AnnotationConfig;
  onAction: () => void | Promise<void>;
}) {
  return (
    <MenuItem
      id={`${action}-${config.id}`}
      textValue={config.name}
      trailingContent={
        <Text size="XS" color="text-500">
          {action === "add" ? "Add" : "Remove"}
        </Text>
      }
      onAction={() => void onAction()}
    >
      <Truncate maxWidth="250px" title={config.name}>
        {config.name}
      </Truncate>
    </MenuItem>
  );
}
