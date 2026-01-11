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

function tryParseJSON(value: unknown): {
  parsed: unknown;
  isStringifiedJSON: boolean;
} {
  if (typeof value !== "string") {
    return { parsed: value, isStringifiedJSON: false };
  }

  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === "object" && parsed !== null) {
      return { parsed, isStringifiedJSON: true };
    }
  } catch {
    // Not valid JSON
  }

  return { parsed: value, isStringifiedJSON: false };
}

function formatValue(value: unknown, shouldFormat: boolean): unknown {
  if (!shouldFormat) {
    return value;
  }

  const { parsed, isStringifiedJSON } = tryParseJSON(value);
  if (isStringifiedJSON) {
    return formatValue(parsed, shouldFormat);
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatValue(item, shouldFormat));
  }

  if (typeof value === "object" && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = formatValue(val, shouldFormat);
    }
    return result;
  }

  return value;
}

function formatAttributes(
  obj: Record<string, unknown>,
  shouldFormat: boolean
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    result[key] = formatValue(value, shouldFormat);
  }

  return result;
}

function hasStringifiedJSON(value: unknown): boolean {
  if (typeof value === "string") {
    const { isStringifiedJSON } = tryParseJSON(value);
    return isStringifiedJSON;
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasStringifiedJSON(item));
  }

  if (typeof value === "object" && value !== null) {
    return Object.values(value).some((val) => hasStringifiedJSON(val));
  }

  return false;
}

export type AttributesJSONBlockProps = {
  attributes: string;
};

export function AttributesJSONBlock(props: AttributesJSONBlockProps) {
  const { attributes } = props;
  const [isFormatted, setIsFormatted] = useState(false);

  const parsedAttributes = useMemo(() => {
    try {
      return JSON.parse(attributes) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [attributes]);

  const hasStringified = useMemo(() => {
    if (!parsedAttributes) return false;
    return hasStringifiedJSON(parsedAttributes);
  }, [parsedAttributes]);

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
