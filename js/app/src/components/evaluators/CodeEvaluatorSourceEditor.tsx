import { startCompletion } from "@codemirror/autocomplete";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { indentUnit } from "@codemirror/language";
import { css } from "@emotion/react";
import CodeMirror, {
  type BasicSetupOptions,
  type EditorView,
} from "@uiw/react-codemirror";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";

import {
  Button,
  CopyToClipboardButton,
  Flex,
  Icon,
  Icons,
  Switch,
  Text,
} from "@phoenix/components";
import { pierreDark, pierreLight } from "@phoenix/components/code";
import {
  Menu,
  MenuContainer,
  MenuItem,
  MenuTrigger,
} from "@phoenix/components/core/menu";
import { createEvaluatorAutocompletion } from "@phoenix/components/evaluators/codeEvaluatorAutocomplete";
import { CODE_EVALUATOR_TEMPLATES } from "@phoenix/components/evaluators/codeEvaluatorTemplates";
import { generateEvaluatorTypes } from "@phoenix/components/evaluators/codeEvaluatorTypeGeneration";
import { getDefaultCodeEvaluatorSource } from "@phoenix/components/evaluators/codeEvaluatorUtils";
import { materializeEvaluatorContext } from "@phoenix/components/evaluators/evaluatorContext";
import { compactResizeHandleCSS } from "@phoenix/components/resize";
import { useTheme } from "@phoenix/contexts";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";
import type { CodeEvaluatorLanguage } from "@phoenix/types";
import { isStringKeyedObject } from "@phoenix/typeUtils";

/**
 * Editable source-code editor with a read-only auto-generated type footer.
 * Ships its own description line and Reset-to-default button.
 */
export const CodeEvaluatorSourceEditor = ({
  language,
  sourceCode,
  onChange,
  hideDescription = false,
}: {
  hideDescription?: boolean;
  language: CodeEvaluatorLanguage;
  sourceCode: string;
  onChange: (value: string) => void;
}) => {
  const { theme } = useTheme();
  // CodeMirror reconfigures the whole editor whenever its onChange identity
  // changes, so hand it a stable callback that forwards to the latest prop.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  const handleChange = useCallback(
    (value: string) => onChangeRef.current(value),
    []
  );
  const codeMirrorTheme = theme === "light" ? pierreLight : pierreDark;
  // The auto-generated type footer is hidden by default.
  const [showTypes, setShowTypes] = useState(false);

  const evaluatorMappingSourceState = useEvaluatorStore(
    (state) => state.evaluatorMappingSource
  );
  const inputMapping = useEvaluatorStore(
    (state) => state.evaluator.inputMapping
  );
  const evaluatorMappingSource = evaluatorMappingSourceState.source;
  const evaluationContext = useMemo(() => {
    const grain = evaluatorMappingSourceState.grain;
    return grain === "dataset"
      ? null
      : materializeEvaluatorContext({
          grain,
          evaluatorMappingSource: evaluatorMappingSourceState,
          inputMapping,
        });
  }, [evaluatorMappingSourceState, inputMapping]);

  // The footer names what `evaluate` receives, so for a project grain it reads
  // the mapping applied rather than the record as it arrived — the same
  // context the autocomplete offers from. A dataset example is bound by name
  // and has no such gap.
  const typeFooter = useMemo(
    () =>
      generateEvaluatorTypes(
        language,
        evaluationContext === null
          ? evaluatorMappingSource
          : {
              input: evaluationContext.values.input,
              output: evaluationContext.values.output,
              metadata: isStringKeyedObject(evaluationContext.values.metadata)
                ? evaluationContext.values.metadata
                : {},
            }
      ),
    [language, evaluatorMappingSource, evaluationContext]
  );

  const extensions = useMemo(
    () => [
      language === "PYTHON" ? python() : javascript({ typescript: true }),
      // Python: 4-space indent; JS/TS: 2-space.
      indentUnit.of(language === "PYTHON" ? "    " : "  "),
      createEvaluatorAutocompletion({
        mappingSource: evaluatorMappingSource,
        language,
        evaluationContext,
      }),
    ],
    [language, evaluatorMappingSource, evaluationContext]
  );

  // The sampled record can arrive after the user has already put the cursor
  // in a completable position — the reconfigure it causes discards any open
  // dropdown, so re-open it, the same way DSLFilterConditionField does. The
  // source offers nothing outside those positions, so this is inert
  // elsewhere in the source code.
  const editorViewRef = useRef<EditorView | null>(null);
  useEffect(() => {
    const editorView = editorViewRef.current;
    if (editorView?.hasFocus) {
      startCompletion(editorView);
    }
  }, [extensions]);

  const descriptionText =
    "Define an evaluate function that returns a score or label.";

  return (
    <Flex direction="column" gap="size-100">
      {/* Editor header with controls */}
      <Flex
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        gap="size-200"
        flex="none"
      >
        {hideDescription ? null : (
          <Text color="text-500" size="XS">
            {descriptionText}
          </Text>
        )}
        <Flex direction="row" alignItems="center" gap="size-100" flex="none">
          <MenuTrigger>
            <Button
              size="S"
              variant="quiet"
              leadingVisual={<Icon svg={<Icons.Code />} />}
            >
              Templates
            </Button>
            <MenuContainer placement="bottom end" maxWidth={360}>
              <Menu
                onAction={(key) => {
                  const template = CODE_EVALUATOR_TEMPLATES.find(
                    (t) => t.id === key
                  );
                  if (!template) {
                    return;
                  }
                  onChange(template.getSource(language));
                }}
              >
                {CODE_EVALUATOR_TEMPLATES.map((template) => (
                  <MenuItem
                    key={template.id}
                    id={template.id}
                    textValue={`${template.name}\n${template.description}`}
                  >
                    <Flex direction="column" gap="size-50">
                      <Text weight="heavy">{template.name}</Text>
                      <Text size="S" color="text-700">
                        {template.description}
                      </Text>
                    </Flex>
                  </MenuItem>
                ))}
              </Menu>
            </MenuContainer>
          </MenuTrigger>
          <Button
            size="S"
            variant="quiet"
            leadingVisual={<Icon svg={<Icons.Refresh />} />}
            onPress={() =>
              onChange(
                getDefaultCodeEvaluatorSource(
                  language,
                  evaluatorMappingSourceState.grain
                )
              )
            }
          >
            Reset
          </Button>
          <CopyToClipboardButton
            text={sourceCode}
            size="S"
            variant="quiet"
            tooltipText="Copy code"
          >
            Copy
          </CopyToClipboardButton>
          {typeFooter ? (
            <Switch
              isSelected={showTypes}
              onChange={setShowTypes}
              labelPlacement="start"
            >
              <Text size="S">Show types</Text>
            </Switch>
          ) : null}
        </Flex>
      </Flex>

      {/* Code editor and type footer with resizable panels */}
      <div css={editorContainerCSS}>
        <Group orientation="vertical" style={{ flex: 1, minHeight: 0 }}>
          {/* Editable code editor panel */}
          <Panel defaultSize="75%" minSize="30%" style={editorPanelStyle}>
            <div
              css={[editorWrapCSS, cmLineNumberGutterCSS]}
              onKeyDown={(e) => {
                if (e.key === "Escape" || e.key === "Tab") {
                  e.stopPropagation();
                }
              }}
            >
              <CodeMirror
                // Key on language to force remount when language changes
                key={language}
                value={sourceCode}
                onChange={handleChange}
                theme={codeMirrorTheme}
                extensions={extensions}
                onCreateEditor={(editorView) => {
                  editorViewRef.current = editorView;
                }}
                height="100%"
                indentWithTab
                basicSetup={BASIC_SETUP_BY_LANGUAGE[language]}
              />
            </div>
          </Panel>

          {/* Read-only type footer panel */}
          {showTypes && typeFooter && (
            <>
              <Separator css={compactResizeHandleCSS} />
              <Panel defaultSize="25%" minSize="10%" style={editorPanelStyle}>
                <div css={[typeFooterCSS, cmLineNumberGutterCSS]}>
                  <CodeMirror
                    value={typeFooter}
                    theme={codeMirrorTheme}
                    extensions={extensions}
                    editable={false}
                    basicSetup={BASIC_SETUP_BY_LANGUAGE[language]}
                  />
                </div>
              </Panel>
            </>
          )}
        </Group>
      </div>
    </Flex>
  );
};

const BASE_BASIC_SETUP = {
  lineNumbers: true,
  foldGutter: true,
  bracketMatching: true,
  syntaxHighlighting: true,
  highlightActiveLine: false,
  highlightActiveLineGutter: false,
} satisfies BasicSetupOptions;

/** Module-level so CodeMirror does not reconfigure on every render. */
const BASIC_SETUP_BY_LANGUAGE: Record<
  CodeEvaluatorLanguage,
  BasicSetupOptions
> = {
  PYTHON: { ...BASE_BASIC_SETUP, tabSize: 4 },
  TYPESCRIPT: { ...BASE_BASIC_SETUP, tabSize: 2 },
};

const editorContainerCSS = css`
  display: flex;
  flex-direction: column;
  min-height: 500px;
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  overflow: hidden;
  background-color: var(--code-mirror-editor-background-color);
`;

const editorPanelStyle = {
  display: "flex",
  flexDirection: "column" as const,
  minHeight: 0,
  overflow: "hidden" as const,
};

const cmLineNumberGutterCSS = css`
  & .cm-gutter.cm-lineNumbers .cm-gutterElement {
    min-width: 2.25em;
    box-sizing: border-box;
  }
`;

const editorWrapCSS = css`
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  & .cm-theme {
    height: 100% !important;
  }

  & .cm-editor {
    height: 100% !important;
  }

  & .cm-scroller {
    overflow: auto !important;
  }
`;

const typeFooterCSS = css`
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  & .cm-theme {
    height: 100% !important;
  }

  & .cm-editor {
    height: 100% !important;
    background-color: var(--global-color-gray-100);
  }

  & .cm-gutters {
    background-color: var(--global-color-gray-100);
  }

  & .cm-scroller {
    overflow: auto !important;
  }
`;
