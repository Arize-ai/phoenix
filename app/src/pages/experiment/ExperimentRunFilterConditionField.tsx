import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import {
  autocompletion,
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";
import { python } from "@codemirror/lang-python";
import { githubDark, githubLight } from "@uiw/codemirror-theme-github";
import CodeMirror, { EditorView, keymap } from "@uiw/react-codemirror";
import { fetchQuery, graphql } from "relay-runtime";
import { css } from "@emotion/react";

import {
  AddonBefore,
  Field,
  HelpTooltip,
  PopoverTrigger,
  TooltipTrigger,
  TriggerWrap,
} from "@arizeai/components";

import {
  Button,
  Flex,
  Form,
  Icon,
  Icons,
  Text,
  View,
} from "@phoenix/components";
import { useTheme } from "@phoenix/contexts";
import environment from "@phoenix/RelayEnvironment";

import { ExperimentRunFilterConditionFieldValidationQuery } from "./__generated__/ExperimentRunFilterConditionFieldValidationQuery.graphql";
import { useExperimentRunFilterCondition } from "./ExperimentRunFilterConditionContext";

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

function filterConditionCompletions(
  context: CompletionContext
): CompletionResult | null {
  const word = context.matchBefore(/\w*/);
  if (!word) return null;

  if (word.from == word.to && !context.explicit) return null;

  return {
    from: word.from,
    options: [
      {
        label: "input",
        type: "variable",
        info: "The input of the dataset example",
      },
      {
        label: "reference_output",
        type: "variable",
        info: "The reference output of the dataset example",
      },
      {
        label: "metadata",
        type: "variable",
        info: "The metadata of the dataset example",
      },
      {
        label: "output",
        type: "variable",
        info: "The output of the experiment run",
      },
      {
        label: "error",
        type: "variable",
        info: "The error message of the experiment run (if exists)",
      },
      {
        label: "latency_ms",
        type: "variable",
        info: "The duration of the experiment run in milliseconds",
      },
      {
        label: "evals",
        type: "variable",
        info: "The evaluations of the experiment run",
      },
      {
        label: "search input",
        type: "text",
        apply: "'' in input",
        detail: "macro",
      },
      {
        label: "search reference output",
        type: "text",
        apply: "'' in reference_output",
        detail: "macro",
      },
      {
        label: "search output",
        type: "text",
        apply: "'' in output",
        detail: "macro",
      },
      {
        label: "has error",
        type: "text",
        apply: "error is not None",
        detail: "macro",
      },
      {
        label: "Latency >= 10s",
        type: "text",
        apply: "latency_ms >= 10_000",
        detail: "macro",
      },
      {
        label: "Hallucinations",
        type: "text",
        apply: "evals['hallucination'].label == 'hallucinated'",
        detail: "macro",
      },
      {
        label: "Metadata",
        type: "text",
        apply: "metadata['category'] == 'hard_examples'",
        detail: "macro",
      },
    ],
  };
}

/**
 * Async server-side validation of the experiment run filter condition expression
 */
async function isConditionValid(condition: string, experimentIds: string[]) {
  if (!condition) {
    return {
      isValid: true,
      errorMessage: null,
    };
  }
  const validationResult =
    await fetchQuery<ExperimentRunFilterConditionFieldValidationQuery>(
      environment,
      graphql`
        query ExperimentRunFilterConditionFieldValidationQuery(
          $condition: String!
          $experimentIds: [ID!]!
        ) {
          validateExperimentRunFilterCondition(
            condition: $condition
            experimentIds: $experimentIds
          ) {
            isValid
            errorMessage
          }
        }
      `,
      { condition, experimentIds }
    ).toPromise();
  // Satisfy the type checker
  if (!validationResult) {
    throw new Error("Filter condition validation is null");
  }
  return validationResult.validateExperimentRunFilterCondition;
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

type ExperimentRunFilterConditionFieldProps = {
  /**
   * Callback when the condition is valid
   */
  onValidCondition: (condition: string) => void;
  placeholder?: string;
};
export function ExperimentRunFilterConditionField(
  props: ExperimentRunFilterConditionFieldProps
) {
  const {
    onValidCondition,
    placeholder = `filter condition (e.g., evals["Hallucination"].label == 'hallucinated')`,
  } = props;
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const { filterCondition, setFilterCondition, appendFilterCondition } =
    useExperimentRunFilterCondition();
  const deferredFilterCondition = useDeferredValue(filterCondition);
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "light" ? githubLight : githubDark;

  const [searchParams] = useSearchParams();
  const experimentIds = searchParams.getAll("experimentId");

  useEffect(() => {
    isConditionValid(deferredFilterCondition, experimentIds).then((result) => {
      if (!result?.isValid) {
        setErrorMessage(result?.errorMessage ?? "Invalid filter condition");
      } else {
        setErrorMessage("");
        startTransition(() => {
          onValidCondition(deferredFilterCondition);
        });
      }
    });
  }, [onValidCondition, deferredFilterCondition, experimentIds]);

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
          indentWithTab={false}
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
                background-color: var(--ac-global-color-grey-300);
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
            onAddFilterConditionSnippet={appendFilterCondition}
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
          key="substring"
          label="filter by substring"
          initialSnippet="'search term' in output['key']"
          onAddFilterConditionSnippet={onAddFilterConditionSnippet}
        />
        <FilterConditionSnippet
          key="errors"
          label="filter on errors"
          initialSnippet="error is not None"
          onAddFilterConditionSnippet={onAddFilterConditionSnippet}
        />
        <FilterConditionSnippet
          key="eval_label"
          label="filter by evaluation label"
          initialSnippet="evals['hallucination'].label == 'hallucinated'"
          onAddFilterConditionSnippet={onAddFilterConditionSnippet}
        />
        <FilterConditionSnippet
          key="eval_score"
          label="filter by evaluation score"
          initialSnippet="evals['hallucination'].score >= 0.5"
          onAddFilterConditionSnippet={onAddFilterConditionSnippet}
        />
        <FilterConditionSnippet
          key="eval_explanation"
          label="filter by evaluation explanation"
          initialSnippet="'search term' in evals['hallucination'].explanation"
          onAddFilterConditionSnippet={onAddFilterConditionSnippet}
        />
        <FilterConditionSnippet
          key="compare_experiments"
          label="filter for lower scores than first experiment"
          initialSnippet="evals['hallucination'].score < experiments[0].evals['hallucination'].score"
          onAddFilterConditionSnippet={onAddFilterConditionSnippet}
        />

        <FilterConditionSnippet
          key="metadata"
          label="filter by metadata"
          initialSnippet="metadata['category'] == 'hard_examples'"
          onAddFilterConditionSnippet={onAddFilterConditionSnippet}
        />
        <FilterConditionSnippet
          key="latency"
          label="filter by latency"
          initialSnippet="latency_ms >= 10_000"
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
  const codeMirrorTheme = theme === "light" ? githubLight : githubDark;
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
          aria-label="Add to filter condition"
          variant="default"
          onPress={() => onAddFilterConditionSnippet(snippet)}
          leadingVisual={<Icon svg={<Icons.PlusCircleOutline />} />}
        />
      </Flex>
    </Field>
  );
}
