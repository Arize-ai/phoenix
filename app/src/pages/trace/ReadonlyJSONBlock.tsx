import { json } from "@codemirror/lang-json";
import { css } from "@emotion/react";
import type { BasicSetupOptions } from "@uiw/react-codemirror";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { useMemo } from "react";

import { pierreDark, pierreLight } from "@phoenix/components/code";
import { LazyEditorWrapper } from "@phoenix/components/code/LazyEditorWrapper";
import { codeMirrorFallbackContentCSS } from "@phoenix/components/code/styles";
import { useTheme } from "@phoenix/contexts";

const JSON_EDITOR_PRE_INITIALIZATION_MIN_HEIGHT_PIXELS = 120;

const codeMirrorCSS = css`
  width: 100%;
  .cm-editor,
  .cm-gutters {
    background-color: transparent;
  }
`;

const jsonEditorFallbackCSS = css`
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: ${JSON_EDITOR_PRE_INITIALIZATION_MIN_HEIGHT_PIXELS}px;
  font-family: var(--global-font-family-mono);
  font-size: var(--global-font-size-s);
  line-height: 1.4;
`;

const jsonEditorFallbackGutterCSS = css`
  flex: none;
  background-color: var(--code-mirror-gutters-background-color);
`;

const jsonEditorFallbackFoldGutterCSS = css`
  width: calc(1ch + 3px);
`;

const jsonEditorFallbackPreCSS = css`
  ${codeMirrorFallbackContentCSS}
  flex: 1;
`;

function JSONEditorFallback({
  children,
  basicSetup,
}: {
  children: string;
  basicSetup: BasicSetupOptions;
}) {
  const hasLineNumberGutter = basicSetup.lineNumbers !== false;
  const hasFoldGutter = basicSetup.foldGutter !== false;
  const lineNumberDigitCount = String(children.split("\n").length).length;

  return (
    <div css={jsonEditorFallbackCSS}>
      {hasLineNumberGutter ? (
        <div
          aria-hidden="true"
          css={[
            jsonEditorFallbackGutterCSS,
            css`
              width: max(
                20px,
                calc(
                  ${lineNumberDigitCount}ch + var(--global-dimension-size-100)
                )
              );
            `,
          ]}
        />
      ) : null}
      {hasFoldGutter ? (
        <div
          aria-hidden="true"
          css={[jsonEditorFallbackGutterCSS, jsonEditorFallbackFoldGutterCSS]}
        />
      ) : null}
      <pre data-testid="pre-block" css={jsonEditorFallbackPreCSS}>
        {children}
      </pre>
    </div>
  );
}

export function PreBlock({ children }: { children: string }) {
  return (
    <pre
      data-testid="pre-block"
      css={css`
        white-space: pre-wrap;
        padding: var(--global-dimension-size-200);
        font-size: var(--global-font-size-s);
      `}
    >
      {children}
    </pre>
  );
}

/**
 * A block of JSON content that is not editable.
 */
export function ReadonlyJSONBlock({
  children,
  basicSetup = {},
  initializeImmediately = false,
}: {
  children: string;
  basicSetup?: BasicSetupOptions;
  initializeImmediately?: boolean;
}) {
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "light" ? pierreLight : pierreDark;
  // We need to make sure that the content can actually be displayed
  // As JSON as we cannot fully trust the backend to always send valid JSON
  const { value, mimeType } = useMemo(() => {
    try {
      // Attempt to pretty print the JSON. This may fail if the JSON is invalid.
      // E.g. sometimes it contains NANs due to poor JSON.dumps in the backend
      return {
        value: JSON.stringify(JSON.parse(children), null, 2),
        mimeType: "json" as const,
      };
    } catch (_e) {
      // Fall back to string
      return { value: children, mimeType: "text" as const };
    }
  }, [children]);
  if (mimeType === "json") {
    const resolvedBasicSetup = {
      lineNumbers: true,
      foldGutter: true,
      bracketMatching: true,
      syntaxHighlighting: true,
      highlightActiveLine: false,
      highlightActiveLineGutter: false,
      ...basicSetup,
    } satisfies BasicSetupOptions;

    return (
      <LazyEditorWrapper
        preInitializationMinHeight={
          JSON_EDITOR_PRE_INITIALIZATION_MIN_HEIGHT_PIXELS
        }
        fallback={
          <JSONEditorFallback basicSetup={resolvedBasicSetup}>
            {value}
          </JSONEditorFallback>
        }
        initializeImmediately={initializeImmediately}
      >
        <CodeMirror
          value={value}
          basicSetup={resolvedBasicSetup}
          extensions={[json(), EditorView.lineWrapping]}
          editable={false}
          theme={codeMirrorTheme}
          css={codeMirrorCSS}
        />
      </LazyEditorWrapper>
    );
  } else {
    return <PreBlock>{value}</PreBlock>;
  }
}
