import React, {
  startTransition,
  useDeferredValue,
  useEffect,
  useState,
} from "react";
import { autocompletion, CompletionContext } from "@codemirror/autocomplete";
import { python } from "@codemirror/lang-python";
import { EditorView, keymap } from "@codemirror/view";
import { nord } from "@uiw/codemirror-theme-nord";
import CodeMirror from "@uiw/react-codemirror";
import { fetchQuery, graphql } from "relay-runtime";
import { css } from "@emotion/react";

import {
  AddonBefore,
  Flex,
  HelpTooltip,
  Icon,
  Icons,
  Text,
  TooltipTrigger,
  TriggerWrap,
} from "@arizeai/components";

import environment from "@phoenix/RelayEnvironment";

import { SpanFilterConditionFieldValidationQuery } from "./__generated__/SpanFilterConditionFieldValidationQuery.graphql";

const codeMirrorCSS = css`
  flex: 1 1 auto;
  .cm-content {
    padding: var(--ac-global-dimension-static-size-100) 0;
  }
  .cm-editor {
    background-color: transparent;
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
  overflow: hidden;
  &:hover,
  &[data-is-focused="true"] {
    border-color: var(--ac-global-input-field-border-color-active);
    background-color: var(--ac-global-input-field-background-color-active);
  }
  &[data-is-invalid="true"] {
    border-color: var(--ac-global-color-danger);
  }
`;

function filterConditionCompletions(context: CompletionContext) {
  const word = context.matchBefore(/\w*/);
  if (!word) return null;

  if (word.from == word.to && !context.explicit) return null;
  return {
    from: word.from,
    options: [
      {
        label: "span_kind",
        type: "variable",
        info: "The span variant: CHAIN, LLM, RETRIEVER, TOOL, etc.",
      },
      {
        label: "llm spans",
        type: "text",
        apply: "span_kind == 'LLM'",
        detail: "macro",
      },
      {
        label: "retriever spans",
        type: "text",
        apply: "span_kind == 'RETRIEVER'",
        detail: "macro",
      },
      // TODO: need to fix the validation logic
      // {
      //   label: "search input",
      //   type: "text",
      //   apply: "`attributes.input.value`.str.contains('')",
      //   detail: "macro",
      // },
      // {
      //   label: "search output",
      //   type: "text",
      //   apply: "`attributes.output.value`.str.contains('')",
      //   detail: "macro",
      // },
    ],
  };
}

/**
 * Async server-side validation of the filter condition expression
 */
async function isConditionValid(condition: string) {
  if (!condition) {
    return {
      isValid: true,
      errorMessage: null,
    };
  }
  const validationResult =
    await fetchQuery<SpanFilterConditionFieldValidationQuery>(
      environment,
      graphql`
        query SpanFilterConditionFieldValidationQuery($condition: String!) {
          validateSpanFilterCondition(condition: $condition) {
            isValid
            errorMessage
          }
        }
      `,
      { condition }
    ).toPromise();
  // Satisfy the type checker
  if (!validationResult) {
    throw new Error("Filter condition validation is null");
  }
  return validationResult.validateSpanFilterCondition;
}

const extensions = [
  keymap.of([
    {
      key: "Enter",
      run: (_editorView: EditorView) => {
        // Ignore newlines
        return true;
      },
    },
  ]),
  python(),
  autocompletion({ override: [filterConditionCompletions] }),
];

type SpanFilterConditionFieldProps = {
  /**
   * Callback when the condition is valid
   */
  onValidCondition: (condition: string) => void;
  placeholder?: string;
};
export function SpanFilterConditionField(props: SpanFilterConditionFieldProps) {
  const {
    onValidCondition,
    placeholder = "filter condition (e.x. span_kind == 'LLM')",
  } = props;
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [filterCondition, setFilterCondition] = useState<string>("");
  const deferredFilterCondition = useDeferredValue(filterCondition);

  useEffect(() => {
    isConditionValid(deferredFilterCondition).then((result) => {
      if (!result.isValid && result.errorMessage) {
        setErrorMessage(result.errorMessage);
      } else {
        setErrorMessage("");
        startTransition(() => {
          onValidCondition(deferredFilterCondition);
        });
      }
    });
  }, [onValidCondition, deferredFilterCondition]);

  const hasError = errorMessage !== "";
  const hasCondition = filterCondition !== "";
  return (
    <div data-is-focused={isFocused} data-is-invalid={hasError} css={fieldCSS}>
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
            defaultKeymap: false,
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          value={filterCondition}
          onChange={setFilterCondition}
          height="36px"
          width="100%"
          theme={nord}
          placeholder={placeholder}
          extensions={extensions}
        />
        <button
          css={css`
            margin-right: var(--ac-global-dimension-static-size-100);
            color: var(--ac-global-text-color-700);
            visibility: ${hasCondition ? "visible" : "hidden"};
          `}
          onClick={() => setFilterCondition("")}
          className="button--reset"
        >
          <Icon svg={<Icons.CloseCircleOutline />} />
        </button>
      </Flex>
      <TooltipTrigger isOpen={hasError && isFocused} placement="bottom">
        <TriggerWrap>
          <div />
        </TriggerWrap>
        <HelpTooltip>
          {errorMessage != "" ? (
            <Text color="danger">{errorMessage}</Text>
          ) : (
            <Text color="success">Valid Expression</Text>
          )}
        </HelpTooltip>
      </TooltipTrigger>
    </div>
  );
}
