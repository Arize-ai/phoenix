import { useMemo } from "react";
import { json } from "@codemirror/lang-json";
import { githubDark, githubLight } from "@uiw/codemirror-theme-github";
import CodeMirror, {
  BasicSetupOptions,
  EditorView,
} from "@uiw/react-codemirror";
import { css } from "@emotion/react";

import { useTheme } from "@phoenix/contexts";

const codeMirrorCSS = css`
  width: 100%;
  .cm-editor,
  .cm-gutters {
    background-color: transparent;
  }
`;

export function PreBlock({ children }: { children: string }) {
  return (
    <pre
      data-testid="pre-block"
      css={css`
        white-space: pre-wrap;
        padding: var(--ac-global-dimension-static-size-200);
        font-size: var(--ac-global-font-size-s);
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
}: {
  children: string;
  basicSetup?: BasicSetupOptions;
}) {
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "light" ? githubLight : githubDark;
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
    return (
      <CodeMirror
        value={value}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          bracketMatching: true,
          syntaxHighlighting: true,
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
          ...basicSetup,
        }}
        extensions={[json(), EditorView.lineWrapping]}
        editable={false}
        theme={codeMirrorTheme}
        css={codeMirrorCSS}
      />
    );
  } else {
    return <PreBlock>{value}</PreBlock>;
  }
}
