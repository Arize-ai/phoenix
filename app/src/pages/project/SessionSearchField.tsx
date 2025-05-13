import { useState } from "react";
import { githubDark, githubLight } from "@uiw/codemirror-theme-github";
import CodeMirror from "@uiw/react-codemirror";
import { css } from "@emotion/react";

import { AddonBefore } from "@arizeai/components";

import { Flex, Icon, Icons } from "@phoenix/components";
import { useTheme } from "@phoenix/contexts";

import { useSessionSearchContext } from "./SessionSearchContext";
const codeMirrorCSS = css`
  flex: 1 1 auto;
  .cm-content {
    padding: var(--ac-global-dimension-static-size-100) 0;
  }
  .cm-editor {
    background-color: transparent !important;
  }
  .cm-focused {
    outline: none;
  }
  .cm-selectionLayer .cm-selectionBackground {
    background: var(--ac-global-color-cyan-400) !important;
  }
`;

const fieldCSS = css`
  border-width: var(--ac-global-border-size-thin);
  border-style: solid;
  border-color: var(--ac-global-input-field-border-color);
  border-radius: var(--ac-global-rounding-small);
  background-color: var(--ac-global-input-field-background-color);
  transition: all 0.2s ease-in-out;
  overflow-x: hidden;
  &:hover,
  &[data-is-focused="true"] {
    border-color: var(--ac-global-input-field-border-color-active);
    background-color: var(--ac-global-input-field-background-color-active);
  }
  &[data-is-invalid="true"] {
    border-color: var(--ac-global-color-danger);
  }
  box-sizing: border-box;
`;

type SessionsSubstringFieldProps = {
  placeholder?: string;
};
export function SessionSearchField(props: SessionsSubstringFieldProps) {
  const { placeholder = "Search messages" } = props;
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const { filterIoSubstring, setFilterIoSubstring } = useSessionSearchContext();
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "light" ? githubLight : githubDark;

  const hasSubstring = filterIoSubstring !== "";
  return (
    <div
      data-is-focused={isFocused}
      className="sessions-substring-field"
      css={fieldCSS}
    >
      <Flex direction="row">
        <AddonBefore>
          <Icon svg={<Icons.Search />} />
        </AddonBefore>
        <CodeMirror
          css={codeMirrorCSS}
          indentWithTab={false}
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            bracketMatching: false,
            syntaxHighlighting: false,
            highlightActiveLine: false,
            highlightActiveLineGutter: false,
            defaultKeymap: false,
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          value={filterIoSubstring}
          onChange={setFilterIoSubstring}
          height="36px"
          width="100%"
          theme={codeMirrorTheme}
          placeholder={placeholder}
        />
        <button
          css={css`
            margin-right: var(--ac-global-dimension-static-size-100);
            color: var(--ac-global-text-color-700);
            visibility: ${hasSubstring ? "visible" : "hidden"};
          `}
          onClick={() => setFilterIoSubstring("")}
          className="button--reset"
        >
          <Icon svg={<Icons.CloseCircleOutline />} />
        </button>
      </Flex>
    </div>
  );
}
