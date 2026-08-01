import type {
  Completion,
  CompletionSection,
  CompletionSource,
} from "@codemirror/autocomplete";
import {
  acceptCompletion,
  autocompletion,
  snippetCompletion,
  startCompletion,
} from "@codemirror/autocomplete";
import { python } from "@codemirror/lang-python";
import CodeMirror, {
  type BasicSetupOptions,
  EditorView,
  keymap,
} from "@uiw/react-codemirror";
import {
  startTransition,
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
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

import { createDSLFilterCompletionSource } from "./dslFilterConditionFieldUtils";
import {
  dslFilterCodeMirrorCSS,
  dslFilterErrorTooltipCSS,
  dslFilterFieldCSS,
  dslFilterWarningTooltipCSS,
} from "./styles";

/**
 * The result of validating a DSL filter condition expression, typically
 * performed server-side.
 */
export type DSLFilterConditionValidationResult = {
  isValid: boolean;
  errorMessage?: string | null;
  /**
   * Advisory, non-blocking diagnostics for a *valid* condition. The field
   * surfaces these as a calmer amber badge (never a red error, never a border,
   * never an invalid state) — e.g. a bare identifier that resolves to an
   * attribute path and so matches nothing. Absent or empty means none.
   */
  warnings?: DSLFilterConditionWarning[];
};

/**
 * A single advisory diagnostic attached to a valid condition. Only `message`
 * is rendered by the field; `identifier`/`suggestion` are carried for callers
 * that want richer surfaces (e.g. an empty-state hint).
 */
export type DSLFilterConditionWarning = {
  message: string;
  identifier?: string;
  suggestion?: string | null;
};

/**
 * An example condition for a DSL that can be inserted into the filter
 * condition, e.g. filter by kind, filter by token count, etc. Shown in the
 * typeahead as a "Suggestions" group — notably when the empty field is
 * focused. `${placeholder}` marks the parts the user is expected to replace;
 * they become tab-through fields once inserted.
 */
export type DSLFilterSnippet = {
  label: string;
  snippet: string;
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

const suggestionsSection: CompletionSection = { name: "Suggestions", rank: 1 };
const fieldsSection: CompletionSection = { name: "Fields", rank: 3 };

/**
 * Section for completions loaded via `loadCompletions` — sorts between the
 * built-in Suggestions and Fields groups: loaded names reflect the user's
 * actual data, so they shouldn't be buried under the generic field vocabulary.
 */
export function createLoadedCompletionSection(name: string): CompletionSection {
  return { name, rank: 2 };
}

/**
 * How many snippets the Suggestions group shows while the user is browsing
 * (dropdown open with nothing typed at the cursor). Without a cap a long
 * snippet list fills the whole dropdown and buries the field and loaded
 * sections below the fold; the full list still surfaces via fuzzy matching
 * once the user types.
 */
const MAX_BROWSE_SUGGESTIONS = 5;
const MAX_BROWSE_FIELDS = 20;

/**
 * How long a typed condition must sit still before it is validated. Tuned by
 * feel: long enough that a phrase being typed does not flash red, short enough
 * that a finished one applies without a wait.
 */
const VALIDATION_DEBOUNCE_MS = 250;

const defaultSnippets: DSLFilterSnippet[] = [];
const defaultCompletionSources: CompletionSource[] = [];

function snippetToCompletion({ label, snippet }: DSLFilterSnippet): Completion {
  return snippetCompletion(snippet, {
    label,
    detail: snippet.replace(/\$\{([^{}]*)\}/g, "$1"),
    type: "text",
    section: suggestionsSection,
  });
}

/**
 * The argument handed to `onValidCondition`: the condition that passed
 * validation, plus whatever `validateCondition` resolved to for it —
 * `null` for an empty condition, which the field resolves itself.
 */
export type DSLFilterValidConditionArgs<
  TValidationResult extends DSLFilterConditionValidationResult =
    DSLFilterConditionValidationResult,
> = {
  condition: string;
  validationResult: TValidationResult | null;
  /**
   * True when this settlement is of the value the field mounted with, rather
   * than of a change made while it was on screen. A mount value arrives from a
   * URL or a caller's default, so consumers that persist applied conditions --
   * to the URL, to a search history -- should skip it: the user did not apply
   * anything, and writing a default somewhere durable turns "no filter chosen"
   * into "this filter chosen" for whoever reads it next.
   */
  isInitialSettlement: boolean;
};

export type DSLFilterValidationFailureReason = "invalid" | "transport";

export type DSLFilterConditionFieldProps<
  TValidationResult extends DSLFilterConditionValidationResult =
    DSLFilterConditionValidationResult,
> = {
  /**
   * The current filter condition expression (controlled)
   */
  value: string;
  /**
   * Callback when the condition text changes
   */
  onChange: (condition: string) => void;
  /**
   * The DSL vocabulary surfaced via typeahead — typically the fields an
   * expression can reference. Completions without an explicit `section` are
   * grouped under "Fields".
   */
  completions: Completion[];
  /**
   * Example conditions surfaced as a "Suggestions" group in the typeahead,
   * including when the empty field is focused. `${placeholder}` segments
   * become tab-through fields on insert. Order most-useful-first: while the
   * user is browsing (nothing typed at the cursor) only the first few are
   * shown so the group doesn't bury the fields below it; the rest surface
   * via fuzzy matching as the user types.
   */
  snippets?: DSLFilterSnippet[];
  /**
   * Loads additional completions asynchronously — e.g. values that actually
   * exist in the user's data such as annotation or evaluation names. Loaded
   * lazily the first time the dropdown opens; the result is cached while the
   * field stays focused and refreshed on the next focus, so names created
   * elsewhere in the app show up when the user returns to filter. Pass a
   * referentially stable function.
   */
  loadCompletions?: () => Promise<Completion[]>;
  /**
   * Additional CodeMirror completion sources for context-aware completions
   * that need the editor state, e.g. suggesting allowed values after a known
   * field comparison. Pass a referentially stable array.
   */
  completionSources?: CompletionSource[];
  /**
   * Async validation of the condition expression. Never called with an
   * empty (or whitespace-only) condition — the field resolves those as
   * valid itself.
   */
  validateCondition: (
    condition: string
  ) => Promise<TValidationResult | null | undefined>;
  /**
   * Callback when the condition passes validation. Receives whatever
   * `validateCondition` resolved to, so a caller that asks the server for more
   * than validity gets the rest of the answer without a channel of its own.
   * `validationResult` is `null` for an empty condition, which is resolved
   * here rather than by the validator.
   */
  onValidCondition: (
    args: DSLFilterValidConditionArgs<TValidationResult>
  ) => void;
  /**
   * Callback when validation rejects the expression or cannot reach the
   * validator. Valid conditions use `onValidCondition`, so the two outcomes
   * cannot be mistaken for the same settlement event. Held as an effect event,
   * like `onValidCondition`, so its identity does not re-run validation.
   */
  onValidationFailed?: (reason: DSLFilterValidationFailureReason) => void;
  /**
   * Changing this value explicitly re-runs validation for the current text.
   * Used by callers that offer a retry after a transport failure.
   */
  validationRetryKey?: number;
  /**
   * Callback whenever the validity of the condition changes, including when
   * a validation round-trip is in flight (invalid until proven valid)
   */
  onValidationStateChange?: (isValid: boolean) => void;
  placeholder?: string;
  /**
   * Accessible name for the condition input
   */
  "aria-label"?: string;
  className?: string;
};

/**
 * A filter condition input for a python-like filter DSL. The typeahead
 * behaves like a combobox: focusing the empty field opens a dropdown of
 * suggested conditions and fields, arrow keys navigate, and Enter inserts.
 * The DSL itself is fully defined by the caller via `completions`,
 * `snippets`, `loadCompletions`, and `validateCondition`.
 *
 * The typeahead is the only floating surface the field opens on its own.
 * Validation errors surface passively — an in-field danger badge previewing
 * the (truncated) error once the typed text has settled and been confirmed
 * invalid (intermediate keystrokes are not flagged), whose tooltip shows the
 * full error on hover or focus, plus a red border once the user leaves the
 * field — so an error can never fight the suggestions dropdown for the same
 * space.
 */
export function DSLFilterConditionField<
  TValidationResult extends DSLFilterConditionValidationResult,
>(props: DSLFilterConditionFieldProps<TValidationResult>) {
  const {
    value,
    onChange,
    completions,
    snippets = defaultSnippets,
    loadCompletions,
    completionSources = defaultCompletionSources,
    validateCondition,
    onValidCondition,
    onValidationFailed,
    validationRetryKey,
    onValidationStateChange,
    placeholder = "filter condition",
    "aria-label": ariaLabel = "filter condition",
    className,
  } = props;
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const hasSettled = useRef<boolean>(false);
  const previousValidationRetryKey = useRef(validationRetryKey);
  // null means the condition is not known to be invalid; the empty string
  // means invalid with no server-provided detail
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Advisory diagnostics for a valid condition — shown as a calmer amber badge
  // that never flips the field invalid. Cleared whenever the text changes so a
  // stale nudge never trails an edit.
  const [warnings, setWarnings] = useState<DSLFilterConditionWarning[]>([]);
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "light" ? pierreLight : pierreDark;

  const editorViewRef = useRef<EditorView | null>(null);
  // Caches the loadCompletions result so the dropdown doesn't refetch every
  // time it opens; invalidated on focus so names created elsewhere in the
  // app (e.g. a new annotation) appear when the user returns to filter
  const loadedCompletionsRef = useRef<Promise<Completion[]> | null>(null);
  const errorId = useId();

  const hasError = errorMessage !== null;
  const hasCondition = value !== "";
  const hasWarnings = !hasError && warnings.length > 0;

  // A cached result from a previous loader no longer describes the data
  useEffect(() => {
    loadedCompletionsRef.current = null;
  }, [loadCompletions]);

  // The extensions must be referentially stable across renders — a new
  // array causes a CodeMirror reconfigure, which resets the in-flight
  // completion state (e.g. the dropdown opened by focusing the field)
  const extensions = useMemo(() => {
    // Fetch loaded completions at most once per focus, retrying on failure
    // the next time the dropdown opens
    const loadCompletionsOnce = loadCompletions
      ? () => {
          loadedCompletionsRef.current ??= loadCompletions().catch((error) => {
            loadedCompletionsRef.current = null;
            throw error;
          });
          return loadedCompletionsRef.current;
        }
      : undefined;
    const snippetOptions = snippets.map(snippetToCompletion);
    const fieldOptions = completions.map((completion) =>
      completion.section
        ? completion
        : { ...completion, section: fieldsSection }
    );
    const staticOptions = (isBrowsing: boolean): Completion[] => [
      ...(isBrowsing
        ? snippetOptions.slice(0, MAX_BROWSE_SUGGESTIONS)
        : snippetOptions),
      ...(isBrowsing ? fieldOptions.slice(0, MAX_BROWSE_FIELDS) : fieldOptions),
    ];
    return [
      keymap.of([
        {
          key: "Enter",
          run: (editorView: EditorView) => {
            // Insert the highlighted completion if the dropdown is open;
            // always swallow the key so no newline is inserted
            acceptCompletion(editorView);
            return true;
          },
        },
      ]),
      pythonLanguage,
      // Surface the suggestions dropdown whenever the empty field is
      // focused, clicked, or cleared — the empty state doubles as a
      // condition builder. The pointer-select case matters: a mouse click
      // emits a selection transaction that resets any completion the focus
      // just opened.
      EditorView.updateListener.of((update) => {
        if (!update.view.hasFocus || update.state.doc.length !== 0) {
          return;
        }
        if (
          update.focusChanged ||
          update.docChanged ||
          update.transactions.some((tr) => tr.isUserEvent("select.pointer"))
        ) {
          startCompletion(update.view);
        }
      }),
      EditorView.contentAttributes.of({
        "aria-label": ariaLabel,
        "aria-multiline": "false",
      }),
      autocompletion({
        override: [
          ...completionSources,
          createDSLFilterCompletionSource(staticOptions),
          ...(loadCompletionsOnce
            ? [createDSLFilterCompletionSource(loadCompletionsOnce)]
            : []),
        ],
        selectOnOpen: false,
        icons: false,
        tooltipClass: () => "dsl-filter-typeahead",
        // Suggestion rows show a prose label (and the DSL as `detail`), so
        // they render in the UI font rather than code font
        optionClass: (completion) =>
          completion.type === "text" ? "dsl-filter-suggestion" : "",
      }),
    ];
  }, [snippets, completions, loadCompletions, completionSources, ariaLabel]);

  // Validity attributes are applied directly to the contenteditable so
  // toggling them doesn't force a CodeMirror reconfigure
  useEffect(() => {
    const content = editorViewRef.current?.contentDOM;
    if (!content) {
      return;
    }
    content.setAttribute("aria-invalid", hasError ? "true" : "false");
    if (hasError || hasWarnings) {
      content.setAttribute("aria-describedby", errorId);
    } else {
      content.removeAttribute("aria-describedby");
    }
  }, [hasError, hasWarnings, errorId]);

  // Held as effect events so the validation effect below does not depend on
  // their identity. A caller passing an inline arrow would otherwise revalidate
  // on each of its renders, and a caller whose callback writes the URL would
  // re-enter itself. Neither should be a consumer's problem to avoid.
  const reportValidCondition = useEffectEvent(
    (args: DSLFilterValidConditionArgs<TValidationResult>) => {
      onValidCondition(args);
    }
  );
  const reportValidationFailed = useEffectEvent(
    (reason: DSLFilterValidationFailureReason) => {
      onValidationFailed?.(reason);
    }
  );
  const reportValidationState = useEffectEvent((isValid: boolean) => {
    onValidationStateChange?.(isValid);
  });

  useEffect(() => {
    let isCancelled = false;

    // The last validation no longer describes what's in the field — drop any
    // stale error so the field isn't flagged invalid mid-edit. An error only
    // shows once the current text has settled and failed validation.
    setErrorMessage(null);
    // Warnings likewise describe the previous text; clear them so an amber
    // nudge never lingers past the edit that would resolve it.
    setWarnings([]);

    // Whether this run settles the mount-time value. Read before the branches
    // below flip the ref: both settle paths report it, so consumers can tell
    // a seeded default apart from something applied while the field was up.
    const isInitialSettlement = !hasSettled.current;

    // An empty condition means "no filter" — resolve it here rather than
    // asking the validator about a blank (or whitespace-only) expression
    if (value.trim() === "") {
      // An empty mount is a settled field, so the next value is a typed one
      // and takes the debounce.
      hasSettled.current = true;
      reportValidationState(true);
      startTransition(() => {
        reportValidCondition({
          condition: "",
          validationResult: null,
          isInitialSettlement,
        });
      });
      return undefined;
    }

    reportValidationState(false);

    // Debounce so intermediate keystrokes neither hit the server nor flash
    // the field red while a valid expression is being typed. A non-empty value
    // at mount was not typed -- it arrives from a URL or a caller's default --
    // so it is validated at once, which is also what any consumer waiting on
    // the result to render is waiting for.
    const isExplicitRetry =
      previousValidationRetryKey.current !== validationRetryKey;
    previousValidationRetryKey.current = validationRetryKey;
    const delay =
      hasSettled.current && !isExplicitRetry ? VALIDATION_DEBOUNCE_MS : 0;
    hasSettled.current = true;
    const timeout = setTimeout(() => {
      validateCondition(value)
        .then((result) => {
          if (isCancelled) {
            return;
          }

          if (!result?.isValid) {
            setErrorMessage(result?.errorMessage ?? "");
            reportValidationState(false);
            reportValidationFailed("invalid");
          } else {
            setErrorMessage(null);
            setWarnings(result.warnings ?? []);
            reportValidationState(true);
            startTransition(() => {
              reportValidCondition({
                condition: value,
                validationResult: result,
                isInitialSettlement,
              });
            });
          }
        })
        .catch(() => {
          if (isCancelled) {
            return;
          }
          // Validation itself failed (e.g. a network error) — surface it
          // rather than leaving a normal-looking field whose filter is
          // silently never applied
          setErrorMessage("The condition could not be validated");
          reportValidationState(false);
          reportValidationFailed("transport");
        });
    }, delay);

    return () => {
      isCancelled = true;
      clearTimeout(timeout);
    };
  }, [value, validateCondition, validationRetryKey]);

  return (
    <div
      data-is-focused={isFocused}
      data-is-invalid={hasError}
      data-has-condition={hasCondition}
      className={classNames("dsl-filter-condition-field", className)}
      css={dslFilterFieldCSS}
    >
      <Flex direction="row" alignItems="center">
        <Icon svg={<Icons.ListFilter />} className="filter-icon" />
        <CodeMirror
          css={dslFilterCodeMirrorCSS}
          indentWithTab={false}
          basicSetup={basicSetupOptions}
          onCreateEditor={(editorView) => {
            editorViewRef.current = editorView;
          }}
          onFocus={() => {
            // Refresh the loaded completions each time the user returns to
            // the field — the underlying names may have changed since
            loadedCompletionsRef.current = null;
            setIsFocused(true);
          }}
          onBlur={() => setIsFocused(false)}
          value={value}
          onChange={onChange}
          height="36px"
          width="100%"
          theme={codeMirrorTheme}
          placeholder={placeholder}
          extensions={extensions}
        />
        {hasError ? (
          <TooltipTrigger delay={0}>
            <Pressable>
              <div
                role="button"
                tabIndex={0}
                className="error-badge"
                aria-label="Filter condition error"
              >
                <Icon svg={<Icons.AlertCircle />} color="danger" />
                <span className="error-badge__message">
                  {errorMessage || "Invalid filter condition"}
                </span>
              </div>
            </Pressable>
            <Tooltip placement="bottom end" css={dslFilterErrorTooltipCSS}>
              <Flex direction="row" gap="size-100" alignItems="start">
                <Icon svg={<Icons.AlertCircle />} color="danger" />
                <Flex direction="column" gap="size-25">
                  <Text size="S" weight="heavy">
                    Invalid filter condition
                  </Text>
                  {errorMessage ? (
                    <Text size="S" color="text-700">
                      {errorMessage}
                    </Text>
                  ) : null}
                </Flex>
              </Flex>
            </Tooltip>
          </TooltipTrigger>
        ) : null}
        {hasWarnings ? (
          <TooltipTrigger delay={0}>
            <Pressable>
              <div
                role="button"
                tabIndex={0}
                className="warning-badge"
                aria-label="Filter condition warning"
              >
                <Icon svg={<Icons.AlertTriangle />} color="warning" />
                <span className="warning-badge__message">
                  {warnings.length > 1
                    ? `${warnings.length} filter warnings`
                    : warnings[0].suggestion
                      ? `Did you mean ${warnings[0].suggestion}?`
                      : warnings[0].identifier
                        ? `Unrecognized field \`${warnings[0].identifier}\``
                        : "Filter warning"}
                </span>
              </div>
            </Pressable>
            <Tooltip placement="bottom end" css={dslFilterWarningTooltipCSS}>
              <Flex direction="row" gap="size-100" alignItems="start">
                <Icon svg={<Icons.AlertTriangle />} color="warning" />
                <Flex direction="column" gap="size-50">
                  <Text size="S" weight="heavy">
                    This filter may not match what you expect
                  </Text>
                  {warnings.map((warning, index) => (
                    <Text key={index} size="S" color="text-700">
                      {warning.message}
                    </Text>
                  ))}
                </Flex>
              </Flex>
            </Tooltip>
          </TooltipTrigger>
        ) : null}
        <button
          onClick={() => {
            onChange("");
            editorViewRef.current?.focus();
          }}
          className="button--reset clear-button"
          aria-label="Clear filter condition"
        >
          <Icon svg={<Icons.Close />} />
        </button>
      </Flex>
      <VisuallyHidden>
        <span id={errorId} role="status">
          {hasError
            ? `Invalid filter condition. ${errorMessage}`.trim()
            : hasWarnings
              ? warnings.map((warning) => warning.message).join(" ")
              : ""}
        </span>
      </VisuallyHidden>
    </div>
  );
}
