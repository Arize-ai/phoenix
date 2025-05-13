import { CSSProperties, ReactNode } from "react";
import { css } from "@emotion/react";

import { HelpTooltip, TooltipTrigger, TriggerWrap } from "@arizeai/components";

import { Flex, Text, View } from "@phoenix/components";
import { Truncate } from "@phoenix/components/utility/Truncate";
import { toPythonPrimitiveStr } from "@phoenix/utils/pythonUtils";

import { useSpanFilterCondition } from "./SpanFilterConditionContext";

export const makeMetadataTooltipFilterCondition = (
  key: string,
  /**
   * The value of the metadata key. NB the value could be an object.
   */
  value: string | number | boolean
) => {
  const pathSegments = key.split(".");
  const bracketNotation = pathSegments
    .map((segment) => {
      return /^\d+$/.test(segment) ? `[${segment}]` : `['${segment}']`;
    })
    .join("");
  return `metadata${bracketNotation} == ${toPythonPrimitiveStr(value)}`;
};

type MetadataTooltipProps = {
  children: ReactNode;
  metadata: Record<string, string | number | boolean>;
  width?: CSSProperties["width"];
};

export function MetadataTooltip({
  children,
  metadata,
  width,
}: MetadataTooltipProps) {
  const { appendFilterCondition } = useSpanFilterCondition();
  const entries = Object.entries(metadata).map(([key, value]) => ({
    key,
    value: String(value),
    filterCondition: makeMetadataTooltipFilterCondition(key, value),
  }));

  return (
    <TooltipTrigger delay={500} offset={3}>
      <TriggerWrap>{children}</TriggerWrap>
      <HelpTooltip UNSAFE_style={{ minWidth: width }}>
        <Flex direction="row" wrap="nowrap" gap="size-100">
          <Flex flexBasis="40%">
            <Flex direction="column" gap="size-100" width="100%">
              <Text weight="heavy">Metadata</Text>
              <ul
                css={css`
                  display: flex;
                  flex-direction: column;
                  gap: var(--ac-global-dimension-size-100);
                  overflow-y: auto;
                  max-height: 200px;
                  scrollbar-gutter: stable;
                  padding-right: var(--ac-global-dimension-size-50);
                `}
              >
                {entries.map(({ key, value }) => (
                  <li key={key}>
                    <Flex direction="row" gap="size-100">
                      {/* Width is set to 0 so that truncation still works, true width is controlled by flexBasis */}
                      <Flex flexBasis="30%" width={0}>
                        <Truncate maxWidth="100%">
                          <Text weight="heavy" color="inherit" size="XS">
                            {key}
                          </Text>
                        </Truncate>
                      </Flex>
                      {/* Width is set to 0 so that truncation still works, true width is controlled by flexBasis */}
                      <Flex
                        flexBasis="70%"
                        flexShrink={1}
                        justifyContent="end"
                        width={0}
                      >
                        <Truncate maxWidth="100%">
                          <Text color="inherit" size="XS" maxWidth="100%">
                            {value}
                          </Text>
                        </Truncate>
                      </Flex>
                    </Flex>
                  </li>
                ))}
              </ul>
            </Flex>
          </Flex>
          <View
            borderColor="dark"
            paddingStart="size-200"
            paddingEnd="size-100"
            marginStart="size-200"
            flexBasis="60%"
            borderStartWidth="thin"
          >
            <Flex direction="column" gap="size-100" width="100%">
              <Text weight="heavy">Filters</Text>
              <ul
                css={css`
                  display: flex;
                  flex-direction: row;
                  gap: var(--ac-global-dimension-size-100);
                  padding: var(--ac-global-dimension-size-50) 0;
                  flex-wrap: wrap;
                `}
              >
                {entries.map(({ key, filterCondition }) => (
                  <li key={key}>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        appendFilterCondition(filterCondition);
                      }}
                      css={css`
                        all: unset;
                        color: var(--ac-global-text-color-900);
                        border: 1px solid var(--ac-global-color-grey-300);
                        border-radius: 4px;
                        padding: var(--ac-global-dimension-size-50)
                          var(--ac-global-dimension-size-100);
                        cursor: pointer;
                        transition: background-color 0.2s;
                        &:hover {
                          background-color: var(--ac-global-color-gray-300);
                        }
                      `}
                    >
                      Match {key}
                    </button>
                  </li>
                ))}
              </ul>
            </Flex>
          </View>
        </Flex>
      </HelpTooltip>
    </TooltipTrigger>
  );
}
