import React, { useState } from "react";
import { python } from "@codemirror/lang-python";
import { nord } from "@uiw/codemirror-theme-nord";
import CodeMirror from "@uiw/react-codemirror";
import { fetchQuery, graphql } from "relay-runtime";
import { css } from "@emotion/react";

import { AddonBefore, Flex, Icon, Icons } from "@arizeai/components";

import environment from "@phoenix/RelayEnvironment";

const codeMirrorCSS = css`
  .cm-content {
    padding: var(--ac-global-dimension-static-size-100) 0;
  }
  .cm-editor,
  .cm-gutters {
    background-color: transparent;
  }
`;

const fieldCSS = css`
  border-width: var(--ac-global-border-size-thin);
  border-style: solid;
  border-color: var(--ac-global-input-field-border-color);
  border-radius: var(--ac-global-rounding-small);
  background-color: var(--ac-global-input-field-background-color);
  transition: all 0.2s ease-in-out;
  overflow: hidden;
  &:hover,
  &[data-is-focused="true"] {
    border-color: var(--ac-global-input-field-border-color-active);
    background-color: var(--ac-global-input-field-background-color-active);
  }
`;

async function isConditionValid(condition: string) {
  const isValid = fetchQuery(
    environment,
    graphql`
      query SpanFilterConditionFieldValidationQuery($condition: String!) {
        
      }
    `,
    { condition }
  ).toPromise();
}
const extensions = [python()];
export function SpanFilterConditionField() {
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [filterCondition, setFilterCondition] = useState<string>("");
  return (
    <div data-is-focused={isFocused} css={fieldCSS}>
      <Flex direction="row">
        <AddonBefore>
          <Icon svg={<Icons.Search />} />
        </AddonBefore>
        <CodeMirror
          css={codeMirrorCSS}
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            bracketMatching: true,
            syntaxHighlighting: true,
            highlightActiveLine: false,
            highlightActiveLineGutter: false,
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          value={filterCondition}
          onChange={(value) => setFilterCondition(value)}
          height="36px"
          width="100%"
          theme={nord}
          extensions={extensions}
        />
      </Flex>
    </div>
  );
}
