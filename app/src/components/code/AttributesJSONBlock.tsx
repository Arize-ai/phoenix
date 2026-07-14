import type { PropsWithChildren } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { Button, Flex, Icon, Icons } from "@phoenix/components";
import { CopyToClipboardButton } from "@phoenix/components/core/copy";
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

type AttributesJSONBlockContextType = {
  attributes: string;
  parsedAttributes: Record<string, unknown> | null;
  isExpanded: boolean;
  canExpand: boolean;
  displayValue: string;
  toggleExpand: () => void;
};

const AttributesJSONBlockContext =
  createContext<AttributesJSONBlockContextType | null>(null);

function useAttributesJSONBlock() {
  const context = useContext(AttributesJSONBlockContext);
  if (context === null) {
    throw new Error(
      "useAttributesJSONBlock must be used within an AttributesJSONBlockProvider"
    );
  }
  return context;
}

/**
 * Provides the shared state used by the attribute block and its controls.
 */
export function AttributesJSONBlockProvider({
  attributes,
  children,
}: PropsWithChildren<{ attributes: string }>) {
  const [isExpanded, setIsExpanded] = useState(false);

  const parsedAttributes = useMemo(() => {
    try {
      return JSON.parse(attributes) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [attributes]);

  const canExpand = useMemo(
    () => parsedAttributes !== null && hasStringifiedJSON(parsedAttributes),
    [parsedAttributes]
  );

  const displayValue = useMemo(() => {
    if (!parsedAttributes) {
      return attributes;
    }
    const valueToDisplay = isExpanded
      ? formatValue(parsedAttributes)
      : parsedAttributes;
    return JSON.stringify(valueToDisplay, null, 2);
  }, [parsedAttributes, isExpanded, attributes]);

  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <AttributesJSONBlockContext.Provider
      value={{
        attributes,
        parsedAttributes,
        isExpanded,
        canExpand,
        displayValue,
        toggleExpand,
      }}
    >
      {children}
    </AttributesJSONBlockContext.Provider>
  );
}

/**
 * Controls for expanding/collapsing stringified JSON values and copying.
 */
export function AttributesJSONBlockControls() {
  const { isExpanded, canExpand, displayValue, toggleExpand } =
    useAttributesJSONBlock();
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
 * Displays JSON attributes using state from AttributesJSONBlockProvider.
 */
export function AttributesJSONBlock() {
  const { attributes, parsedAttributes, displayValue } =
    useAttributesJSONBlock();

  return parsedAttributes ? (
    <JSONBlock value={displayValue} />
  ) : (
    <PreBlock>{attributes}</PreBlock>
  );
}
