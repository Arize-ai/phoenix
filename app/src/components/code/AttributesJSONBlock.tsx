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

type AttributesDisplayContextType = {
  attributes: string;
  isExpanded: boolean;
  toggleExpand: () => void;
  canExpand: boolean;
  displayValue: string;
};

const AttributesDisplayContext =
  createContext<AttributesDisplayContextType | null>(null);

function useAttributesDisplay(): AttributesDisplayContextType {
  const context = useContext(AttributesDisplayContext);
  if (context === null) {
    throw new Error(
      "useAttributesDisplay must be used within an AttributesDisplayProvider"
    );
  }
  return context;
}

/**
 * Provider that manages state for the attributes JSON block and its controls.
 */
export function AttributesDisplayProvider({
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
    <AttributesDisplayContext.Provider
      value={{
        attributes,
        isExpanded,
        toggleExpand,
        canExpand,
        displayValue,
      }}
    >
      {children}
    </AttributesDisplayContext.Provider>
  );
}

/**
 * Controls for the attributes JSON block (expand/collapse and copy buttons).
 * Must be used within an AttributesDisplayProvider.
 */
export function ConnectedAttributesJSONBlockControls() {
  const { isExpanded, toggleExpand, canExpand, displayValue } =
    useAttributesDisplay();

  return (
    <Flex direction="row" gap="size-100">
      {canExpand && (
        <Button
          size="S"
          variant="default"
          aria-label={isExpanded ? "Collapse Strings" : "Expand Strings"}
          leadingVisual={
            <Icon
              svg={isExpanded ? <Icons.BlockString /> : <Icons.BlockJSON />}
            />
          }
          onPress={toggleExpand}
        >
          {isExpanded ? "Collapse Strings" : "Expand Strings"}
        </Button>
      )}
      <CopyToClipboardButton text={displayValue} />
    </Flex>
  );
}

/**
 * Displays JSON attributes. Must be used within an AttributesDisplayProvider.
 */
export function ConnectedAttributesJSONBlock() {
  const { attributes, displayValue } = useAttributesDisplay();

  const parsedAttributes = useMemo(() => {
    try {
      return JSON.parse(attributes) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [attributes]);

  return parsedAttributes ? (
    <JSONBlock value={displayValue} />
  ) : (
    <PreBlock>{attributes}</PreBlock>
  );
}

/**
 * Standalone component that displays JSON attributes with expand/collapse controls.
 * Use this when you don't need to separate the controls from the content.
 */
export function AttributesJSONBlock({ attributes }: { attributes: string }) {
  return (
    <AttributesDisplayProvider attributes={attributes}>
      <ConnectedAttributesJSONBlock />
    </AttributesDisplayProvider>
  );
}
