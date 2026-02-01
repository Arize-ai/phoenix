import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { Button, Flex, Icon, Icons } from "@phoenix/components";
import { CopyToClipboardButton } from "@phoenix/components/CopyToClipboardButton";
import { isJSONString, safelyParseJSON } from "@phoenix/utils/jsonUtils";

import { JSONBlock } from "./JSONBlock";
import { PreBlock } from "./PreBlock";

/**
 * Parses a string as JSON if it's a valid object or array.
 */
function parseStringifiedJSON(value: string): unknown | null {
  if (
    !isJSONString({ str: value, excludePrimitives: true, excludeNull: true })
  ) {
    return null;
  }
  const { json } = safelyParseJSON(value);
  return json;
}

/**
 * Recursively expands stringified JSON throughout nested objects and arrays.
 */
export function formatValue(value: unknown): unknown {
  if (typeof value === "string") {
    const parsed = parseStringifiedJSON(value);
    return parsed !== null ? formatValue(parsed) : value;
  }

  if (Array.isArray(value)) {
    return value.map(formatValue);
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [key, formatValue(val)])
    );
  }

  return value;
}

/**
 * Checks if a value contains stringified JSON that can be expanded.
 */
export function hasStringifiedJSON(value: unknown): boolean {
  if (typeof value === "string") {
    return isJSONString({
      str: value,
      excludePrimitives: true,
      excludeNull: true,
    });
  }

  if (Array.isArray(value)) {
    return value.some(hasStringifiedJSON);
  }

  if (typeof value === "object" && value !== null) {
    return Object.values(value).some(hasStringifiedJSON);
  }

  return false;
}

type JSONStringExpanderContextType = {
  jsonString: string;
  isExpanded: boolean;
  toggleExpand: () => void;
  canExpand: boolean;
  displayValue: string;
};

const JSONStringExpanderContext =
  createContext<JSONStringExpanderContextType | null>(null);

function useJSONStringExpander(): JSONStringExpanderContextType {
  const context = useContext(JSONStringExpanderContext);
  if (context === null) {
    throw new Error(
      "useJSONStringExpander must be used within a JSONStringExpanderProvider"
    );
  }
  return context;
}

/**
 * Provider that manages state for expanding stringified JSON within JSON.
 */
export function JSONStringExpanderProvider({
  jsonString,
  children,
}: PropsWithChildren<{ jsonString: string }>) {
  const [isExpanded, setIsExpanded] = useState(false);

  const parsedJSON = useMemo(() => {
    try {
      return JSON.parse(jsonString) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [jsonString]);

  const canExpand = useMemo(
    () => parsedJSON !== null && hasStringifiedJSON(parsedJSON),
    [parsedJSON]
  );

  const displayValue = useMemo(() => {
    if (!parsedJSON) {
      return jsonString;
    }
    const valueToDisplay = isExpanded ? formatValue(parsedJSON) : parsedJSON;
    return JSON.stringify(valueToDisplay, null, 2);
  }, [parsedJSON, isExpanded, jsonString]);

  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <JSONStringExpanderContext.Provider
      value={{
        jsonString,
        isExpanded,
        toggleExpand,
        canExpand,
        displayValue,
      }}
    >
      {children}
    </JSONStringExpanderContext.Provider>
  );
}

/**
 * Controls for expanding/collapsing stringified JSON and copying.
 * Must be used within a JSONStringExpanderProvider.
 */
export function JSONStringExpanderControls() {
  const { isExpanded, toggleExpand, canExpand, displayValue } =
    useJSONStringExpander();

  const expandLabel = isExpanded ? "Collapse Strings" : "Expand Strings";

  return (
    <Flex direction="row" gap="size-100">
      {canExpand && (
        <Button
          size="S"
          variant="default"
          aria-label={expandLabel}
          leadingVisual={
            <Icon
              svg={isExpanded ? <Icons.BlockString /> : <Icons.BlockJSON />}
            />
          }
          onPress={toggleExpand}
        >
          {expandLabel}
        </Button>
      )}
      <CopyToClipboardButton text={displayValue} />
    </Flex>
  );
}

/**
 * Displays JSON with expanded stringified values.
 * Must be used within a JSONStringExpanderProvider.
 */
export function JSONStringExpanderBlock() {
  const { jsonString, displayValue } = useJSONStringExpander();

  const parsedJSON = useMemo(() => {
    try {
      return JSON.parse(jsonString) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [jsonString]);

  return parsedJSON ? (
    <JSONBlock value={displayValue} />
  ) : (
    <PreBlock>{jsonString}</PreBlock>
  );
}
