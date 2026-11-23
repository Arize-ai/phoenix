import { css } from "@emotion/react";
import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Button as AriaButton } from "react-aria-components";
import {
  Group,
  Panel,
  useDefaultLayout,
  usePanelRef,
} from "react-resizable-panels";

import { Icon, Icons } from "@phoenix/components/core/icon";
import { Tab, TabList, TabPanel, Tabs } from "@phoenix/components/core/tabs";
import {
  GRIP_RESIZE_TARGET_MINIMUM_SIZE,
  GripResizeHandle,
} from "@phoenix/components/resize";

/** One tab of the definition: a part of what the evaluator is. */
export type EvaluatorFormSection = {
  id: string;
  title: string;
  content: ReactNode;
};

/** The input mapping, docked under the definition. */
type EvaluatorFormInputs = {
  title: string;
  /** Shown after the title, e.g. how many variables have nothing to read. */
  badge?: ReactNode;
  content: ReactNode;
};

const ExpandInputsContext = createContext<(() => void) | null>(null);

/**
 * Opens the input mapping panel when `condition` turns true, e.g. when a
 * variable stops having anything to read, so a collapsed panel never hides
 * what blocks a save. Call it from the panel's content.
 */
export function useExpandInputsWhen(condition: boolean) {
  const expand = useContext(ExpandInputsContext);
  const previousCondition = useRef(condition);
  useEffect(() => {
    if (condition && !previousCondition.current) {
      expand?.();
    }
    previousCondition.current = condition;
  }, [condition, expand]);
}

export type EvaluatorFormLayoutProps = {
  /**
   * Names the stored panel sizes. Forms that share a layout id share sizes,
   * so each kind of form has its own.
   */
  layoutId: string;
  /** Pinned above the definition: the name and description. */
  identity?: ReactNode;
  /**
   * The definition, one tab per section. A single section shows without a
   * tab list.
   */
  sections: readonly EvaluatorFormSection[];
  inputs?: EvaluatorFormInputs;
  /** The right side: runs the evaluator against real records or examples. */
  tryIt: ReactNode;
};

/**
 * Shows the first invalid field of an evaluator form: it selects the tab or
 * expands the panel that holds the field, then focuses it. The form's
 * dialog calls this after a submit, since the field may sit in a tab that
 * is not selected.
 */
type RevealInvalidField = () => void;

const RevealInvalidFieldContext = createContext<{
  current: RevealInvalidField | null;
} | null>(null);

/**
 * Lets the dialog around an {@link EvaluatorFormLayout} reveal its first
 * invalid field; see {@link useRevealInvalidField}.
 */
export function RevealInvalidFieldProvider({
  children,
}: {
  children: ReactNode;
}) {
  const revealRef = useRef<RevealInvalidField | null>(null);
  return (
    <RevealInvalidFieldContext.Provider value={revealRef}>
      {children}
    </RevealInvalidFieldContext.Provider>
  );
}

/** Reveals the first invalid field of the form within the provider. */
export function useRevealInvalidField(): RevealInvalidField {
  const revealRef = useContext(RevealInvalidFieldContext);
  return useCallback(() => revealRef?.current?.(), [revealRef]);
}

const INVALID_FIELD_SELECTOR = '[aria-invalid="true"]';

/**
 * The frame every evaluator form is laid out in. On the left, the
 * definition: the name and description pinned at the top, the evaluator's
 * sections as tabs, and the input mapping docked under them. On the right,
 * a place to try the evaluator against real data. The divider between the
 * two, and the one above the mapping, are dragged to resize; the mapping
 * collapses to its header. Sizes are remembered per kind of form, and a
 * double-click on a divider puts it back.
 */
export function EvaluatorFormLayout({
  layoutId,
  identity,
  sections,
  inputs,
  tryIt,
}: EvaluatorFormLayoutProps) {
  const columns = useDefaultLayout({
    id: `evaluator-form-${layoutId}`,
    storage: localStorage,
  });
  const definitionRows = useDefaultLayout({
    id: `evaluator-form-${layoutId}-definition`,
    storage: localStorage,
  });
  const [selectedSectionId, setSelectedSectionId] = useState(
    sections[0]?.id ?? ""
  );
  const formRef = useRef<HTMLDivElement>(null);
  const identityRef = useRef<HTMLDivElement>(null);
  const inputsBodyRef = useRef<HTMLDivElement>(null);
  const inputsPanelRef = usePanelRef();
  // The mapping collapses from its header and by dragging, so follow the
  // panel's size rather than the header's presses.
  const [isInputsCollapsed, setIsInputsCollapsed] = useState(false);
  const sectionPanelRefs = useRef(new Map<string, HTMLElement>());
  const invalidSectionIds = useInvalidSectionIds({
    formRef,
    sectionPanelRefs,
  });

  const revealRef = useContext(RevealInvalidFieldContext);
  useLayoutEffect(() => {
    if (revealRef == null) {
      return undefined;
    }
    revealRef.current = () => {
      // After the validation state has rendered the fields as invalid.
      window.requestAnimationFrame(() => {
        const identityField = identityRef.current?.querySelector<HTMLElement>(
          INVALID_FIELD_SELECTOR
        );
        if (identityField != null) {
          focusOnceShown(identityField);
          return;
        }
        for (const section of sections) {
          const field = sectionPanelRefs.current
            .get(section.id)
            ?.querySelector<HTMLElement>(INVALID_FIELD_SELECTOR);
          if (field != null) {
            setSelectedSectionId(section.id);
            focusOnceShown(field);
            return;
          }
        }
        const inputsField = inputsBodyRef.current?.querySelector<HTMLElement>(
          INVALID_FIELD_SELECTOR
        );
        if (inputsField != null) {
          inputsPanelRef.current?.expand();
          focusOnceShown(inputsField);
        }
      });
    };
    return () => {
      revealRef.current = null;
    };
  }, [revealRef, sections, inputsPanelRef]);

  return (
    <div ref={formRef} css={layoutCSS}>
      <Group
        orientation="horizontal"
        className="evaluator-form__columns"
        defaultLayout={columns.defaultLayout}
        onLayoutChanged={columns.onLayoutChanged}
        resizeTargetMinimumSize={GRIP_RESIZE_TARGET_MINIMUM_SIZE}
      >
        <Panel
          id="definition"
          defaultSize="46%"
          minSize={DEFINITION_MIN_SIZE}
          className="evaluator-form__column"
        >
          {identity != null ? (
            <div ref={identityRef} className="evaluator-form__identity">
              {identity}
            </div>
          ) : null}
          <Group
            orientation="vertical"
            className="evaluator-form__rows"
            defaultLayout={definitionRows.defaultLayout}
            onLayoutChanged={definitionRows.onLayoutChanged}
            resizeTargetMinimumSize={GRIP_RESIZE_TARGET_MINIMUM_SIZE}
          >
            <Panel
              id="sections"
              minSize={SECTIONS_MIN_SIZE}
              className="evaluator-form__column"
            >
              <EvaluatorFormSections
                sections={sections}
                selectedSectionId={selectedSectionId}
                onSelectedSectionIdChange={setSelectedSectionId}
                invalidSectionIds={invalidSectionIds}
                sectionPanelRefs={sectionPanelRefs}
              />
            </Panel>
            {inputs != null ? (
              <>
                <GripResizeHandle />
                <Panel
                  id="inputs"
                  defaultSize="34%"
                  minSize={INPUTS_MIN_SIZE}
                  collapsible
                  collapsedSize={INPUTS_HEADER_HEIGHT}
                  panelRef={inputsPanelRef}
                  onResize={() =>
                    setIsInputsCollapsed(
                      inputsPanelRef.current?.isCollapsed() ?? false
                    )
                  }
                  className="evaluator-form__column"
                >
                  <EvaluatorFormInputsPanel
                    inputs={inputs}
                    panelRef={inputsPanelRef}
                    bodyRef={inputsBodyRef}
                    isCollapsed={isInputsCollapsed}
                  />
                </Panel>
              </>
            ) : null}
          </Group>
        </Panel>
        <GripResizeHandle />
        <Panel
          id="try-it"
          minSize={TRY_IT_MIN_SIZE}
          className="evaluator-form__column evaluator-form__try-it"
        >
          {tryIt}
        </Panel>
      </Group>
    </div>
  );
}

/**
 * Which sections hold a field that is invalid right now. Fields mark
 * themselves with `aria-invalid`, so this follows that attribute anywhere
 * in the form, whether a submit or an edit changed it.
 */
function useInvalidSectionIds({
  formRef,
  sectionPanelRefs,
}: {
  formRef: React.RefObject<HTMLDivElement | null>;
  sectionPanelRefs: React.RefObject<Map<string, HTMLElement>>;
}): ReadonlySet<string> {
  const [invalidSectionIds, setInvalidSectionIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  useEffect(() => {
    const form = formRef.current;
    if (form == null) {
      return undefined;
    }
    const update = () => {
      const next = new Set<string>();
      sectionPanelRefs.current.forEach((panel, sectionId) => {
        if (panel.querySelector(INVALID_FIELD_SELECTOR) != null) {
          next.add(sectionId);
        }
      });
      setInvalidSectionIds((current) =>
        current.size === next.size && [...next].every((id) => current.has(id))
          ? current
          : next
      );
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(form, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["aria-invalid"],
    });
    return () => observer.disconnect();
  }, [formRef, sectionPanelRefs]);
  return invalidSectionIds;
}

function EvaluatorFormSections({
  sections,
  selectedSectionId,
  onSelectedSectionIdChange,
  invalidSectionIds,
  sectionPanelRefs,
}: {
  sections: readonly EvaluatorFormSection[];
  selectedSectionId: string;
  onSelectedSectionIdChange: (sectionId: string) => void;
  invalidSectionIds: ReadonlySet<string>;
  sectionPanelRefs: React.RefObject<Map<string, HTMLElement>>;
}) {
  const registerPanel =
    (sectionId: string) => (element: HTMLElement | null) => {
      if (element == null) {
        sectionPanelRefs.current.delete(sectionId);
      } else {
        sectionPanelRefs.current.set(sectionId, element);
      }
    };
  if (sections.length === 1) {
    const [section] = sections;
    return (
      <div
        ref={registerPanel(section.id)}
        className="evaluator-form__section"
        aria-label={section.title}
        role="region"
      >
        {section.content}
      </div>
    );
  }
  return (
    <Tabs
      selectedKey={selectedSectionId}
      onSelectionChange={(key) => onSelectedSectionIdChange(String(key))}
      css={sectionTabsCSS}
    >
      <TabList aria-label="Evaluator definition">
        {sections.map((section) => (
          <Tab key={section.id} id={section.id}>
            {section.title}
            {invalidSectionIds.has(section.id) ? (
              <Icon
                svg={<Icons.AlertCircleFilled />}
                color="danger"
                role="img"
                aria-label="Has errors"
              />
            ) : null}
          </Tab>
        ))}
      </TabList>
      {sections.map((section) => (
        // Every section stays mounted, so its fields keep their state and
        // their validation while another tab is selected.
        <TabPanel key={section.id} id={section.id} shouldForceMount>
          <div
            ref={registerPanel(section.id)}
            className="evaluator-form__section"
          >
            {section.content}
          </div>
        </TabPanel>
      ))}
    </Tabs>
  );
}

function EvaluatorFormInputsPanel({
  inputs,
  panelRef,
  bodyRef,
  isCollapsed,
}: {
  inputs: EvaluatorFormInputs;
  panelRef: ReturnType<typeof usePanelRef>;
  bodyRef: React.RefObject<HTMLDivElement | null>;
  isCollapsed: boolean;
}) {
  const bodyId = useId();
  const expand = useCallback(() => panelRef.current?.expand(), [panelRef]);
  return (
    <div className="evaluator-form__inputs" data-collapsed={isCollapsed}>
      <AriaButton
        className="evaluator-form__inputs-trigger"
        aria-expanded={!isCollapsed}
        aria-controls={bodyId}
        onPress={() => {
          if (panelRef.current?.isCollapsed()) {
            panelRef.current.expand();
          } else {
            panelRef.current?.collapse();
          }
        }}
      >
        <span className="evaluator-form__inputs-title">{inputs.title}</span>
        {inputs.badge}
        <Icon
          className="evaluator-form__inputs-chevron"
          svg={isCollapsed ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
        />
      </AriaButton>
      <div
        id={bodyId}
        ref={bodyRef}
        className="evaluator-form__inputs-body"
        hidden={isCollapsed}
      >
        <ExpandInputsContext.Provider value={expand}>
          {inputs.content}
        </ExpandInputsContext.Provider>
      </div>
    </div>
  );
}

/**
 * A field in a tab that is not shown yet cannot take focus, so try again
 * each frame until it can (for at most about half a second).
 */
function focusOnceShown(field: HTMLElement, framesLeft = 30) {
  const box = field.getBoundingClientRect();
  if (box.width > 0 && box.height > 0) {
    field.focus();
    if (document.activeElement === field) {
      return;
    }
  }
  if (framesLeft > 0) {
    window.requestAnimationFrame(() => focusOnceShown(field, framesLeft - 1));
  }
}

/**
 * Floors in pixels, so on a laptop neither side can be dragged down to a
 * sliver: the definition keeps room for its two-up fields, the right side
 * for its table's columns.
 */
const DEFINITION_MIN_SIZE = "420px";
const TRY_IT_MIN_SIZE = "480px";
const SECTIONS_MIN_SIZE = "160px";
const INPUTS_MIN_SIZE = "120px";
/** The inputs header's height: what the collapsed panel keeps. */
const INPUTS_HEADER_HEIGHT = "41px";

const layoutCSS = css`
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;

  .evaluator-form__columns,
  .evaluator-form__rows {
    flex: 1 1 auto;
    min-height: 0;
  }
  .evaluator-form__column {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    height: 100%;
    overflow: hidden;
  }
  .evaluator-form__try-it {
    gap: var(--global-dimension-size-200);
    padding: var(--global-dimension-size-100) 0;
    box-sizing: border-box;
  }

  .evaluator-form__identity {
    flex: none;
    padding: var(--global-dimension-size-200) var(--global-dimension-size-200) 0;
  }

  .evaluator-form__section {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    // No bounce at the ends, and no scroll chaining out to the dialog.
    overscroll-behavior: none;
    scrollbar-gutter: stable;
    padding: var(--global-dimension-size-200);
    box-sizing: border-box;
  }

  .evaluator-form__inputs {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .evaluator-form__inputs-trigger {
    all: unset;
    box-sizing: border-box;
    flex: none;
    height: ${INPUTS_HEADER_HEIGHT};
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-100);
    padding: 0 var(--global-dimension-size-200);
    font-size: var(--global-font-size-s);
    font-weight: 600;
    color: var(--global-text-color-900);
    cursor: default;
    box-shadow: inset 0 -1px 0 0 var(--global-border-color-default);
    &[data-hovered] {
      background-color: var(--hover-background);
    }
    &[data-focus-visible] {
      outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
      outline-offset: calc(-1 * var(--focus-ring-thickness));
    }
  }
  .evaluator-form__inputs-chevron {
    margin-inline-start: auto;
    color: var(--global-text-color-700);
  }
  [data-collapsed="true"] > .evaluator-form__inputs-trigger {
    box-shadow: none;
  }
  .evaluator-form__inputs-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: none;
    scrollbar-gutter: stable;
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-200);
    padding: var(--global-dimension-size-200);
    box-sizing: border-box;
  }
  .evaluator-form__inputs-body[hidden] {
    display: none;
  }
`;

const sectionTabsCSS = css`
  flex: 1 1 auto;
  min-height: 0;
  .react-aria-TabPanel {
    min-height: 0;
  }
  // Unselected sections stay mounted (see EvaluatorFormSections) but are
  // not shown.
  .react-aria-TabPanel[data-inert] {
    display: none;
  }
  // The error mark sits beside the label, not under it.
  .react-aria-Tab {
    display: inline-flex;
    align-items: center;
    gap: var(--global-dimension-size-50);
  }
`;
