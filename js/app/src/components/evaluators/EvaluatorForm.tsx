import { css } from "@emotion/react";
import type { PropsWithChildren, ReactNode } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Group, Panel, Separator } from "react-resizable-panels";

import { EvaluatorPlaygroundProvider } from "@phoenix/components/evaluators/EvaluatorPlaygroundProvider";
import { compactResizeHandleCSS } from "@phoenix/components/resize";
import type { fetchPlaygroundPrompt_promptVersionToInstance_promptVersion$key } from "@phoenix/pages/playground/__generated__/fetchPlaygroundPrompt_promptVersionToInstance_promptVersion.graphql";
import { DEFAULT_STORE_VALUES } from "@phoenix/store/evaluatorStore";
import type {
  ClassificationEvaluatorAnnotationConfig,
  EvaluatorInputMapping as EvaluatorInputMappingType,
  EvaluatorKind,
} from "@phoenix/types";

export type EvaluatorFormValues = {
  evaluator: {
    name: string;
    kind: EvaluatorKind;
    description: string;
    isBuiltin?: boolean | null;
    builtInEvaluatorName?: string | null;
    includeExplanation?: boolean;
  };
  outputConfigs?: ClassificationEvaluatorAnnotationConfig[];
  // TODO: this makes very little sense in react hook form state, but will make more sense when we move to zustand
  dataset?: {
    readonly: boolean;
    id: string;
  };
  inputMapping: EvaluatorInputMappingType;
};

/**
 * Create a react-hook-form instance for all non-chat-template values the evaluator form.
 * @param defaultValues - The default values for the form. Useful for editing an existing evaluator.
 * @returns A react-hook-form instance for the evaluator form.
 */
export const useEvaluatorForm = (
  defaultValues?: Partial<EvaluatorFormValues>
) => {
  const form = useForm<EvaluatorFormValues>({
    defaultValues: { ...DEFAULT_STORE_VALUES, ...defaultValues },
    mode: "onChange",
  });

  return form;
};

export type EvaluatorFormController = ReturnType<typeof useEvaluatorForm>;

/**
 * Provide the given react-hook-form instance for the evaluator form and new
 * default playground state for the evaluator chat template.
 *
 * @param props.children - The children to render.
 * @param props.form - The react-hook-form instance for the evaluator form.
 */
export const EvaluatorFormProvider = ({
  children,
  form,
  promptId,
  promptName,
  promptVersionRef,
  promptVersionTag,
}: PropsWithChildren<{
  form: EvaluatorFormController;
  promptId?: string;
  promptName?: string;
  promptVersionRef?: fetchPlaygroundPrompt_promptVersionToInstance_promptVersion$key;
  promptVersionTag?: string;
}>) => {
  return (
    <EvaluatorPlaygroundProvider
      promptId={promptId}
      promptName={promptName}
      promptVersionRef={promptVersionRef}
      promptVersionTag={promptVersionTag}
    >
      <FormProvider {...form}>{children}</FormProvider>
    </EvaluatorPlaygroundProvider>
  );
};

/**
 * The two-panel resizable layout for configuring evaluators. Callers provide
 * the content of each panel.
 *
 * `leftDock` pins a region to the bottom of the left panel. The panel then
 * splits into a scrolling region for `left` and a fixed footer for the dock,
 * so the dock stays in view however far the configuration above it scrolls.
 *
 * @example
 * ```tsx
 * <EvaluatorForm
 *   left={<LLMEvaluatorForm />}
 *   right={<EvaluatorDatasetTestPanel />}
 * />
 * ```
 */
export const EvaluatorForm = ({
  left,
  leftDock,
  right,
}: {
  /**
   * The content of the left (configuration) panel.
   */
  left: ReactNode;
  /**
   * Pinned to the bottom of the left panel, outside its scroll region.
   */
  leftDock?: ReactNode;
  /**
   * The content of the right (test) panel.
   */
  right: ReactNode;
}) => {
  return (
    <Group orientation="horizontal" style={{ flex: 1, minHeight: 0 }}>
      {leftDock != null ? (
        <Panel defaultSize={50} style={dockedPanelStyle} css={dockedLeftCSS}>
          <div className="evaluator-form__left-scroll">{left}</div>
          <div className="evaluator-form__left-dock">{leftDock}</div>
        </Panel>
      ) : (
        <Panel defaultSize={50} style={panelStyle} css={leftCSS}>
          {left}
        </Panel>
      )}
      <Separator css={compactResizeHandleCSS} />
      <Panel
        defaultSize={50}
        style={panelStyle}
        css={css`
          display: flex;
          flex-direction: column;
          gap: var(--global-dimension-size-200);
          padding: var(--global-dimension-size-100) 0;
          box-sizing: border-box;
        `}
      >
        {right}
      </Panel>
    </Group>
  );
};

const leftCSS = css`
  display: flex;
  flex-direction: column;
  padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
  padding-bottom: var(--global-dimension-size-600);
  box-sizing: border-box;
`;

const dockedLeftCSS = css`
  display: flex;
  flex-direction: column;
  min-height: 0;
  .evaluator-form__left-scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
    padding: var(--global-dimension-size-100) var(--global-dimension-size-200)
      var(--global-dimension-size-300);
    box-sizing: border-box;
  }
  .evaluator-form__left-dock {
    flex: none;
    display: flex;
    flex-direction: column;
    min-height: 0;
    // The dock grows with its content up to half the panel, then its own
    // body scrolls; the configuration above always keeps the other half.
    max-height: 50%;
    border-top: 1px solid var(--global-border-color-default);
    background-color: var(--global-background-color-default);
  }
`;

const panelStyle = {
  height: "100%",
  overflowY: "auto",
  // keep trackpad overscroll from chaining to the dialog and
  // dragging the header/footer with it
  overscrollBehavior: "contain",
} as const;

/** The docked variant scrolls its own region, not the panel. */
const dockedPanelStyle = {
  height: "100%",
  overflow: "hidden",
} as const;
