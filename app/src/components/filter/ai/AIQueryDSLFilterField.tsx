import { acceptCompletion, completionStatus } from "@codemirror/autocomplete";
import type { EditorView } from "@uiw/react-codemirror";
import { keymap } from "@uiw/react-codemirror";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Icon,
  IconButton,
  Icons,
  Text,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";
import { PxiAnimatedGlyph } from "@phoenix/components/agent/PxiAnimatedGlyph";
import { PxiGlyph } from "@phoenix/components/agent/PxiGlyph";
import {
  AIOutline,
  type AIOutlineState,
} from "@phoenix/components/ai/AIOutline";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import { useModifierKey } from "@phoenix/hooks/useModifierKey";

import {
  DSLFilterConditionField,
  type DSLFilterConditionFieldProps,
  type DSLFilterConditionFieldRef,
  type DSLFilterConditionValidationResult,
  DSLFilterErrorBadge,
} from "../DSLFilterConditionField";
import { AIQuerySettingsButton } from "./AIQuerySettingsButton";
import { aiQueryFilterFieldCSS } from "./styles";
import type { AIQueryDSL } from "./types";
import { useAIQuery } from "./useAIQuery";

/**
 * Configures the AI-query composition. The field then shows the AI query
 * settings entry point and — while the feature is enabled (the default) —
 * a sparkle toggle that switches the field into plain-English mode: prose
 * input with no DSL affordances, where Enter converts the query to DSL
 * with the configured model (on-device browser AI by default) and offers
 * an undo. From DSL mode, Mod-Enter hands the current draft to AI query
 * directly.
 */
export type DSLFilterAIQueryProps = {
  /**
   * The DSL description handed to the model — typically derived from the
   * field's own completions and snippets via `createAIQueryDSL` so the
   * model's vocabulary can never drift from the typeahead's.
   */
  dsl: AIQueryDSL;
  /**
   * Placeholder shown while the field is in plain-English mode, e.g.
   * "describe spans in plain English". Falls back to a generic prompt.
   */
  placeholder?: string;
};

/**
 * The lifecycle of one natural-language → DSL conversion. `query` is the
 * user's original phrasing, kept so a finished (or failed) conversion can
 * always be undone back to it.
 */
type AIQueryPhase =
  | { name: "idle" }
  | { name: "converting"; query: string }
  | { name: "generated"; query: string }
  | { name: "failed"; query: string; message: string };

const AI_QUERY_IDLE: AIQueryPhase = { name: "idle" };

/**
 * The semantic operations the AI-query keys dispatch to. Filled in each
 * render by the component, read through a ref so the keymap extension
 * itself stays referentially stable (a new extension identity would
 * reconfigure the editor).
 */
type AIQueryKeyHandlers = {
  /**
   * Enter with no completion open: converts a plain-English draft. Only
   * engages while the field is in plain-English mode.
   */
  convertDraft: (currentText: string) => boolean;
  /** Mod-Enter in either mode: hands the current draft to AI query. */
  queryWithAI: (currentText: string) => boolean;
  /** Escape: walks back whatever AI query last did. */
  escape: () => boolean;
};

export type AIQueryDSLFilterFieldProps<
  TValidationResult extends DSLFilterConditionValidationResult =
    DSLFilterConditionValidationResult,
> = Omit<
  DSLFilterConditionFieldProps<TValidationResult>,
  | "variant"
  | "extensions"
  | "isReadOnly"
  | "leadingVisual"
  | "extraControls"
  | "extraStatus"
  | "onFocusChange"
  | "onClear"
  | "ref"
> & {
  aiQuery: DSLFilterAIQueryProps;
};

/**
 * The DSL filter condition field with AI query composed on top, entirely
 * through the base field's composition surface: a keymap via `extensions`,
 * the prose `variant` for plain-English mode, the `leadingVisual` and
 * `extraControls` slots for the glyphs and AI controls, and the imperative
 * `ref` for focus flows. The base field itself knows nothing about AI.
 */
export function AIQueryDSLFilterField<
  TValidationResult extends DSLFilterConditionValidationResult,
>(props: AIQueryDSLFilterFieldProps<TValidationResult>) {
  const { aiQuery, value, onChange, validateCondition, placeholder, ...rest } =
    props;
  // The user's AI-query preference. The settings entry point renders
  // regardless (it is how the feature gets enabled); the conversion
  // behaviors only engage when this is true.
  const isAIActive = usePreferencesContext((state) => state.isAIQueryEnabled);
  const { status, downloadProgress, generate, cancel } = useAIQuery({
    dsl: aiQuery.dsl,
    validate: validateCondition,
  });
  const modifierKey = useModifierKey();

  const [aiPhase, setAIPhase] = useState<AIQueryPhase>(AI_QUERY_IDLE);
  // The sparkle toggle's state: whether the field is in plain-English mode.
  // Deliberately per-field and session-local — the mode describes what the
  // user is typing right now, not a durable preference.
  const [isAIMode, setIsAIMode] = useState<boolean>(false);
  const [isFieldFocused, setIsFieldFocused] = useState<boolean>(false);
  const isAIModeOn = isAIActive && isAIMode;
  const isConverting = aiPhase.name === "converting";

  const fieldRef = useRef<DSLFilterConditionFieldRef | null>(null);

  // A non-empty idle draft is a query waiting for its conversion key: in
  // plain-English mode that is Enter; in DSL mode, Mod-Enter — hinted only
  // while the user is actually typing (focused), so an applied filter at
  // rest doesn't carry a badge.
  const hasIdleDraft =
    isAIActive && aiPhase.name === "idle" && value.trim() !== "";
  const conversionHint = !hasIdleDraft
    ? null
    : isAIModeOn
      ? {
          title: "Press Enter to convert to a filter expression",
          label: "AI · ⏎",
        }
      : isFieldFocused
        ? {
            title: `Press ${modifierKey}+Enter to query with AI`,
            label: `AI · ${modifierKey === "Cmd" ? "⌘" : "Ctrl"}⏎`,
          }
        : null;

  // Every change this composition makes (typing passed through, AI
  // streaming, restores) goes through `emitChange` so its round-trip back
  // through the controlled `value` prop can be told apart from a caller
  // setting the value from outside (see the external-set effect below).
  // An ordered queue rather than a per-string count: a consumer that
  // defers its update (e.g. through startTransition) can deliver several
  // pending emissions across renders — or coalesce intermediate ones away
  // entirely, which the echo of a later emission then purges.
  const pendingInternalChangesRef = useRef<string[]>([]);
  // The value the consumer is expected to (eventually) render — the last
  // emission, or the last externally set value. Emitting it again cannot
  // produce another echo (React bails out on same-value state updates), so
  // such emissions must not enqueue: the success handler re-emits the final
  // streamed delta, and duplicate deltas normalize to the same expression.
  const expectedValueRef = useRef<string>(value);
  const emitChange = (nextValue: string) => {
    if (nextValue !== expectedValueRef.current) {
      expectedValueRef.current = nextValue;
      pendingInternalChangesRef.current.push(nextValue);
    }
    onChange(nextValue);
  };

  const handleChange = (nextValue: string) => {
    // Any real edit ends the post-conversion affordances — the text is the
    // user's again. Streamed updates echo back from the editor with the
    // value they were set to, so an identity check tells the two apart.
    if (aiPhase.name !== "idle" && !isConverting && nextValue !== value) {
      setAIPhase(AI_QUERY_IDLE);
    }
    emitChange(nextValue);
  };

  // Identifies the conversion whose resolution is still welcome. Clearing
  // the field bumps this so a cancelled run's "restore the query" behavior
  // can't clobber the clear; Escape cancels WITHOUT bumping, because there
  // the restoration is the point.
  const aiRunIdRef = useRef(0);

  // A passing verdict the conversion already obtained for the condition it
  // produced — consumed by the wrapped validator below so settling the
  // generated expression doesn't re-ask the server the question it just
  // answered
  const prevalidatedRef = useRef<{
    condition: string;
    validationResult: TValidationResult;
  } | null>(null);

  // The validator handed to the base field: answers from the conversion's
  // own verdict when asked about exactly the condition it produced, and
  // defers to the consumer's validator otherwise. The field still applies
  // its usual settle debounce before asking — only the round-trip is saved.
  const validateWithPrevalidation = useCallback(
    (condition: string) => {
      const prevalidated = prevalidatedRef.current;
      prevalidatedRef.current = null;
      if (prevalidated !== null && prevalidated.condition === condition) {
        return Promise.resolve(prevalidated.validationResult);
      }
      return validateCondition(condition);
    },
    [validateCondition]
  );

  const startAIConversion = (query: string) => {
    const runId = ++aiRunIdRef.current;
    setAIPhase({ name: "converting", query });
    void generate(query, { onDelta: emitChange }).then((result) => {
      if (aiRunIdRef.current !== runId) {
        return;
      }
      if (result.outcome === "success") {
        prevalidatedRef.current = result.validation?.isValid
          ? { condition: result.condition, validationResult: result.validation }
          : null;
        emitChange(result.condition);
        setAIPhase({ name: "generated", query });
        // The result is DSL, so the field returns to DSL mode to show it —
        // with completions and validation live for editing it. Undo flips
        // back to plain-English mode with the original query.
        setIsAIMode(false);
      } else if (result.outcome === "error") {
        emitChange(query);
        setAIPhase({ name: "failed", query, message: result.message });
      } else {
        emitChange(query);
        setAIPhase(AI_QUERY_IDLE);
      }
    });
  };

  const undoAIConversion = (query: string) => {
    emitChange(query);
    setAIPhase(AI_QUERY_IDLE);
    setIsAIMode(true);
    // The point of undo is to get the query back for editing, so the caret
    // stays put rather than selecting what the user just asked to restore
    fieldRef.current?.focus();
  };

  const toggleAIMode = () => {
    if (isConverting) {
      // Mid-conversion the toggle cancels rather than switches modes: the
      // cancelled resolution restores the query into plain-English mode,
      // where it stays a question. Flipping to DSL here would strand that
      // English prose in front of the DSL validator, flagging as invalid
      // text the user never claimed was an expression.
      cancel();
      return;
    }
    if (aiPhase.name === "failed") {
      setAIPhase(AI_QUERY_IDLE);
    }
    const isTurningAIModeOn = !isAIMode;
    setIsAIMode(isTurningAIModeOn);
    // Turning the mode on selects the draft: whatever is in the field is DSL,
    // and the user is switching modes to ask a question instead. Turning it
    // off leaves the caret alone — that text is the expression being edited.
    fieldRef.current?.focus({ selectAll: isTurningAIModeOn });
  };

  const handleExternalValueSet = useEffectEvent(() => {
    if (!isAIMode && aiPhase.name === "idle") {
      return;
    }
    // The incoming value is a condition being applied, not the user's
    // draft — abandon whatever the AI flow was doing (the run-id bump keeps
    // a cancelled conversion's restore from clobbering the new value) and
    // return to DSL mode so the condition validates and applies normally.
    aiRunIdRef.current += 1;
    cancel();
    setAIPhase(AI_QUERY_IDLE);
    setIsAIMode(false);
  });

  // Tells the value round-tripping back from this composition's own
  // emissions apart from a caller setting it from outside — the agent's
  // filter action, a recent-search apply, a URL-driven update. Every internal
  // path is covered by `emitChange`: the base field surfaces typing and
  // its clear through `onChange`, and the AI flows emit directly.
  useEffect(() => {
    const pending = pendingInternalChangesRef.current;
    const index = pending.indexOf(value);
    if (index !== -1) {
      // Consume the echoed emission and everything queued before it: the
      // consumer renders its updates in dispatch order, so earlier entries
      // it skipped were coalesced away and will never echo.
      pending.splice(0, index + 1);
      return;
    }
    // An external set supersedes any internal emission still in flight —
    // and resets what the next emission compares itself against.
    pending.length = 0;
    expectedValueRef.current = value;
    handleExternalValueSet();
  }, [value]);

  // The keymap extension must stay referentially stable (a new identity
  // reconfigures the editor), so key handlers reach the current AI state
  // through this ref rather than closing over it
  const keyHandlersRef = useRef<AIQueryKeyHandlers | null>(null);
  useEffect(() => {
    keyHandlersRef.current = {
      // The editor's own document is the query, not the `value` prop: a
      // consumer whose onChange defers the update (e.g. through
      // startTransition) can still be a render behind the keystroke that
      // preceded Enter, and converting -- or restoring on cancel -- a stale
      // draft would drop the user's last words
      convertDraft: (currentText: string) => {
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
      // Mod-Enter's path: converts the draft regardless of mode. From DSL
      // mode the field first flips into plain-English mode so the draft is
      // treated as a question — notably, a failed conversion then restores
      // the query without validating English as a DSL expression.
      queryWithAI: (currentText: string) => {
        if (!isAIActive || isConverting) {
          return false;
        }
        const query = currentText.trim();
        if (!query) {
          return false;
        }
        setIsAIMode(true);
        startAIConversion(query);
        return true;
      },
      escape: () => {
        switch (aiPhase.name) {
          case "converting":
            cancel();
            return true;
          case "generated":
            undoAIConversion(aiPhase.query);
            return true;
          case "failed":
            setAIPhase(AI_QUERY_IDLE);
            return true;
          default:
            return false;
        }
      },
    };
  });

  // The conversion keys work identically in both modes: with no completion
  // open, Enter hands the draft to `convertDraft` (which only engages in
  // plain-English mode), Mod-Enter hands it to AI query from either mode,
  // and Escape walks back whatever AI query last did. Mounted ahead of the
  // base field's own keymap via the `extensions` prop, so these bindings
  // win.
  const aiKeymap = useMemo(
    () =>
      keymap.of([
        {
          key: "Enter",
          run: (editorView: EditorView) => {
            // Insert the highlighted completion if the dropdown is open;
            // otherwise a plain-English draft converts via AI query.
            // Always swallow the key so no newline is inserted.
            if (!acceptCompletion(editorView)) {
              keyHandlersRef.current?.convertDraft(
                editorView.state.doc.toString()
              );
            }
            return true;
          },
        },
        {
          key: "Mod-Enter",
          run: (editorView: EditorView) => {
            keyHandlersRef.current?.queryWithAI(
              editorView.state.doc.toString()
            );
            // Swallow regardless: an unhandled modifier-Enter must not fall
            // through and insert a newline into a single-line field
            return true;
          },
        },
        {
          key: "Escape",
          run: (editorView: EditorView) => {
            // With the typeahead open, Escape belongs to it; otherwise it
            // walks back whatever AI query last did — cancels an in-flight
            // conversion, undoes a finished one, dismisses a failure
            if (completionStatus(editorView.state) !== null) {
              return false;
            }
            return keyHandlersRef.current?.escape() ?? false;
          },
        },
      ]),
    []
  );
  const fieldExtensions = useMemo(() => [aiKeymap], [aiKeymap]);

  // In plain-English mode the draft is the AI's input, not a DSL
  // expression, and during a conversion the field holds the partial
  // expression streaming in — the prose variant keeps the base field from
  // validating either. The finished expression validates normally once the
  // conversion lands the field back in DSL mode.
  const isProse = isAIModeOn || isConverting;

  // The AI treatment reflects how engaged AI query is: a resting stroke
  // while the field is in plain-English mode, the full animated glow while
  // a conversion is in flight.
  const aiOutlineState: AIOutlineState = isConverting
    ? "active"
    : isAIModeOn
      ? "eligible"
      : "idle";

  return (
    <AIOutline
      isFullWidth
      state={aiOutlineState}
      shouldFlash
      css={aiQueryFilterFieldCSS}
    >
      <DSLFilterConditionField<TValidationResult>
        {...rest}
        ref={fieldRef}
        value={value}
        onChange={handleChange}
        validateCondition={validateWithPrevalidation}
        variant={isProse ? "prose" : "dsl"}
        isReadOnly={isConverting}
        extensions={fieldExtensions}
        onFocusChange={setIsFieldFocused}
        onClear={() => {
          // Invalidate any in-flight conversion so its cancelled
          // resolution can't restore the query over the clear
          aiRunIdRef.current++;
          if (isConverting) {
            cancel();
          }
          setAIPhase(AI_QUERY_IDLE);
          // Clear resets the whole field, mode included: the emptied value
          // then settles in DSL mode, which is what actually un-applies the
          // active filter — an empty prose draft deliberately doesn't.
          setIsAIMode(false);
        }}
        placeholder={
          isProse
            ? (aiQuery.placeholder ?? "describe what you are looking for")
            : placeholder
        }
        leadingVisual={
          isConverting ? (
            // While converting, the glyph thinks — the same wave animation
            // the assistant's nav button shows while it works
            <span className="filter-icon ai-query-filter-field__thinking-glyph">
              <PxiGlyph animation="wave-reveal" size={13} />
            </span>
          ) : isAIModeOn ? (
            <PxiAnimatedGlyph isIconSized className="filter-icon" />
          ) : undefined
        }
        extraControls={
          <>
            {conversionHint ? (
              <span className="ai-badge" title={conversionHint.title}>
                {conversionHint.label}
              </span>
            ) : null}
            {/* The thinking glyph carries the "working" signal; a badge
                only appears for the one state with real information — the
                first-use model download and its progress */}
            {isConverting && status === "downloading" ? (
              <span className="ai-badge">
                Downloading model… {Math.round(downloadProgress * 100)}%
              </span>
            ) : null}
            {aiPhase.name === "generated" ? (
              <span className="ai-badge">
                <button
                  onClick={() => undoAIConversion(aiPhase.query)}
                  className="button--reset ai-undo-button"
                  aria-label="Undo AI conversion and restore your query"
                >
                  Undo
                </button>
              </span>
            ) : null}
            {aiPhase.name === "failed" ? (
              <DSLFilterErrorBadge
                ariaLabel="AI query error"
                badgeMessage="Couldn’t convert to a filter"
                title="Couldn’t convert to a filter"
              >
                <Text size="S" color="text-700">
                  {aiPhase.message}
                </Text>
                <Text size="S" color="text-700">
                  Rephrase the request, or write the expression directly.
                </Text>
              </DSLFilterErrorBadge>
            ) : null}
            {isAIActive ? (
              <TooltipTrigger delay={500}>
                <IconButton
                  size="XS"
                  aria-label="Plain-English query"
                  aria-pressed={isAIModeOn}
                  className="ai-mode-toggle"
                  onPress={toggleAIMode}
                >
                  <Icon svg={<Icons.Sparkles />} />
                </IconButton>
                <Tooltip placement="bottom end">
                  {isConverting
                    ? "Cancel the conversion"
                    : isAIModeOn
                      ? "Switch back to the filter DSL"
                      : "Query in plain English"}
                </Tooltip>
              </TooltipTrigger>
            ) : null}
            <AIQuerySettingsButton />
          </>
        }
        extraStatus={
          <span role="status">
            {isConverting
              ? "Converting to a filter expression"
              : aiPhase.name === "generated"
                ? "Filter expression generated. Press Escape to undo."
                : aiPhase.name === "failed"
                  ? `AI query failed. ${aiPhase.message}`
                  : ""}
          </span>
        }
      />
    </AIOutline>
  );
}
