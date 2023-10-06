import React, { useState } from "react";
import { python } from "@codemirror/lang-python";
import { nord } from "@uiw/codemirror-theme-nord";
import CodeMirror from "@uiw/react-codemirror";
import { css } from "@emotion/react";

import { AddonBefore, Flex, Icon, Icons, View } from "@arizeai/components";

const codeMirrorCSS = css`
  .cm-content {
    padding: var(--ac-global-dimension-static-size-100) 0;
  }
  .cm-editor,
  .cm-gutters {
    background-color: transparent;
  }
`;
const extensions = [python()];
export function SpanFilterConditionField() {
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [filterCondition, setFilterCondition] = useState<string>("");
  return (
    <View
      borderRadius="small"
      borderColor={isFocused ? "light" : "blue-100"}
      borderWidth="thick"
    >
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
    </View>
  );
}
