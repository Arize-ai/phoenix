import { useCallback, useMemo, useState } from "react";
import { css } from "@emotion/react";

import { Button, Flex, Icon, Icons, View } from "@phoenix/components";
import { CopyToClipboardButton } from "@phoenix/components/CopyToClipboardButton";
import { isJSONString, safelyParseJSON } from "@phoenix/utils/jsonUtils";

import { JSONBlock } from "./JSONBlock";
import { PreBlock } from "./PreBlock";

const buttonContainerCSS = css`
  position: absolute;
  top: var(--ac-global-dimension-size-100);
  right: var(--ac-global-dimension-size-100);
  z-index: 1;
`;

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

/**
 * Displays JSON attributes with a button to expand/collapse stringified JSON values.
 */
export function AttributesJSONBlock({ attributes }: { attributes: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const parsedAttributes = useMemo(() => {
    try {
      return JSON.parse(attributes) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [attributes]);

  const canExpand = useMemo(
    () => parsedAttributes && hasStringifiedJSON(parsedAttributes),
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
    <View position="relative">
      <div css={buttonContainerCSS}>
        <Flex direction="row" gap="size-100">
          {canExpand && (
            <Button
              size="S"
              variant={isExpanded ? "primary" : "default"}
              aria-label={isExpanded ? "Collapse Strings" : "Expand Strings"}
              leadingVisual={
                <Icon
                  svg={
                    isExpanded ? (
                      <Icons.CollapseOutline />
                    ) : (
                      <Icons.ExpandOutline />
                    )
                  }
                />
              }
              onPress={toggleExpand}
            >
              {isExpanded ? "Collapse Strings" : "Expand Strings"}
            </Button>
          )}
          <CopyToClipboardButton text={displayValue} />
        </Flex>
      </div>
      {parsedAttributes ? (
        <JSONBlock value={displayValue} />
      ) : (
        <PreBlock>{attributes}</PreBlock>
      )}
    </View>
  );
}
