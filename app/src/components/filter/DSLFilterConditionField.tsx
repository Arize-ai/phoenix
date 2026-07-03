import type {
  Completion,
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";
import { autocompletion } from "@codemirror/autocomplete";
import { python } from "@codemirror/lang-python";
import { css } from "@emotion/react";
import type { EditorView } from "@uiw/react-codemirror";
import CodeMirror, {
  type BasicSetupOptions,
  keymap,
} from "@uiw/react-codemirror";
import type { ReactNode } from "react";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  DialogTrigger,
  Flex,
  Icon,
  IconButton,
  Icons,
  Popover,
  Text,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";
import { pierreDark, pierreLight } from "@phoenix/components/code";
import { useTheme } from "@phoenix/contexts";
import { classNames } from "@phoenix/utils/classNames";

import { dslFilterCodeMirrorCSS, dslFilterFieldCSS } from "./styles";

/**
 * The result of validating a DSL filter condition expression, typically
 * performed server-side.
 */
export type DSLFilterConditionValidationResult = {
  isValid: boolean;
  errorMessage?: string | null;
};

const pythonLanguage = python();

const basicSetupOptions: BasicSetupOptions = {
  lineNumbers: false,
  foldGutter: false,
  bracketMatching: true,
  syntaxHighlighting: true,
  highlightActiveLine: false,
  highlightActiveLineGutter: false,
  defaultKeymap: false,
  searchKeymap: false,
};

/**
 * Builds a CodeMirror completion source that surfaces the given DSL
 * vocabulary (variables and macro snippets) as the user types.
 */
function createCompletionSource(completions: Completion[]) {
  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/\w*/);
    if (!word) return null;

    if (word.from === word.to && !context.explicit) return null;

    return {
      from: word.from,
      options: completions,
    };
  };
}

export type DSLFilterConditionFieldProps = {
  /**
   * The current filter condition expression (controlled)
   */
  value: string;
  /**
   * Callback when the condition text changes
   */
  onChange: (condition: string) => void;
  /**
   * The DSL vocabulary surfaced via typeahead — variables and macro snippets
   */
  completions: Completion[];
  /**
   * Async validation of the condition expression. An empty condition should
   * resolve as valid.
   */
  validateCondition: (
    condition: string
  ) => Promise<DSLFilterConditionValidationResult | null | undefined>;
  /**
   * Callback when the (deferred) condition passes validation
   */
  onValidCondition: (condition: string) => void;
  /**
   * Callback whenever the validity of the condition changes, including when
   * a validation round-trip is in flight (invalid until proven valid)
   */
  onValidationStateChange?: (isValid: boolean) => void;
  placeholder?: string;
  /**
   * Optional content for the condition builder popover (e.g. a
   * `DSLFilterConditionBuilder`). When provided, a "+" trigger is shown at
   * the end of the field.
   */
  builder?: ReactNode;
  className?: string;
};

/**
 * A filter condition input for a python-like filter DSL with typeahead,
 * async validation, and an optional snippet builder. The DSL itself is fully
 * defined by the caller via `completions`, `validateCondition`, and
 * `builder`.
 */
export function DSLFilterConditionField(props: DSLFilterConditionFieldProps) {
  const {
    value,
    onChange,
    completions,
    validateCondition,
    onValidCondition,
    onValidationStateChange,
    placeholder = "filter condition",
    builder,
    className,
  } = props;
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const deferredValue = useDeferredValue(value);
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "light" ? pierreLight : pierreDark;

  const fieldRef = useRef<HTMLDivElement>(null);

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
    pythonLanguage,
    autocompletion({ override: [createCompletionSource(completions)] }),
  ];

  useEffect(() => {
    let isCancelled = false;

    if (deferredValue.trim() !== "") {
      onValidationStateChange?.(false);
    }

    void validateCondition(deferredValue).then((result) => {
      if (isCancelled) {
        return;
      }

      if (!result?.isValid) {
        setErrorMessage(result?.errorMessage ?? "Invalid filter condition");
        onValidationStateChange?.(false);
      } else {
        setErrorMessage("");
        onValidationStateChange?.(true);
        startTransition(() => {
          onValidCondition(deferredValue);
        });
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [
    deferredValue,
    validateCondition,
    onValidCondition,
    onValidationStateChange,
  ]);

  const hasError = errorMessage !== "";
  const hasCondition = value !== "";
  return (
    <div
      data-is-focused={isFocused}
      data-is-invalid={hasError}
      className={classNames("dsl-filter-condition-field", className)}
      css={dslFilterFieldCSS}
      ref={fieldRef}
    >
      <Flex direction="row" alignItems="center">
        <Icon svg={<Icons.ListFilter />} className="filter-icon" />
        <CodeMirror
          css={dslFilterCodeMirrorCSS}
          indentWithTab={false}
          basicSetup={basicSetupOptions}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          value={value}
          onChange={onChange}
          height="36px"
          width="100%"
          theme={codeMirrorTheme}
          placeholder={placeholder}
          extensions={extensions}
        />
        <button
          css={css`
            margin-right: var(--global-dimension-static-size-100);
            padding: 2px;
            color: var(--global-text-color-700);
            border-radius: var(--global-rounding-small);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            visibility: ${hasCondition ? "visible" : "hidden"};
            &:hover {
              color: var(--global-text-color-900);
              background-color: var(--global-color-gray-300);
            }
          `}
          onClick={() => onChange("")}
          className="button--reset"
          aria-label="Clear filter condition"
        >
          <Icon svg={<Icons.Close />} />
        </button>
        {builder ? (
          <DialogTrigger>
            <IconButton
              css={css`
                color: var(--global-text-color-700);
                border-left: 1px solid var(--global-input-field-border-color);
                border-bottom: 0;
                border-top: 0;
                padding-left: var(--global-dimension-static-size-100);
                padding-right: var(--global-dimension-static-size-100);
                border-radius: 0;
                height: 36px !important;
              `}
              className="button--reset"
            >
              <Icon svg={<Icons.Plus />} />
            </IconButton>
            <Popover placement="bottom right">{builder}</Popover>
          </DialogTrigger>
        ) : null}
      </Flex>
      <TooltipTrigger isOpen={hasError && isFocused}>
        <Tooltip placement="bottom" triggerRef={fieldRef}>
          {errorMessage !== "" ? (
            <Text color="danger">{errorMessage}</Text>
          ) : (
            <Text color="success">Valid Expression</Text>
          )}
        </Tooltip>
      </TooltipTrigger>
    </div>
  );
}
