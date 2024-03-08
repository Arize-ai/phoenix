import React, {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useState,
} from "react";
import { useParams } from "react-router";
import { autocompletion, CompletionContext } from "@codemirror/autocomplete";
import { python } from "@codemirror/lang-python";
import { EditorView, keymap } from "@codemirror/view";
import { nord } from "@uiw/codemirror-theme-nord";
import CodeMirror from "@uiw/react-codemirror";
import { fetchQuery, graphql } from "relay-runtime";
import { css } from "@emotion/react";

import {
  AddonBefore,
  Button,
  Field,
  Flex,
  Form,
  HelpTooltip,
  Icon,
  Icons,
  PopoverTrigger,
  Text,
  TooltipTrigger,
  TriggerWrap,
  View,
} from "@arizeai/components";

import { useTheme } from "@phoenix/contexts";
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
        label: "status_code",
        type: "variable",
        info: "The span status: OK, UNSET, or ERROR",
      },
      {
        label: "input.value",
        type: "variable",
        info: "The input value of a span, typically a query",
      },
      {
        label: "output.value",
        type: "variable",
        info: "The output value of a span, typically a response",
      },
      {
        label: "name",
        type: "variable",
        info: "The name given to a span - e.x. OpenAI",
      },
      {
        label: "latency_ms",
        type: "variable",
        info: "Latency (i.e. duration) in milliseconds",
      },
      {
        label: "cumulative_token_count.prompt",
        type: "variable",
        info: "Sum of token count for prompt from self and all child spans",
      },
      {
        label: "cumulative_token_count.completion",
        type: "variable",
        info: "Sum of token count for completion from self and all child spans",
      },
      {
        label: "cumulative_token_count.total",
        type: "variable",
        info: "Sum of token count total (prompt + completion) from self and all child spans",
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
      {
        label: "search input",
        type: "text",
        apply: "'' in input.value",
        detail: "macro",
      },
      {
        label: "search output",
        type: "text",
        apply: "'' in output.value",
        detail: "macro",
      },
      {
        label: "status_code error",
        type: "text",
        apply: "status_code == 'ERROR'",
        detail: "macro",
      },
      {
        label: "Latency >= 10s",
        type: "text",
        apply: "latency_ms >= 10_000",
        detail: "macro",
      },
      {
        label: "Tokens >= 1,000",
        type: "text",
        apply: "llm.token_count.total >= 1_000",
        detail: "macro",
      },
      {
        label: "Hallucinations",
        type: "text",
        apply: "evals['Hallucination'].label == 'hallucinated'",
        detail: "macro",
      },
    ],
  };
}

/**
 * Async server-side validation of the filter condition expression
 */
async function isConditionValid(condition: string, projectId: string) {
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
        query SpanFilterConditionFieldValidationQuery(
          $condition: String!
          $id: GlobalID!
        ) {
          project: node(id: $id) {
            ... on Project {
              validateSpanFilterCondition(condition: $condition) {
                isValid
                errorMessage
              }
            }
          }
        }
      `,
      { condition, id: projectId }
    ).toPromise();
  // Satisfy the type checker
  if (!validationResult) {
    throw new Error("Filter condition validation is null");
  }
  return validationResult.project.validateSpanFilterCondition;
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
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "dark" ? nord : undefined;
  const onAddFilterConditionSnippet = useCallback(
    (additionalCondition: string) => {
      if (filterCondition.length > 0) {
        setFilterCondition(`${filterCondition} and ${additionalCondition}`);
      } else {
        setFilterCondition(additionalCondition);
      }
    },
    [filterCondition, setFilterCondition]
  );
  const { projectId } = useParams();

  useEffect(() => {
    isConditionValid(deferredFilterCondition, projectId as string).then(
      (result) => {
        if (!result?.isValid && result?.errorMessage) {
          setErrorMessage(result.errorMessage);
        } else {
          setErrorMessage("");
          startTransition(() => {
            onValidCondition(deferredFilterCondition);
          });
        }
      }
    );
  }, [onValidCondition, deferredFilterCondition, projectId]);

  const hasError = errorMessage !== "";
  const hasCondition = filterCondition !== "";
  return (
    <div
      data-is-focused={isFocused}
      data-is-invalid={hasError}
      className="span-filter-condition-field"
      css={fieldCSS}
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
            defaultKeymap: false,
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          value={filterCondition}
          onChange={setFilterCondition}
          height="36px"
          width="100%"
          theme={codeMirrorTheme}
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
        <PopoverTrigger placement="bottom right">
          <TriggerWrap>
            <button
              css={css`
                color: var(--ac-global-text-color-700);
                background-color: var(--ac-global-color-grey-400);
                padding-left: var(--ac-global-dimension-static-size-100);
                padding-right: var(--ac-global-dimension-static-size-100);
                height: 100%;
              `}
              className="button--reset"
            >
              <Icon svg={<Icons.PlusCircleOutline />} />
            </button>
          </TriggerWrap>
          <FilterConditionBuilder
            onAddFilterConditionSnippet={onAddFilterConditionSnippet}
          />
        </PopoverTrigger>
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

/**
 * Component to build up a filter condition via snippets of conditions
 * E.x. filter by kind, filter by token count, etc.
 */
function FilterConditionBuilder(props: {
  onAddFilterConditionSnippet: (condition: string) => void;
}) {
  const { onAddFilterConditionSnippet } = props;
  return (
    <View
      width="500px"
      paddingTop="size-200"
      paddingStart="size-200"
      paddingEnd="size-200"
      borderRadius="medium"
      borderWidth="thin"
      borderColor="light"
      backgroundColor="light"
    >
      <Form>
        <FilterConditionSnippet
          key="kind"
          label="filter by kind"
          initialSnippet="span_kind == 'LLM'"
          onAddFilterConditionSnippet={onAddFilterConditionSnippet}
        />
        <FilterConditionSnippet
          key="token_count"
          label="filter by token count"
          initialSnippet="cumulative_token_count.total > 1000"
          onAddFilterConditionSnippet={onAddFilterConditionSnippet}
        />
        <FilterConditionSnippet
          key="eval_label"
          label="filter by evaluation label"
          initialSnippet="evals['Hallucination'].label == 'hallucinated'"
          onAddFilterConditionSnippet={onAddFilterConditionSnippet}
        />
        <FilterConditionSnippet
          key="eval_score"
          label="filter by evaluation score"
          initialSnippet="evals['Hallucination'].score < 1"
          onAddFilterConditionSnippet={onAddFilterConditionSnippet}
        />
      </Form>
    </View>
  );
}

/**
 * A snippet of filter condition that can be added to the filter condition field
 */
function FilterConditionSnippet(props: {
  label: string;
  initialSnippet: string;
  onAddFilterConditionSnippet: (condition: string) => void;
}) {
  const { initialSnippet, onAddFilterConditionSnippet } = props;
  const [snippet, setSnippet] = useState<string>(initialSnippet);
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "light" ? undefined : nord;
  return (
    <Field label={props.label}>
      <Flex direction="row" width="100%" gap="size-100">
        <div
          css={css(
            fieldCSS,
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
            extensions={[python()]}
            editable={true}
            onChange={setSnippet}
            theme={codeMirrorTheme}
            css={codeMirrorCSS}
          />
        </div>
        <Button
          title="Add to filter condition"
          variant="default"
          onClick={() => onAddFilterConditionSnippet(snippet)}
          icon={<Icon svg={<Icons.PlusCircleOutline />} />}
        />
      </Flex>
    </Field>
  );
}
