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
} from "./styles";

/**
 * The result of validating a DSL filter condition expression, typically
 * performed server-side.
 */
export type DSLFilterConditionValidationResult = {
  isValid: boolean;
  errorMessage?: string | null;
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

export type DSLFilterConditionFieldProps<
  TResult extends DSLFilterConditionValidationResult =
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
  validateCondition: (condition: string) => Promise<TResult | null | undefined>;
  /**
   * Callback when the condition passes validation. Receives whatever
   * `validateCondition` resolved to, so a caller that asks the server for more
   * than validity gets the rest of the answer without a channel of its own.
   * `null` for an empty condition, which is resolved here rather than by the
   * validator.
   */
  onValidCondition: (condition: string, result: TResult | null) => void;
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
  TResult extends DSLFilterConditionValidationResult,
>(props: DSLFilterConditionFieldProps<TResult>) {
  const {
    value,
    onChange,
    completions,
    snippets = defaultSnippets,
    loadCompletions,
    completionSources = defaultCompletionSources,
    validateCondition,
    onValidCondition,
    onValidationStateChange,
    placeholder = "filter condition",
    "aria-label": ariaLabel = "filter condition",
    className,
  } = props;
  const [isFocused, setIsFocused] = useState<boolean>(false);
  // null means the condition is not known to be invalid; the empty string
  // means invalid with no server-provided detail
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
    if (hasError) {
      content.setAttribute("aria-describedby", errorId);
    } else {
      content.removeAttribute("aria-describedby");
    }
  }, [hasError, errorId]);

  useEffect(() => {
    let isCancelled = false;

    // The last validation no longer describes what's in the field — drop any
    // stale error so the field isn't flagged invalid mid-edit. An error only
    // shows once the current text has settled and failed validation.
    setErrorMessage(null);

    // An empty condition means "no filter" — resolve it here rather than
    // asking the validator about a blank (or whitespace-only) expression
    if (value.trim() === "") {
      onValidationStateChange?.(true);
      startTransition(() => {
        onValidCondition("", null);
      });
      return;
    }

    onValidationStateChange?.(false);

    // Debounce so intermediate keystrokes neither hit the server nor flash
    // the field red while a valid expression is being typed
    const timeout = setTimeout(() => {
      validateCondition(value)
        .then((result) => {
          if (isCancelled) {
            return;
          }

          if (!result?.isValid) {
            setErrorMessage(result?.errorMessage ?? "");
            onValidationStateChange?.(false);
          } else {
            setErrorMessage(null);
            onValidationStateChange?.(true);
            startTransition(() => {
              onValidCondition(value, result);
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
          onValidationStateChange?.(false);
        });
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(timeout);
    };
  }, [value, validateCondition, onValidCondition, onValidationStateChange]);

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
          {hasError ? `Invalid filter condition. ${errorMessage}`.trim() : ""}
        </span>
      </VisuallyHidden>
    </div>
  );
}
