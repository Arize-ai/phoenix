import type {
  Completion,
  CompletionContext,
  CompletionResult,
  CompletionSource,
} from "@codemirror/autocomplete";
import { autocompletion } from "@codemirror/autocomplete";
import { python } from "@codemirror/lang-python";
import { css, keyframes } from "@emotion/react";
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
  useEffectEvent,
  useId,
  useRef,
  useState,
} from "react";
import { Pressable } from "react-aria";

import {
  Flex,
  Icon,
  Icons,
  Text,
  Tooltip,
  TooltipTrigger,
  VisuallyHidden,
} from "@phoenix/components";
import { pierreDark, pierreLight } from "@phoenix/components/code";
import { useTheme } from "@phoenix/contexts";
import { classNames } from "@phoenix/utils/classNames";

const DEFAULT_TOKEN_REGEX = /[A-Za-z0-9_.'"[\]-]*/;

export const filterConditionCodeMirrorCSS = css`
  flex: 1 1 auto;
  .cm-content {
    padding: var(--global-dimension-static-size-100) 0;
  }
  .cm-editor {
    background-color: transparent !important;
  }
  .cm-focused {
    outline: none;
  }
  .cm-selectionLayer .cm-selectionBackground {
    background: var(--global-color-cyan-400) !important;
  }
`;

const statusBadgeIn = keyframes`
  from {
    opacity: 0;
    max-width: 0;
    padding-left: 0;
    padding-right: 0;
  }
`;

export const filterConditionFieldCSS = css`
  display: flex;
  flex: 1 1 auto;
  border-width: var(--global-border-size-thin);
  border-style: solid;
  border-color: var(--global-input-field-border-color);
  border-radius: var(--global-rounding-small);
  background-color: var(--global-input-field-background-color);
  transition: all 0.2s ease-in-out;
  overflow-x: hidden;
  box-sizing: border-box;
  &:hover,
  &[data-is-focused="true"] {
    border-color: var(--global-input-field-border-color-active);
  }
  &[data-is-warning="true"] {
    border-color: var(--global-color-warning);
  }
  &[data-is-invalid="true"] {
    border-color: var(--global-color-danger);
  }
  .filter-condition-field__filter-icon {
    margin-left: var(--global-dimension-static-size-100);
  }
  .filter-condition-field__status-badge {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-50);
    max-width: 200px;
    overflow: hidden;
    padding: 2px var(--global-dimension-size-65);
    margin-right: var(--global-dimension-size-50);
    border-radius: var(--global-rounding-small);
    font-size: var(--global-font-size-xs);
    line-height: var(--global-line-height-xs);
    white-space: nowrap;
    cursor: default;
    animation: ${statusBadgeIn} 0.25s ease-out;
    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
    &[data-severity="danger"] {
      background-color: var(--global-color-danger-100);
      color: var(--global-color-danger);
    }
    &[data-severity="warning"] {
      background-color: color-mix(
        in srgb,
        var(--global-color-warning) 10%,
        transparent
      );
      color: var(--global-color-warning);
    }
    .icon-wrap {
      flex-shrink: 0;
    }
    &:focus-visible {
      outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
      outline-offset: var(--focus-ring-offset);
    }
  }
  .filter-condition-field__status-badge-message {
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const clearButtonCSS = css`
  margin-right: var(--global-dimension-static-size-100);
  color: var(--global-text-color-700);
  &[data-is-hidden="true"] {
    visibility: hidden;
  }
`;

const warningListCSS = css`
  list-style: none;
  margin: 0;
  padding: 0;
`;

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

const enterSwallowingKeymap = keymap.of([
  {
    key: "Enter",
    run: (_editorView: EditorView) => true,
  },
]);

export type FilterConditionValidationResult = {
  readonly isValid: boolean;
  readonly errorMessage?: string | null;
  readonly warnings?: readonly string[];
};

export type FilterConditionValidationStatus = {
  condition: string;
  isValid: boolean;
};

type FilterConditionFieldProps = {
  value: string;
  onChange: (condition: string) => void;
  onValidCondition: (condition: string) => void;
  validateCondition: (
    condition: string
  ) => Promise<FilterConditionValidationResult | null | undefined>;
  completions: readonly Completion[] | CompletionSource;
  placeholder: string;
  ariaLabel: string;
  basicSetupOverrides?: BasicSetupOptions;
  className?: string;
  clearAriaLabel?: string;
  extras?: ReactNode;
  tokenRegex?: RegExp;
  validationKey?: string;
  getValidatedCondition?: (condition: string) => string;
  onValidationStatusChange?: (status: FilterConditionValidationStatus) => void;
};

function getCompletionSource({
  completions,
  tokenRegex,
}: {
  completions: readonly Completion[] | CompletionSource;
  tokenRegex: RegExp;
}): CompletionSource {
  if (typeof completions === "function") {
    return completions;
  }
  return function filterConditionCompletions(
    context: CompletionContext
  ): CompletionResult | null {
    const word = context.matchBefore(tokenRegex);
    if (!word || (word.from === word.to && !context.explicit)) {
      return null;
    }
    return {
      from: word.from,
      options: Array.from(completions),
    };
  };
}

export function FilterConditionField(props: FilterConditionFieldProps) {
  const {
    value,
    onChange,
    onValidCondition,
    validateCondition,
    completions,
    placeholder,
    ariaLabel,
    basicSetupOverrides,
    className,
    clearAriaLabel = `Clear ${ariaLabel.toLowerCase()}`,
    extras,
    tokenRegex = DEFAULT_TOKEN_REGEX,
    validationKey = "",
    getValidatedCondition = (condition) => condition,
    onValidationStatusChange,
  } = props;
  const [isFocused, setIsFocused] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [warnings, setWarnings] = useState<readonly string[]>([]);
  const deferredValue = useDeferredValue(value);
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "light" ? pierreLight : pierreDark;
  const editorViewRef = useRef<EditorView | null>(null);
  const statusId = useId();

  const runValidation = useEffectEvent((condition: string) =>
    validateCondition(condition)
  );
  const publishValidCondition = useEffectEvent((condition: string) => {
    onValidCondition(getValidatedCondition(condition));
  });
  const publishValidationStatus = useEffectEvent(
    (status: FilterConditionValidationStatus) => {
      onValidationStatusChange?.(status);
    }
  );

  useEffect(() => {
    let isCancelled = false;

    setWarnings([]);
    if (deferredValue.trim()) {
      publishValidationStatus({ condition: deferredValue, isValid: false });
    }

    void runValidation(deferredValue).then(
      (result) => {
        if (isCancelled) {
          return;
        }
        if (!result?.isValid) {
          setErrorMessage(result?.errorMessage ?? "Invalid filter condition");
          setWarnings([]);
          publishValidationStatus({
            condition: deferredValue,
            isValid: false,
          });
          return;
        }
        setErrorMessage("");
        setWarnings(result.warnings ?? []);
        publishValidationStatus({ condition: deferredValue, isValid: true });
        startTransition(() => {
          publishValidCondition(deferredValue);
        });
      },
      (error: unknown) => {
        if (isCancelled) {
          return;
        }
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to validate filter condition"
        );
        setWarnings([]);
        publishValidationStatus({ condition: deferredValue, isValid: false });
      }
    );

    return () => {
      isCancelled = true;
    };
  }, [deferredValue, validationKey]);

  const completionSource = getCompletionSource({ completions, tokenRegex });
  const extensions = [
    enterSwallowingKeymap,
    python(),
    autocompletion({ override: [completionSource] }),
  ];
  const hasError = errorMessage !== "";
  const hasWarnings = warnings.length > 0;
  const hasCondition = value !== "";

  // Validity attributes are applied directly to the contenteditable so
  // toggling them doesn't force a CodeMirror reconfigure
  useEffect(() => {
    const content = editorViewRef.current?.contentDOM;
    if (!content) {
      return;
    }
    content.setAttribute("aria-invalid", hasError ? "true" : "false");
    if (hasError || hasWarnings) {
      content.setAttribute("aria-describedby", statusId);
    } else {
      content.removeAttribute("aria-describedby");
    }
  }, [hasError, hasWarnings, statusId]);

  return (
    <div
      data-is-focused={isFocused}
      data-is-invalid={hasError}
      data-is-warning={!hasError && hasWarnings}
      className={classNames("filter-condition-field", className)}
      css={filterConditionFieldCSS}
    >
      <Flex direction="row" alignItems="center" width="100%">
        <Icon
          svg={<Icons.ListFilter />}
          className="filter-condition-field__filter-icon"
        />
        <CodeMirror
          aria-label={ariaLabel}
          css={filterConditionCodeMirrorCSS}
          indentWithTab={false}
          basicSetup={{ ...basicSetupOptions, ...basicSetupOverrides }}
          onCreateEditor={(editorView) => {
            editorViewRef.current = editorView;
          }}
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
        {hasError || hasWarnings ? (
          <TooltipTrigger delay={0}>
            <Pressable>
              <div
                role="button"
                tabIndex={0}
                className="filter-condition-field__status-badge"
                data-severity={hasError ? "danger" : "warning"}
                aria-label={
                  hasError
                    ? "Filter condition error"
                    : "Filter condition warning"
                }
              >
                <Icon
                  svg={<Icons.AlertCircle />}
                  color={hasError ? "danger" : "warning"}
                />
                <span className="filter-condition-field__status-badge-message">
                  {hasError
                    ? errorMessage || "Invalid filter condition"
                    : warnings[0]}
                </span>
              </div>
            </Pressable>
            <Tooltip placement="bottom">
              {hasError ? (
                <Text color="danger">{errorMessage}</Text>
              ) : (
                <ul
                  className="filter-condition-field__warning-list"
                  css={warningListCSS}
                >
                  {warnings.map((warning, index) => (
                    <li key={`${warning}-${index}`}>
                      <Text color="warning">{warning}</Text>
                    </li>
                  ))}
                </ul>
              )}
            </Tooltip>
          </TooltipTrigger>
        ) : null}
        <button
          aria-label={clearAriaLabel}
          css={clearButtonCSS}
          data-is-hidden={!hasCondition}
          onClick={() => onChange("")}
          className="button--reset filter-condition-field__clear-button"
        >
          <Icon svg={<Icons.CloseCircle />} />
        </button>
        {extras}
      </Flex>
      <VisuallyHidden>
        <span id={statusId} role="status">
          {hasError
            ? `Invalid filter condition. ${errorMessage}`.trim()
            : warnings.join(" ")}
        </span>
      </VisuallyHidden>
    </div>
  );
}
