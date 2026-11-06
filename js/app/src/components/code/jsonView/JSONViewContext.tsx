import type { PropsWithChildren } from "react";
import { createContext, useContext, useMemo, useState } from "react";

import type {
  FlatJSONEntry,
  FlatJSONIndexNotation,
} from "@phoenix/utils/jsonUtils";
import {
  expandStringifiedJSON,
  filterFlatJSONEntries,
  hasStringifiedJSON,
  safelyParseJSONObjectString,
  safelyStringifyJSON,
  toFlatJSONEntries,
} from "@phoenix/utils/jsonUtils";

import type { JSONViewMode } from "./types";

export type JSONViewContextValue = {
  /** The value handed to the provider, for the non-viewable fallback */
  value: unknown;
  /** Whether the value is (or parses to) an object or array */
  isViewable: boolean;
  mode: JSONViewMode;
  setMode: (mode: JSONViewMode) => void;
  /** Whether the value holds stringified JSON that can be un-nested */
  canExpand: boolean;
  /** Whether stringified JSON is currently un-nested in the JSON document */
  isExpanded: boolean;
  setIsExpanded: (isExpanded: boolean) => void;
  /** Whether the table's rows wrap their text or clip it to a single line */
  areRowsExpanded: boolean;
  setAreRowsExpanded: (areRowsExpanded: boolean) => void;
  query: string;
  setQuery: (query: string) => void;
  /** Every flattened leaf of the value, regardless of the search */
  entries: FlatJSONEntry[];
  /** The entries the table is showing, once the search is applied */
  visibleEntries: FlatJSONEntry[];
  /** The JSON document, honoring the un-nest toggle */
  jsonText: string;
  /**
   * Whatever the body is showing, ready for the clipboard — the JSON document
   * as rendered, or, in table mode, the visible rows as a list of entries.
   */
  copyText: string;
};

const JSONViewContext = createContext<JSONViewContextValue | null>(null);

/**
 * The state and derived text behind a JSON view. Call it from anything placed
 * inside a {@link JSONViewProvider} — a control in a card header, a counter
 * beside a card title, or the body itself.
 */
export function useJSONView(): JSONViewContextValue {
  const context = useContext(JSONViewContext);
  if (context === null) {
    throw new Error("useJSONView must be used within a JSONViewProvider");
  }
  return context;
}

/**
 * Resolves the value to display. A string holding a JSON object or array is
 * parsed, so callers can hand over a raw JSON string (e.g. span attributes)
 * without parsing it first.
 */
function resolveRoot(value: unknown): unknown {
  if (typeof value === "string") {
    return safelyParseJSONObjectString(value) ?? value;
  }
  return value;
}

/**
 * Owns everything a JSON view needs — which rendering is selected, what the
 * search box holds, whether stringified JSON is un-nested — and derives the
 * text each part displays.
 *
 * The state lives here rather than in a single component so a card can put the
 * search, copy, un-nest and mode controls in its header and nothing but the
 * body in its body. See `JSONView` for the standalone arrangement.
 */
export function JSONViewProvider({
  children,
  value,
  defaultMode = "json",
  indexNotation = "bracket",
}: PropsWithChildren<{
  /** The JSON value to display. A JSON string is parsed before display. */
  value: unknown;
  /**
   * The view shown before the user picks one.
   * @default "json"
   */
  defaultMode?: JSONViewMode;
  /**
   * How the table's keys address array items. Use `dot` where the keys are
   * meant to be pasted somewhere that reads them the way OpenTelemetry writes
   * them.
   * @default "bracket"
   */
  indexNotation?: FlatJSONIndexNotation;
}>) {
  const [mode, setMode] = useState<JSONViewMode>(defaultMode);
  const [isExpanded, setIsExpanded] = useState(false);
  // Clipped to start: a table is opened to find a key, and rows of an even
  // height are what make that scan possible. Expanding is the deliberate second
  // step, once the row worth reading has been found.
  const [areRowsExpanded, setAreRowsExpanded] = useState(false);
  // The query outlives the search field, which unmounts whenever the table is
  // left or the surrounding card is collapsed. `JSONViewSearch` seeds itself
  // from this on mount, so the box always shows the filter that is applied.
  const [query, setQuery] = useState("");

  const root = useMemo(() => resolveRoot(value), [value]);
  const isViewable = typeof root === "object" && root !== null;
  const isTableMode = mode === "table";

  // Un-nesting is offered on the JSON document and only on request, since the
  // raw document is what was actually recorded.
  const jsonText = useMemo(
    () =>
      isViewable
        ? (safelyStringifyJSON(
            isExpanded ? expandStringifiedJSON(root) : root,
            null,
            2
          ).json ?? "")
        : "",
    [isViewable, isExpanded, root]
  );
  // The table's keys are the recorded attribute keys, so that a copied key
  // addresses the value on the span and can be pasted straight into
  // instrumentation. Un-nesting would invent keys that were never recorded --
  // an `output.value` holding a serialized list would flatten away into
  // `output.value.0`, which addresses nothing.
  //
  // Memoized apart from the search below so that narrowing the rows re-runs the
  // filter alone, not the flatten, on documents with thousands of leaves.
  const entries = useMemo(
    () => (isViewable ? toFlatJSONEntries({ value: root, indexNotation }) : []),
    [isViewable, root, indexNotation]
  );
  const canExpand = useMemo(
    () => isViewable && hasStringifiedJSON(root),
    [isViewable, root]
  );
  const visibleEntries = useMemo(
    () => (isTableMode ? filterFlatJSONEntries({ entries, query }) : entries),
    [isTableMode, entries, query]
  );

  // Copy what is on screen: the JSON document, or the rows as filtered. The
  // rows are copied as a list rather than an object because flattened keys are
  // not unique -- a recorded key holding the separator, `{"a.b": 1, "a": {"b":
  // 2}}`, flattens to two rows named `a.b` -- and an object would silently drop
  // one of them.
  const copyText = useMemo(() => {
    if (isTableMode) {
      return safelyStringifyJSON(visibleEntries, null, 2).json ?? "";
    }
    return isViewable ? jsonText : String(value);
  }, [isTableMode, visibleEntries, isViewable, jsonText, value]);

  return (
    <JSONViewContext.Provider
      value={{
        value,
        isViewable,
        mode,
        setMode,
        canExpand,
        isExpanded,
        setIsExpanded,
        areRowsExpanded,
        setAreRowsExpanded,
        query,
        setQuery,
        entries,
        visibleEntries,
        jsonText,
        copyText,
      }}
    >
      {children}
    </JSONViewContext.Provider>
  );
}
