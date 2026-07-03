import { python } from "@codemirror/lang-python";
import { css } from "@emotion/react";
import CodeMirror from "@uiw/react-codemirror";
import { useState } from "react";

import { Button, Flex, Icon, Icons, Label, View } from "@phoenix/components";
import { pierreDark, pierreLight } from "@phoenix/components/code";
import { fieldBaseCSS } from "@phoenix/components/core/field/styles";
import { useTheme } from "@phoenix/contexts";

import { dslFilterCodeMirrorCSS, dslFilterFieldCSS } from "./styles";

/**
 * An editable example condition for a DSL that can be added to a filter
 * condition, e.g. filter by kind, filter by token count, etc.
 */
export type DSLFilterSnippet = {
  key: string;
  label: string;
  snippet: string;
};

const pythonLanguage = python();

export type DSLFilterConditionBuilderProps = {
  /**
   * The example conditions the user can tweak and add
   */
  snippets: DSLFilterSnippet[];
  /**
   * Callback when the user adds a snippet to the filter condition
   */
  onAddCondition: (condition: string) => void;
};

/**
 * Content for the DSLFilterConditionField builder popover: a list of
 * editable condition snippets that can be appended to the filter condition.
 */
export function DSLFilterConditionBuilder(
  props: DSLFilterConditionBuilderProps
) {
  const { snippets, onAddCondition } = props;
  return (
    <View
      width="500px"
      padding="size-200"
      borderRadius="medium"
      backgroundColor="gray-75"
    >
      <Flex direction="column" gap="size-100">
        {snippets.map(({ key, label, snippet }) => (
          <DSLFilterConditionSnippet
            key={key}
            label={label}
            initialSnippet={snippet}
            onAddCondition={onAddCondition}
          />
        ))}
      </Flex>
    </View>
  );
}

/**
 * A single editable snippet of a DSL filter condition that can be added to
 * the filter condition field
 */
export function DSLFilterConditionSnippet(props: {
  label: string;
  initialSnippet: string;
  onAddCondition: (condition: string) => void;
}) {
  const { label, initialSnippet, onAddCondition } = props;
  const [snippet, setSnippet] = useState<string>(initialSnippet);
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "light" ? pierreLight : pierreDark;
  return (
    <div css={fieldBaseCSS}>
      <Label>{label}</Label>
      <Flex direction="row" width="100%" gap="size-100">
        <div
          css={css(
            dslFilterFieldCSS,
            css`
              flex: 1 1 auto;
            `
          )}
        >
          <CodeMirror
            value={snippet}
            basicSetup={{
              lineNumbers: false,
              foldGutter: false,
              bracketMatching: true,
              syntaxHighlighting: true,
              highlightActiveLine: false,
              highlightActiveLineGutter: false,
            }}
            extensions={[pythonLanguage]}
            editable={true}
            onChange={setSnippet}
            theme={codeMirrorTheme}
            css={dslFilterCodeMirrorCSS}
          />
        </div>
        <Button
          aria-label="Add to filter condition"
          variant="default"
          onPress={() => onAddCondition(snippet)}
          leadingVisual={<Icon svg={<Icons.PlusCircle />} />}
        />
      </Flex>
    </div>
  );
}
