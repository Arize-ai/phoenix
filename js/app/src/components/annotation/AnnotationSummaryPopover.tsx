import { css } from "@emotion/react";
import type { CSSProperties, ReactNode } from "react";
import { useRef, useState } from "react";
import { FocusScope } from "react-aria";
import { Button as AriaButton } from "react-aria-components";

import {
  Dialog,
  DialogTrigger,
  Flex,
  Popover,
  PopoverArrow,
  RichTooltip,
  Text,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
  TriggerWrap,
  View,
} from "@phoenix/components";
import { AnnotationColorSwatch } from "@phoenix/components/annotation/AnnotationColorSwatch";
import { AnnotationDetailsList } from "@phoenix/components/annotation/AnnotationDetailsList";
import { MeanScore } from "@phoenix/components/annotation/MeanScore";
import { clickablePillCSS } from "@phoenix/components/core/styles";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { StopPropagation } from "@phoenix/components/StopPropagation";
import { tableCSS } from "@phoenix/components/table/styles";
import { UserPicture } from "@phoenix/components/user/UserPicture";
import { SpanAnnotationTooltipFilterActions } from "@phoenix/pages/project/AnnotationTooltipFilterActions";
import { formatFloat } from "@phoenix/utils/numberFormatUtils";

import { hasAnnotationValue } from "./annotationUtils";
import type { AnnotationOptimizationConfig } from "./optimizationUtils";
import type { Annotation } from "./types";

const customTableCSS = css`
  & thead tr th {
    background-color: transparent;
  }
`;

const annotationSummaryTriggerCSS = css`
  all: unset;
  display: inline-flex;
  border-radius: var(--global-rounding-small);
  ${clickablePillCSS};

  &:focus-visible {
    outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }
`;

export function AnnotationSummaryPopover({
  annotations,
  children,
  width,
  meanScore,
  annotationConfig,
  showFilterActions,
  renderFilterActions,
}: {
  /** Annotations of the same name */
  annotations: Annotation[] | readonly Annotation[];
  children: ReactNode;
  width?: CSSProperties["width"];
  meanScore?: number | null;
  annotationConfig?: AnnotationOptimizationConfig;
  showFilterActions?: boolean;
  renderFilterActions?: (annotation: Annotation) => ReactNode;
}) {
  const filteredAnnotations = annotations.filter(hasAnnotationValue);
  const prototypicalAnnotation = filteredAnnotations[0];
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openTooltipAfterDelay = () => {
    if (hoverTimeoutRef.current != null) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      hoverTimeoutRef.current = null;
      setIsTooltipOpen(true);
    }, 500);
  };
  const closeTooltip = () => {
    if (hoverTimeoutRef.current != null) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsTooltipOpen(false);
  };
  const closeTooltipAfterDelay = () => {
    if (hoverTimeoutRef.current != null) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      hoverTimeoutRef.current = null;
      setIsTooltipOpen(false);
    }, 100);
  };
  const keepTooltipOpen = () => {
    if (hoverTimeoutRef.current != null) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsTooltipOpen(true);
  };
  if (!prototypicalAnnotation) {
    return null;
  }
  return (
    <DialogTrigger>
      <TooltipTrigger isOpen={isTooltipOpen} onOpenChange={setIsTooltipOpen}>
        <AriaButton
          css={annotationSummaryTriggerCSS}
          data-clickable="true"
          aria-label={`View ${prototypicalAnnotation.name} annotation details`}
          onHoverStart={openTooltipAfterDelay}
          onHoverEnd={closeTooltipAfterDelay}
          onFocus={() => setIsTooltipOpen(true)}
          onBlur={closeTooltip}
          onPress={closeTooltip}
        >
          {children}
        </AriaButton>
        <RichTooltip
          offset={3}
          width="400px"
          onMouseEnter={keepTooltipOpen}
          onMouseLeave={closeTooltip}
          css={css`
            box-sizing: border-box;
            padding: 0;
            overflow-x: hidden;
            overflow-y: auto;
            scrollbar-gutter: stable;
          `}
        >
          <AnnotationDetailsList
            annotations={annotations}
            annotationConfig={annotationConfig}
          />
        </RichTooltip>
      </TooltipTrigger>
      <StopPropagation>
        <Popover
          shouldCloseOnInteractOutside={() => true}
          isKeyboardDismissDisabled={false}
          style={{ minWidth: width }}
        >
          <PopoverArrow />
          <Dialog
            css={css`
              border-radius: var(--global-radius-200);
            `}
          >
            <FocusScope autoFocus contain restoreFocus>
              <View>
                <Flex direction="column">
                  <View
                    borderBottomWidth="thin"
                    borderColor="default"
                    paddingX="size-200"
                    paddingY="size-100"
                  >
                    <Flex width="100%" justifyContent="space-between">
                      <Flex direction="row" gap="size-100" alignItems="center">
                        <AnnotationColorSwatch
                          size="M"
                          annotationName={prototypicalAnnotation.name}
                        />
                        <Text
                          weight="heavy"
                          title={prototypicalAnnotation.name}
                          size="M"
                        >
                          <Truncate maxWidth="300px">
                            {prototypicalAnnotation.name}
                          </Truncate>
                        </Text>
                      </Flex>
                      <TooltipTrigger delay={0}>
                        <TriggerWrap>
                          <MeanScore
                            size="L"
                            value={meanScore}
                            fallback={null}
                          />
                        </TriggerWrap>
                        <Tooltip placement="top">
                          <TooltipArrow />
                          <Text>Mean Score</Text>
                        </Tooltip>
                      </TooltipTrigger>
                    </Flex>
                  </View>
                  <View overflow="auto" maxHeight="300px" position="relative">
                    <table css={css(tableCSS, customTableCSS)}>
                      <thead>
                        <tr>
                          <th>author</th>
                          <th>label</th>
                          <th>score</th>
                          {showFilterActions ? <th>filters</th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAnnotations.map((annotation) => (
                          <tr
                            css={css`
                              padding-left: var(--global-dimension-size-200);
                            `}
                            key={annotation.id}
                          >
                            {
                              <td>
                                <Flex
                                  wrap="nowrap"
                                  gap="size-100"
                                  alignItems="center"
                                >
                                  <UserPicture
                                    name={annotation?.user?.username}
                                    profilePictureUrl={
                                      annotation?.user?.profilePictureUrl
                                    }
                                    size={16}
                                  />
                                  <Text>
                                    {annotation?.user?.username ?? "system"}
                                  </Text>
                                </Flex>
                              </td>
                            }
                            <td>
                              {annotation.label ? (
                                <Text title={annotation.label}>
                                  <Truncate
                                    maxWidth={
                                      showFilterActions ? "150px" : "200px"
                                    }
                                  >
                                    {annotation.label}
                                  </Truncate>
                                </Text>
                              ) : (
                                "--"
                              )}
                            </td>
                            <td>
                              {annotation.score != null
                                ? formatFloat(annotation.score)
                                : "--"}
                            </td>

                            {showFilterActions ? (
                              <td>
                                <Flex justifyContent="end" flexGrow={1}>
                                  {renderFilterActions ? (
                                    renderFilterActions(annotation)
                                  ) : (
                                    <SpanAnnotationTooltipFilterActions
                                      annotation={annotation}
                                    />
                                  )}
                                </Flex>
                              </td>
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </View>
                </Flex>
              </View>
            </FocusScope>
          </Dialog>
        </Popover>
      </StopPropagation>
    </DialogTrigger>
  );
}
