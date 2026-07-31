import type {
  Completion,
  CompletionSection,
  CompletionSource,
} from "@codemirror/autocomplete";
import {
  acceptCompletion,
  autocompletion,
  completionStatus,
  snippetCompletion,
  startCompletion,
} from "@codemirror/autocomplete";
import { python } from "@codemirror/lang-python";
import CodeMirror, {
  type BasicSetupOptions,
  EditorView,
  keymap,
} from "@uiw/react-codemirror";
import type { ReactNode } from "react";
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
  IconButton,
  Icons,
  Text,
  Tooltip,
  TooltipTrigger,
  VisuallyHidden,
} from "@phoenix/components";
import { PxiAnimatedGlyph } from "@phoenix/components/agent/PxiAnimatedGlyph";
import { PxiGlyph } from "@phoenix/components/agent/PxiGlyph";
import {
  PxiOutline,
  type PxiOutlineState,
} from "@phoenix/components/agent/PxiOutline";
import { pierreDark, pierreLight } from "@phoenix/components/code";
import { useTheme } from "@phoenix/contexts";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import { classNames } from "@phoenix/utils/classNames";

import { AISearchSettingsButton } from "./ai/AISearchSettingsButton";
import type { AISearchDSL } from "./ai/types";
import type { AISearchGenerateResult, AISearchStatus } from "./ai/useAISearch";
import { useAISearch } from "./ai/useAISearch";
import { createDSLFilterCompletionSource } from "./dslFilterConditionFieldUtils";
import {
  dslFilterAIOutlineCSS,
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

/**
 * Opts a filter field into AI search. The field then shows the AI search
 * settings entry point and — once the user enables the feature — a sparkle
 * toggle that switches the field into plain-English mode: prose input with
 * no DSL affordances, where Enter converts the query to DSL with the
 * configured model (on-device browser AI by default) and offers an undo.
 */
export type DSLFilterAISearchProps = {
  /**
   * The DSL description handed to the model — typically derived from the
   * field's own completions and snippets via `createAISearchDSL` so the
   * model's vocabulary can never drift from the typeahead's.
   */
  dsl: AISearchDSL;
  /**
   * Placeholder shown while the field is in plain-English mode, e.g.
   * "search spans in plain English". Falls back to a generic prompt.
   */
  placeholder?: string;
};

/**
 * The lifecycle of one natural-language → DSL conversion. `query` is the
 * user's original phrasing, kept so a finished (or failed) conversion can
 * always be undone back to it.
 */
type AISearchPhase =
  | { name: "idle" }
  | { name: "converting"; query: string }
  | { name: "generated"; query: string }
  | { name: "failed"; query: string; message: string };

const AI_SEARCH_IDLE: AISearchPhase = { name: "idle" };

/**
 * The resolved AI-search capability handed to the inner field. Assembled by
 * a wrapper component so the field itself never touches the preferences or
 * credentials contexts — a field without `aiSearch` renders with no
 * provider requirements at all.
 */
type AISearchRuntime = {
  /**
   * The user's AI-search preference. The settings entry point renders
   * regardless (it is how the feature gets enabled); the conversion
   * behaviors only engage when this is true.
   */
  isEnabled: boolean;
  status: AISearchStatus;
  downloadProgress: number;
  generate: (
    query: string,
    options?: { onDelta?: (partialExpression: string) => void }
  ) => Promise<AISearchGenerateResult>;
  cancel: () => void;
  placeholder?: string;
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
   * Opts the field into AI search — natural-language drafts convert to DSL
   * on Enter using the model configured in the AI search settings. The
   * feature stays invisible (beyond its settings entry point) until the
   * user enables it there.
   */
  aiSearch?: DSLFilterAISearchProps;
  /**
   * Accessible name for the condition input
   */
  "aria-label"?: string;
  className?: string;
};

/**
 * A danger badge in the field's control cluster whose tooltip carries the
 * full story — one shell shared by the validation error and the AI
 * conversion failure so the two read identically. `children` is the
 * tooltip's detail below the title.
 */
function ErrorBadge({
  ariaLabel,
  badgeMessage,
  title,
  children,
}: {
  ariaLabel: string;
  badgeMessage: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <TooltipTrigger delay={0}>
      <Pressable>
        <div
          role="button"
          tabIndex={0}
          className="error-badge"
          aria-label={ariaLabel}
        >
          <Icon svg={<Icons.AlertCircle />} color="danger" />
          <span className="error-badge__message">{badgeMessage}</span>
        </div>
      </Pressable>
      <Tooltip placement="bottom end" css={dslFilterErrorTooltipCSS}>
        <Flex direction="row" gap="size-100" alignItems="start">
          <Icon svg={<Icons.AlertCircle />} color="danger" />
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
 */
export function DSLFilterConditionField<
  TValidationResult extends DSLFilterConditionValidationResult,
>(props: DSLFilterConditionFieldProps<TValidationResult>) {
  const { aiSearch, ...rest } = props;
  if (aiSearch != null) {
    return (
      <DSLFilterConditionFieldWithAISearch {...rest} aiSearch={aiSearch} />
    );
  }
  return <DSLFilterConditionFieldImpl {...rest} />;
}

/**
 * Resolves the AI-search capability from the preferences and credentials
 * contexts, keeping those provider requirements out of the base field.
 */
function DSLFilterConditionFieldWithAISearch<
  TValidationResult extends DSLFilterConditionValidationResult,
>(
  props: Omit<DSLFilterConditionFieldProps<TValidationResult>, "aiSearch"> & {
    aiSearch: DSLFilterAISearchProps;
  }
) {
  const { aiSearch, ...rest } = props;
  const isEnabled = usePreferencesContext((state) => state.isAISearchEnabled);
  const { status, downloadProgress, generate, cancel } = useAISearch({
    dsl: aiSearch.dsl,
    validate: props.validateCondition,
  });
  return (
    <DSLFilterConditionFieldImpl
      {...rest}
      ai={{
        isEnabled,
        status,
        downloadProgress,
        generate,
        cancel,
        placeholder: aiSearch.placeholder,
      }}
    />
  );
}

function DSLFilterConditionFieldImpl<
  TValidationResult extends DSLFilterConditionValidationResult,
>(
  props: Omit<DSLFilterConditionFieldProps<TValidationResult>, "aiSearch"> & {
    ai?: AISearchRuntime;
  }
) {
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
    ai,
    "aria-label": ariaLabel = "filter condition",
    className,
  } = props;
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [aiPhase, setAIPhase] = useState<AISearchPhase>(AI_SEARCH_IDLE);
  // The sparkle toggle's state: whether the field is in plain-English mode.
  // Deliberately per-field and session-local — the mode describes what the
  // user is typing right now, not a durable preference.
  const [isAIMode, setIsAIMode] = useState<boolean>(false);
  const isAIActive = ai?.isEnabled === true;
  const isAIModeOn = isAIActive && isAIMode;
  const hasSettled = useRef<boolean>(false);
  const previousValidationRetryKey = useRef(validationRetryKey);
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

  // In plain-English mode every non-empty idle draft is a query waiting
  // for Enter — the state the "AI · ⏎" affordance points at
  const hasPendingAIQuery =
    isAIModeOn && aiPhase.name === "idle" && value.trim() !== "";
  const isConverting = aiPhase.name === "converting";
  // The validation effect keys on the phase *name* — keying on the phase
  // object would re-run validation on every object identity change
  const aiPhaseName = aiPhase.name;

  const handleChange = (nextValue: string) => {
    // Any real edit ends the post-conversion affordances — the text is the
    // user's again. Streamed updates echo back from the editor with the
    // value they were set to, so an identity check tells the two apart.
    if (aiPhase.name !== "idle" && !isConverting && nextValue !== value) {
      setAIPhase(AI_SEARCH_IDLE);
    }
    onChange(nextValue);
  };

  // Identifies the conversion whose resolution is still welcome. Clearing
  // the field bumps this so a cancelled run's "restore the query" behavior
  // can't clobber the clear; Escape cancels WITHOUT bumping, because there
  // the restoration is the point.
  const aiRunIdRef = useRef(0);

  const startAIConversion = (query: string) => {
    if (ai == null) {
      return;
    }
    const runId = ++aiRunIdRef.current;
    setAIPhase({ name: "converting", query });
    void ai.generate(query, { onDelta: onChange }).then((result) => {
      if (aiRunIdRef.current !== runId) {
        return;
      }
      if (result.outcome === "success") {
        onChange(result.condition);
        setAIPhase({ name: "generated", query });
        // The result is DSL, so the field returns to DSL mode to show it —
        // with completions and validation live for editing it. Undo flips
        // back to plain-English mode with the original query.
        setIsAIMode(false);
      } else if (result.outcome === "error") {
        onChange(query);
        setAIPhase({ name: "failed", query, message: result.message });
      } else {
        onChange(query);
        setAIPhase(AI_SEARCH_IDLE);
      }
    });
  };

  const undoAIConversion = (query: string) => {
    onChange(query);
    setAIPhase(AI_SEARCH_IDLE);
    setIsAIMode(true);
    editorViewRef.current?.focus();
  };

  const toggleAIMode = () => {
    if (isConverting) {
      // Leaving mid-conversion abandons the run; its cancelled resolution
      // restores the query
      ai?.cancel();
    } else if (aiPhase.name === "failed") {
      setAIPhase(AI_SEARCH_IDLE);
    }
    setIsAIMode(!isAIMode);
    editorViewRef.current?.focus();
  };

  // The CodeMirror keymap must stay referentially stable (see the
  // extensions memo below), so key handlers reach the current AI state
  // through this ref rather than closing over it
  const aiRuntimeRef = useRef<{
    maybeConvert: (currentText: string) => boolean;
    handleEscape: () => boolean;
  } | null>(null);
  useEffect(() => {
    aiRuntimeRef.current = {
      // The editor's own document is the query, not the `value` prop: a
      // consumer whose onChange defers the update (e.g. through
      // startTransition) can still be a render behind the keystroke that
      // preceded Enter, and converting -- or restoring on cancel -- a stale
      // draft would drop the user's last words
      maybeConvert: (currentText: string) => {
        if (!isAIModeOn || isConverting) {
          return false;
        }
        const query = currentText.trim();
        if (!query) {
          return false;
        }
        startAIConversion(query);
        return true;
      },
      handleEscape: () => {
        switch (aiPhase.name) {
          case "converting":
            ai?.cancel();
            return true;
          case "generated":
            undoAIConversion(aiPhase.query);
            return true;
          case "failed":
            setAIPhase(AI_SEARCH_IDLE);
            return true;
          default:
            return false;
        }
      },
    };
  });

  // A cached result from a previous loader no longer describes the data
  useEffect(() => {
    loadedCompletionsRef.current = null;
  }, [loadCompletions]);

  // The conversion keys work identically in both modes: with no completion
  // open, Enter hands the draft to `maybeConvert` (which only engages in
  // plain-English mode) and Escape walks back whatever AI search last did
  const conversionKeymap = useMemo(
    () =>
      keymap.of([
        {
          key: "Enter",
          run: (editorView: EditorView) => {
            // Insert the highlighted completion if the dropdown is open;
            // otherwise a plain-English draft converts via AI search.
            // Always swallow the key so no newline is inserted.
            if (!acceptCompletion(editorView)) {
              aiRuntimeRef.current?.maybeConvert(
                editorView.state.doc.toString()
              );
            }
            return true;
          },
        },
        {
          key: "Escape",
          run: (editorView: EditorView) => {
            // With the typeahead open, Escape belongs to it; otherwise it
            // walks back whatever AI search last did — cancels an in-flight
            // conversion, undoes a finished one, dismisses a failure
            if (completionStatus(editorView.state) !== null) {
              return false;
            }
            return aiRuntimeRef.current?.handleEscape() ?? false;
          },
        },
      ]),
    []
  );

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
  // Plain-English mode strips the field down to prose: no DSL language, no
  // typeahead — just the conversion keys and the accessible name. That
  // branch comes first so none of the DSL machinery is built while the
  // mode is on (a mode flip reconfigures the editor either way).
  const extensions = useMemo(() => {
    if (isAIModeOn) {
      return [conversionKeymap, contentAttributes];
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
    const staticOptions = (isBrowsing: boolean): Completion[] => [
      ...(isBrowsing
        ? snippetOptions.slice(0, MAX_BROWSE_SUGGESTIONS)
        : snippetOptions),
      ...(isBrowsing ? fieldOptions.slice(0, MAX_BROWSE_FIELDS) : fieldOptions),
    ];
    return [
      conversionKeymap,
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
    isAIModeOn,
    snippets,
    completions,
    loadCompletions,
    completionSources,
    conversionKeymap,
    contentAttributes,
  ]);

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

    // In plain-English mode the draft is the AI's input, not a DSL
    // expression — asking the validator about English only flags the field
    // red while the user is mid-thought. The same goes for the partial
    // expression streaming in during a conversion; the finished expression
    // validates normally once the conversion lands the field back in DSL
    // mode.
    if (isAIModeOn || aiPhaseName === "converting") {
      hasSettled.current = true;
      return undefined;
    }

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
  }, [value, validateCondition, validationRetryKey, isAIModeOn, aiPhaseName]);

  // The PXI treatment reflects how engaged AI search is: a resting stroke
  // while the field is in plain-English mode, the full animated glow while
  // a conversion is in flight. Fields without AI search stay permanently
  // idle, where the outline is invisible.
  const aiOutlineState: PxiOutlineState = isConverting
    ? "active"
    : isAIModeOn
      ? "eligible"
      : "idle";

  return (
    <PxiOutline
      isFullWidth
      state={aiOutlineState}
      shouldFlash
      css={dslFilterAIOutlineCSS}
    >
      <div
        data-is-focused={isFocused}
        data-is-invalid={hasError}
        data-has-condition={hasCondition}
        data-ai-mode={isAIModeOn}
        className={classNames("dsl-filter-condition-field", className)}
        css={dslFilterFieldCSS}
      >
        <Flex direction="row" alignItems="center">
          {isConverting ? (
            // While converting, the glyph thinks — the same wave animation
            // the Ask PXI nav button shows while it works
            <span className="filter-icon dsl-filter-condition-field__thinking-glyph">
              <PxiGlyph animation="wave-reveal" size={13} />
            </span>
          ) : isAIModeOn ? (
            <PxiAnimatedGlyph isIconSized className="filter-icon" />
          ) : (
            <Icon svg={<Icons.ListFilter />} className="filter-icon" />
          )}
          <CodeMirror
            css={dslFilterCodeMirrorCSS}
            indentWithTab={false}
            basicSetup={basicSetupOptions}
            readOnly={isConverting}
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
            onChange={handleChange}
            height="36px"
            width="100%"
            theme={codeMirrorTheme}
            placeholder={
              isAIModeOn
                ? (ai?.placeholder ??
                  "Ask in plain English — Enter converts to a filter")
                : placeholder
            }
            extensions={extensions}
          />
          <div className="dsl-filter-condition-field__controls">
            {hasError ? (
              <ErrorBadge
                ariaLabel="Filter condition error"
                badgeMessage={errorMessage || "Invalid filter condition"}
                title="Invalid filter condition"
              >
                {errorMessage ? (
                  <Text size="S" color="text-700">
                    {errorMessage}
                  </Text>
                ) : null}
              </ErrorBadge>
            ) : null}
            {hasPendingAIQuery ? (
              <span
                className="ai-badge"
                title="Press Enter to convert to a filter expression"
              >
                AI · ⏎
              </span>
            ) : null}
            {/* The thinking glyph carries the "working" signal; a badge
                only appears for the one state with real information — the
                first-use model download and its progress */}
            {isConverting && ai?.status === "downloading" ? (
              <span className="ai-badge">
                Downloading model…{" "}
                {Math.round((ai?.downloadProgress ?? 0) * 100)}%
              </span>
            ) : null}
            {aiPhase.name === "generated" ? (
              <span className="ai-badge">
                <TooltipTrigger delay={0}>
                  <Pressable>
                    <button
                      onClick={() => undoAIConversion(aiPhase.query)}
                      className="button--reset ai-undo-button"
                      aria-label="Undo AI conversion and restore your query"
                    >
                      Undo
                    </button>
                  </Pressable>
                  <Tooltip
                    placement="bottom end"
                    css={dslFilterErrorTooltipCSS}
                  >
                    <Flex direction="column" gap="size-25">
                      <Text size="S" weight="heavy">
                        Generated from “{aiPhase.query}”
                      </Text>
                      <Text size="S" color="text-700">
                        Edit the expression freely, or undo to get your words
                        back.
                      </Text>
                    </Flex>
                  </Tooltip>
                </TooltipTrigger>
              </span>
            ) : null}
            {aiPhase.name === "failed" ? (
              <ErrorBadge
                ariaLabel="AI search error"
                badgeMessage="Couldn’t convert to a filter"
                title="Couldn’t convert to a filter"
              >
                <Text size="S" color="text-700">
                  {aiPhase.message}
                </Text>
                <Text size="S" color="text-700">
                  Rephrase the request, or write the expression directly.
                </Text>
              </ErrorBadge>
            ) : null}
            {isAIActive ? (
              <TooltipTrigger delay={500}>
                <IconButton
                  size="XS"
                  aria-label="Plain-English search"
                  aria-pressed={isAIModeOn}
                  className="ai-mode-toggle"
                  onPress={toggleAIMode}
                >
                  <Icon svg={<Icons.Sparkles />} />
                </IconButton>
                <Tooltip placement="bottom end">
                  {isAIModeOn
                    ? "Switch back to the filter DSL"
                    : "Search in plain English"}
                </Tooltip>
              </TooltipTrigger>
            ) : null}
            {ai != null ? <AISearchSettingsButton /> : null}
            <IconButton
              size="XS"
              className="clear-button"
              aria-label="Clear filter condition"
              onPress={() => {
                // Invalidate any in-flight conversion so its cancelled
                // resolution can't restore the query over the clear
                aiRunIdRef.current++;
                if (isConverting) {
                  ai?.cancel();
                }
                setAIPhase(AI_SEARCH_IDLE);
                onChange("");
                editorViewRef.current?.focus();
              }}
            >
              <Icon svg={<Icons.Close />} />
            </IconButton>
          </div>
        </Flex>
        <VisuallyHidden>
          <span id={errorId} role="status">
            {hasError ? `Invalid filter condition. ${errorMessage}`.trim() : ""}
          </span>
          <span role="status">
            {isConverting
              ? "Converting to a filter expression"
              : aiPhase.name === "generated"
                ? "Filter expression generated. Press Escape to undo."
                : aiPhase.name === "failed"
                  ? `AI search failed. ${aiPhase.message}`
                  : ""}
          </span>
        </VisuallyHidden>
      </div>
    </PxiOutline>
  );
}
