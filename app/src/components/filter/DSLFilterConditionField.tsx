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
import {
  type Extension,
  type Range,
  StateEffect,
  StateField,
} from "@codemirror/state";
import { css } from "@emotion/react";
import CodeMirror, {
  type BasicSetupOptions,
  Decoration,
  type DecorationSet,
  EditorView,
  keymap,
} from "@uiw/react-codemirror";
import type { ReactNode, Ref } from "react";
import {
  startTransition,
  useEffect,
  useEffectEvent,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Pressable } from "react-aria";

import {
  Flex,
  Icon,
  IconButton,
  Icons,
  Text,
  Tooltip,
  TooltipTrigger,
  VisuallyHidden,
} from "@phoenix/components";
import { pierreDark, pierreLight } from "@phoenix/components/code";
import { useTheme } from "@phoenix/contexts";
import { classNames } from "@phoenix/utils/classNames";

import {
  createDSLFilterCompletionSource,
  type DSLFilterCompletionRequest,
} from "./dslFilterConditionFieldUtils";
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
  /** Non-blocking advisories on an otherwise-valid condition; the condition still applies. */
  warnings?: readonly string[] | null;
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
  /** Additional context shown when the suggestion is selected. */
  info?: string;
  /**
   * Ranks this snippet above its unboosted siblings in the dropdown. Within a
   * section CodeMirror orders equally-scored options alphabetically by label,
   * so array position decides only which snippets make the browse cut — this
   * is what decides where one lands once it has.
   */
  boost?: number;
};

const pythonLanguage = python();

const warningListCSS = css`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-25);
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

const suggestionsSection: CompletionSection = { name: "Suggestions", rank: 1 };
const fieldsSection: CompletionSection = { name: "Fields", rank: 3 };

/** The document range an invalid condition is blamed on, or null for none. */
export type DSLFilterErrorRange = { from: number; to: number };

const setErrorRangeEffect = StateEffect.define<DSLFilterErrorRange | null>();

const errorRangeMark = Decoration.mark({ class: "cm-dsl-filter-error-region" });

/**
 * Underlines the sub-expression an error was blamed on. Carried in editor
 * state rather than in the extensions array: reconfiguring CodeMirror on every
 * validation result would reset the open completion dropdown.
 */
const errorRangeField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, transaction) {
    let next = decorations.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (!effect.is(setErrorRangeEffect)) {
        continue;
      }
      const range = effect.value;
      const documentLength = transaction.state.doc.length;
      const marks: Range<Decoration>[] =
        range && range.from < range.to && range.to <= documentLength
          ? [errorRangeMark.range(range.from, range.to)]
          : [];
      next = Decoration.set(marks);
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

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
export const MAX_BROWSE_SUGGESTIONS = 5;
// Sized to fit a grain's whole core vocabulary, so the cap only trims
// data-derived names — a lower cap silently evicts the trailing core
// sections, which callers rank-order expecting all of them to be browsable.
const MAX_BROWSE_FIELDS = 30;

/**
 * How long a typed condition must sit still before it is validated. Tuned by
 * feel: long enough that a phrase being typed does not flash red, short enough
 * that a finished one applies without a wait.
 */
const VALIDATION_DEBOUNCE_MS = 250;

const defaultSnippets: DSLFilterSnippet[] = [];
const defaultCompletionSources: CompletionSource[] = [];
const defaultExtensions: Extension[] = [];

/**
 * The field is single-line, so every Enter variant is swallowed here and no
 * key can insert a newline. Enter first gives the typeahead its accept.
 * Keymaps composed in via the `extensions` prop mount ahead of this one, so
 * they can claim any of these keys before the built-in handling.
 */
const singleLineKeymap = keymap.of([
  {
    key: "Enter",
    run: (editorView: EditorView) => {
      acceptCompletion(editorView);
      return true;
    },
  },
  { key: "Mod-Enter", run: () => true },
  { key: "Shift-Enter", run: () => true },
]);

function snippetToCompletion({
  label,
  snippet,
  info,
  boost,
}: DSLFilterSnippet): Completion {
  return snippetCompletion(snippet, {
    label,
    detail: snippet.replace(/\$\{([^{}]*)\}/g, "$1"),
    info,
    type: "text",
    section: suggestionsSection,
    boost,
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

/**
 * The field's imperative surface, for compositions that move focus as part
 * of flows the field itself cannot see (e.g. a mode toggle rendered in the
 * control cluster).
 */
export type DSLFilterConditionFieldRef = {
  /**
   * Focuses the editor. `selectAll` puts the whole draft under the caret so
   * the next keystroke replaces it; without it the editor's last selection
   * is restored.
   */
  focus: (options?: { selectAll?: boolean }) => void;
};

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
   * via fuzzy matching as the user types. Array order decides which snippets
   * make that cut, not how they read once shown — set `boost` for that.
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
   * Replaces `completions` and `snippets` at cursor positions where a
   * different vocabulary applies — e.g. inside a comprehension, where only the
   * loop variable's element fields can be written. Return null to use the
   * default vocabulary, or an array (possibly empty) to use it instead for
   * this position. `completionSources` are unaffected. Pass a referentially
   * stable function.
   */
  getContextualCompletions?: (
    request: DSLFilterCompletionRequest
  ) => Completion[] | null;
  /**
   * Locates the sub-expression to blame for a validation error, so the field
   * can underline it instead of flagging the whole condition. Returning null
   * (or omitting this) leaves the error unanchored. Pass a referentially
   * stable function.
   */
  getErrorRange?: (condition: string) => DSLFilterErrorRange | null;
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
   * What kind of text the field is holding. The default `"dsl"` is the full
   * filter field: language, typeahead, validation. `"prose"` strips every
   * DSL affordance down to a single-line prose input in the same chrome —
   * sans-serif text, no typeahead, and no validation (prose is not an
   * expression, and the last reported validation state stands, since the
   * applied condition hasn't changed). Compositions that repurpose the
   * field for natural-language input switch to it.
   */
  variant?: "dsl" | "prose";
  /**
   * Extra CodeMirror extensions, mounted ahead of the field's own so a
   * composed keymap can claim keys (Enter, Escape, Mod-Enter) before the
   * built-in handling. Pass a referentially stable array — a new identity
   * reconfigures the editor, resetting in-flight completion state.
   */
  extensions?: Extension[];
  /**
   * Renders the editor read-only while true. The field chrome (controls,
   * badges) stays interactive.
   */
  isReadOnly?: boolean;
  /**
   * Replaces the leading filter icon — e.g. a composition marking a mode
   * with its own glyph. Rendered in the same slot; give it the
   * `filter-icon` class to inherit the slot's spacing.
   */
  leadingVisual?: ReactNode;
  /**
   * Additional controls rendered in the field's control cluster, between
   * the validation error badge and the clear button.
   */
  extraControls?: ReactNode;
  /**
   * Additional screen-reader announcements, rendered into the field's
   * visually hidden region beside the validation status — compositions
   * announce their own state changes here (as `role="status"` content)
   * rather than mounting a second live region of their own.
   */
  extraStatus?: ReactNode;
  /**
   * Reports focus entering/leaving the editor, for compositions whose
   * affordances depend on whether the user is in the field.
   */
  onFocusChange?: (isFocused: boolean) => void;
  /**
   * Called when the clear button is pressed, before the field emits the
   * empty value — the hook for compositions to walk back any state of
   * their own that described the cleared text.
   */
  onClear?: () => void;
  ref?: Ref<DSLFilterConditionFieldRef>;
  /**
   * Accessible name for the condition input
   */
  "aria-label"?: string;
  className?: string;
};

/**
 * A status badge in the field's control cluster whose tooltip carries the
 * full story — one shell shared by the validation error, validator-supplied
 * warnings, and composed error states (e.g. an AI conversion failure) so
 * they read identically. `children` is the tooltip's detail below the
 * title. `severity` defaults to danger; warnings render the same shell in
 * the warning palette.
 */
export function DSLFilterErrorBadge({
  ariaLabel,
  badgeMessage,
  title,
  severity = "danger",
  children,
}: {
  ariaLabel: string;
  badgeMessage: string;
  title: string;
  severity?: "danger" | "warning";
  children?: ReactNode;
}) {
  return (
    <TooltipTrigger delay={0}>
      <Pressable>
        <div
          role="button"
          tabIndex={0}
          className="error-badge"
          data-severity={severity}
          aria-label={ariaLabel}
        >
          <Icon svg={<Icons.AlertCircle />} color={severity} />
          <span className="error-badge__message">{badgeMessage}</span>
        </div>
      </Pressable>
      <Tooltip placement="bottom end" css={dslFilterErrorTooltipCSS}>
        <Flex direction="row" gap="size-100" alignItems="start">
          <Icon svg={<Icons.AlertCircle />} color={severity} />
          <Flex direction="column" gap="size-25">
            <Text size="S" weight="heavy">
              {title}
            </Text>
            {children}
          </Flex>
        </Flex>
      </Tooltip>
    </TooltipTrigger>
  );
}

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
 *
 * The field knows nothing beyond the DSL. Richer behaviors compose in from
 * outside through `extensions` (keymaps), `variant` (prose input in the same
 * chrome), the `leadingVisual`/`extraControls` slots, and the imperative
 * `ref` — see `AIQueryDSLFilterField` for the AI-query composition.
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
    getContextualCompletions,
    getErrorRange,
    validateCondition,
    onValidCondition,
    onValidationFailed,
    validationRetryKey,
    onValidationStateChange,
    placeholder = "filter condition",
    variant = "dsl",
    extensions: composedExtensions = defaultExtensions,
    isReadOnly = false,
    leadingVisual,
    extraControls,
    extraStatus,
    onFocusChange,
    onClear,
    ref,
    "aria-label": ariaLabel = "filter condition",
    className,
  } = props;
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const hasSettled = useRef<boolean>(false);
  const previousValidationRetryKey = useRef(validationRetryKey);
  // null means the condition is not known to be invalid; the empty string
  // means invalid with no server-provided detail
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<readonly string[]>([]);
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "light" ? pierreLight : pierreDark;

  const editorViewRef = useRef<EditorView | null>(null);
  // Caches the loadCompletions result so the dropdown doesn't refetch every
  // time it opens; invalidated on focus so names created elsewhere in the
  // app (e.g. a new annotation) appear when the user returns to filter
  const loadedCompletionsRef = useRef<Promise<Completion[]> | null>(null);
  const statusId = useId();

  const hasError = errorMessage !== null;
  const hasWarnings = warnings.length > 0;
  const hasCondition = value !== "";

  useImperativeHandle(
    ref,
    () => ({
      // Selection is dispatched separately from focus because `focus()`
      // alone restores whatever selection the editor last had
      focus: ({ selectAll = false }: { selectAll?: boolean } = {}) => {
        const editorView = editorViewRef.current;
        if (editorView == null) {
          return;
        }
        editorView.focus();
        if (selectAll) {
          editorView.dispatch({
            selection: { anchor: 0, head: editorView.state.doc.length },
          });
        }
      },
    }),
    []
  );

  // A cached result from a previous loader no longer describes the data
  useEffect(() => {
    loadedCompletionsRef.current = null;
  }, [loadCompletions]);

  const contentAttributes = useMemo(
    () =>
      EditorView.contentAttributes.of({
        "aria-label": ariaLabel,
        "aria-multiline": "false",
      }),
    [ariaLabel]
  );

  // The extensions must be referentially stable across renders — a new
  // array causes a CodeMirror reconfigure, which resets the in-flight
  // completion state (e.g. the dropdown opened by focusing the field).
  // The prose variant strips the field down to prose input: no DSL
  // language, no typeahead — just the composed keymaps and the accessible
  // name. That branch comes first so none of the DSL machinery is built
  // while the variant is on (a variant flip reconfigures the editor either
  // way).
  const extensions = useMemo(() => {
    if (variant === "prose") {
      return [...composedExtensions, singleLineKeymap, contentAttributes];
    }
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
    const staticOptions = (
      request: DSLFilterCompletionRequest
    ): Completion[] => {
      const contextualOptions = getContextualCompletions?.(request);
      if (contextualOptions) {
        return request.isBrowsing
          ? contextualOptions.slice(0, MAX_BROWSE_FIELDS)
          : contextualOptions;
      }
      return [
        ...(request.isBrowsing
          ? snippetOptions.slice(0, MAX_BROWSE_SUGGESTIONS)
          : snippetOptions),
        ...(request.isBrowsing
          ? fieldOptions.slice(0, MAX_BROWSE_FIELDS)
          : fieldOptions),
      ];
    };
    return [
      ...composedExtensions,
      singleLineKeymap,
      errorRangeField,
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
      contentAttributes,
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
  }, [
    variant,
    composedExtensions,
    snippets,
    completions,
    loadCompletions,
    completionSources,
    getContextualCompletions,
    contentAttributes,
  ]);

  // Anchor the error to the sub-expression it came from once validation has
  // settled; a dispatched effect rather than a reconfigure, so an open
  // dropdown survives.
  useEffect(() => {
    const editorView = editorViewRef.current;
    if (!editorView) {
      return;
    }
    const range = hasError ? (getErrorRange?.(value) ?? null) : null;
    editorView.dispatch({ effects: setErrorRangeEffect.of(range) });
  }, [hasError, value, getErrorRange]);

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
    // stale error or warnings so the field isn't flagged mid-edit. Status
    // only shows once the current text has settled and been validated.
    setErrorMessage(null);
    setWarnings([]);

    // Whether this run settles the mount-time value. Read before the branches
    // below flip the ref: both settle paths report it, so consumers can tell
    // a seeded default apart from something applied while the field was up.
    const isInitialSettlement = !hasSettled.current;

    // Prose is not a DSL expression, so nothing in this variant settles a
    // condition: asking the validator about the text only flags the field
    // red while the user is mid-thought, and an emptied draft is a blank
    // question, not a request to clear the applied filter. Checked before
    // the empty branch below for exactly that reason. The draft still
    // reports not-valid, as any unvalidated text does — a consumer must
    // never pair prose with a passing validity (e.g. advertising the raw
    // draft as the active filter).
    if (variant === "prose") {
      hasSettled.current = true;
      reportValidationState(false);
      return undefined;
    }

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
            setWarnings([]);
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
          setWarnings([]);
          reportValidationState(false);
          reportValidationFailed("transport");
        });
    }, delay);

    return () => {
      isCancelled = true;
      clearTimeout(timeout);
    };
  }, [value, validateCondition, validationRetryKey, variant]);

  return (
    <div
      data-is-focused={isFocused}
      data-is-invalid={hasError}
      data-is-warning={!hasError && hasWarnings}
      data-has-condition={hasCondition}
      data-variant={variant}
      className={classNames("dsl-filter-condition-field", className)}
      css={dslFilterFieldCSS}
    >
      <Flex direction="row" alignItems="center">
        {leadingVisual ?? (
          <Icon svg={<Icons.ListFilter />} className="filter-icon" />
        )}
        <CodeMirror
          css={dslFilterCodeMirrorCSS}
          indentWithTab={false}
          basicSetup={basicSetupOptions}
          readOnly={isReadOnly}
          onCreateEditor={(editorView) => {
            editorViewRef.current = editorView;
          }}
          onFocus={() => {
            // Refresh the loaded completions each time the user returns to
            // the field — the underlying names may have changed since
            loadedCompletionsRef.current = null;
            setIsFocused(true);
            onFocusChange?.(true);
          }}
          onBlur={() => {
            setIsFocused(false);
            onFocusChange?.(false);
          }}
          value={value}
          onChange={onChange}
          height="36px"
          width="100%"
          theme={codeMirrorTheme}
          placeholder={placeholder}
          extensions={extensions}
        />
        <div className="dsl-filter-condition-field__controls">
          {hasError || hasWarnings ? (
            <DSLFilterErrorBadge
              severity={hasError ? "danger" : "warning"}
              ariaLabel={
                hasError ? "Filter condition error" : "Filter condition warning"
              }
              badgeMessage={
                hasError
                  ? errorMessage || "Invalid filter condition"
                  : warnings[0]
              }
              title={
                hasError
                  ? "Invalid filter condition"
                  : "Filter condition warning"
              }
            >
              {hasError ? (
                errorMessage ? (
                  <Text size="S" color="text-700">
                    {errorMessage}
                  </Text>
                ) : null
              ) : (
                <ul css={warningListCSS}>
                  {warnings.map((warning, index) => (
                    <li key={`${warning}-${index}`}>
                      <Text size="S" color="text-700">
                        {warning}
                      </Text>
                    </li>
                  ))}
                </ul>
              )}
            </DSLFilterErrorBadge>
          ) : null}
          {extraControls}
          <IconButton
            size="XS"
            className="clear-button"
            aria-label="Clear filter condition"
            onPress={() => {
              onClear?.();
              onChange("");
              editorViewRef.current?.focus();
            }}
          >
            <Icon svg={<Icons.Close />} />
          </IconButton>
        </div>
      </Flex>
      <VisuallyHidden>
        <span id={statusId} role="status">
          {hasError
            ? `Invalid filter condition. ${errorMessage}`.trim()
            : warnings.join(" ")}
        </span>
        {extraStatus}
      </VisuallyHidden>
    </div>
  );
}
