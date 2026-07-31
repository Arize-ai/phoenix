import { markdown } from "@codemirror/lang-markdown";
import { css } from "@emotion/react";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";

import { LazyEditorWrapper } from "@phoenix/components/code/LazyEditorWrapper";
import {
  pierreDark,
  pierreLight,
} from "@phoenix/components/code/pierreCodeMirrorTheme";
import { codeMirrorFallbackContentCSS } from "@phoenix/components/code/styles";
import { useTheme } from "@phoenix/contexts";

const markdownExtensions = [markdown(), EditorView.lineWrapping];

const markdownSourceCSS = css`
  width: 100%;
  // Opt out of the global CodeMirror surface. Markdown source belongs directly
  // on its containing card rather than introducing a nested editor background.
  --code-mirror-editor-background-color: transparent;
  --code-mirror-gutters-background-color: transparent;

  .cm-editor {
    font-size: var(--global-font-size-s);
  }
`;

const markdownSourceFallbackCSS = css`
  ${codeMirrorFallbackContentCSS}
  width: 100%;
`;

/**
 * Displays raw Markdown source with Pierre-themed syntax highlighting.
 * `MarkdownBlock` mounts this component only for its explicit text mode, so
 * the lightweight fallback can safely mirror the editor that will replace it.
 */
export function MarkdownSourceBlock({ children }: { children: string }) {
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "light" ? pierreLight : pierreDark;

  return (
    <div css={markdownSourceCSS}>
      <LazyEditorWrapper
        preInitializationMinHeight={0}
        fallback={<pre css={markdownSourceFallbackCSS}>{children}</pre>}
      >
        <CodeMirror
          value={children}
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            bracketMatching: false,
            syntaxHighlighting: true,
            highlightActiveLine: false,
            highlightActiveLineGutter: false,
          }}
          extensions={markdownExtensions}
          editable={false}
          theme={codeMirrorTheme}
        />
      </LazyEditorWrapper>
    </div>
  );
}
