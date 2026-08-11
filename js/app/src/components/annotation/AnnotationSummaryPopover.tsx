import { css } from "@emotion/react";
import type { CSSProperties, ReactNode } from "react";
import { useRef, useState } from "react";
import { FocusScope } from "react-aria";
import { Button as AriaButton } from "react-aria-components";

import {
  Dialog,
  Flex,
  Popover,
  PopoverArrow,
  PreviewTrigger,
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  if (!prototypicalAnnotation) {
    return null;
  }
  return (
    <>
      <PreviewTrigger isOpen={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <AriaButton
          ref={triggerRef}
          css={annotationSummaryTriggerCSS}
          data-clickable="true"
          aria-label={`View ${prototypicalAnnotation.name} annotation details`}
          aria-expanded={isPreviewOpen || isPopoverOpen}
          onPress={() => {
            setIsPreviewOpen(false);
            setIsPopoverOpen(true);
          }}
        >
          {children}
        </AriaButton>
        <Popover offset={3} placement="top" style={{ width: "400px" }}>
          <PopoverArrow />
          <AnnotationDetailsList
            annotations={annotations}
            annotationConfig={annotationConfig}
          />
        </Popover>
      </PreviewTrigger>
      <StopPropagation>
        <Popover
          triggerRef={triggerRef}
          isOpen={isPopoverOpen}
          onOpenChange={setIsPopoverOpen}
          shouldCloseOnInteractOutside={() => true}
          isKeyboardDismissDisabled={false}
          style={{ minWidth: width }}
        >
          <PopoverArrow />
          <Dialog
            aria-label={`${prototypicalAnnotation.name} annotation details`}
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
    </>
  );
}
