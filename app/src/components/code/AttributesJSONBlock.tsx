import { useCallback, useMemo, useState } from "react";
import { css } from "@emotion/react";

import { Button, Flex, Icon, Icons, View } from "@phoenix/components";
import { CopyToClipboardButton } from "@phoenix/components/CopyToClipboardButton";

import { JSONBlock } from "./JSONBlock";
import { PreBlock } from "./PreBlock";

const buttonContainerCSS = css`
  position: absolute;
  top: var(--ac-global-dimension-size-100);
  right: var(--ac-global-dimension-size-100);
  z-index: 1;
`;

/**
 * Attempts to parse a value as JSON and returns whether it's a stringified JSON
 */
function tryParseJSON(value: unknown): {
  parsed: unknown;
  isStringifiedJSON: boolean;
} {
  if (typeof value !== "string") {
    return { parsed: value, isStringifiedJSON: false };
  }

  try {
    const parsed = JSON.parse(value);
    // Only consider it stringified JSON if the result is an object or array
    if (typeof parsed === "object" && parsed !== null) {
      return { parsed, isStringifiedJSON: true };
    }
  } catch {
    // Not valid JSON, return as-is
  }

  return { parsed: value, isStringifiedJSON: false };
}

/**
 * Recursively formats attributes by detecting and parsing stringified JSON
 */
function formatAttributes(
  obj: Record<string, unknown>,
  shouldFormat: boolean
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (shouldFormat) {
      const { parsed, isStringifiedJSON } = tryParseJSON(value);
      if (isStringifiedJSON) {
        result[key] = parsed;
      } else if (typeof value === "object" && value !== null) {
        // Recursively format nested objects
        result[key] = formatAttributes(
          value as Record<string, unknown>,
          shouldFormat
        );
      } else {
        result[key] = value;
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Checks if an object contains any stringified JSON values (recursively)
 */
function hasStringifiedJSON(obj: Record<string, unknown>): boolean {
  for (const value of Object.values(obj)) {
    if (typeof value === "string") {
      const { isStringifiedJSON } = tryParseJSON(value);
      if (isStringifiedJSON) {
        return true;
      }
    }
    if (typeof value === "object" && value !== null) {
      if (hasStringifiedJSON(value as Record<string, unknown>)) {
        return true;
      }
    }
  }
  return false;
}

export type AttributesJSONBlockProps = {
  /**
   * The JSON string of attributes to display
   */
  attributes: string;
};

/**
 * A JSONBlock component enhanced with the ability to format stringified JSON values.
 * Provides a "View as JSON" button to toggle between raw and formatted views.
 */
export function AttributesJSONBlock(props: AttributesJSONBlockProps) {
  const { attributes } = props;
  const [isFormatted, setIsFormatted] = useState(false);

  // Parse the attributes once
  const parsedAttributes = useMemo(() => {
    try {
      return JSON.parse(attributes) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [attributes]);

  // Check if there are any stringified JSON values
  const hasStringified = useMemo(() => {
    if (!parsedAttributes) return false;
    return hasStringifiedJSON(parsedAttributes);
  }, [parsedAttributes]);

  // Format the attributes based on the current state
  const displayValue = useMemo(() => {
    if (!parsedAttributes) {
      return attributes;
    }

    const formatted = formatAttributes(parsedAttributes, isFormatted);
    return JSON.stringify(formatted, null, 2);
  }, [parsedAttributes, attributes, isFormatted]);

  const toggleFormat = useCallback(() => {
    setIsFormatted((prev: boolean) => !prev);
  }, []);

  return (
    <View position="relative">
      <div css={buttonContainerCSS}>
        <Flex direction="row" gap="size-100">
          {hasStringified && (
            <Button
              size="S"
              variant={isFormatted ? "primary" : "default"}
              leadingVisual={
                <Icon
                  svg={
                    isFormatted ? (
                      <Icons.CollapseOutline />
                    ) : (
                      <Icons.ExpandOutline />
                    )
                  }
                />
              }
              onPress={toggleFormat}
            >
              {isFormatted ? "Collapse Strings" : "Expand Strings"}
            </Button>
          )}
          <CopyToClipboardButton text={displayValue} />
        </Flex>
      </div>
      {parsedAttributes ? <JSONBlock value={displayValue} /> : <PreBlock>{attributes}</PreBlock>}
    </View>
  );
}
