import { CSSProperties, ReactNode, useMemo } from "react";
import { FocusScope, Pressable } from "react-aria";
import { css } from "@emotion/react";

import { Tooltip, TooltipTrigger, TriggerWrap } from "@arizeai/components";

import {
  Dialog,
  DialogTrigger,
  Flex,
  Popover,
  PopoverArrow,
  Text,
  View,
} from "@phoenix/components";
import { AnnotationColorSwatch } from "@phoenix/components/annotation/AnnotationColorSwatch";
import { MeanScore } from "@phoenix/components/annotation/MeanScore";
import { StopPropagation } from "@phoenix/components/StopPropagation";
import { tableCSS } from "@phoenix/components/table/styles";
import { UserPicture } from "@phoenix/components/user/UserPicture";
import { Truncate } from "@phoenix/components/utility/Truncate";
import { AnnotationTooltipFilterActions } from "@phoenix/pages/project/AnnotationTooltipFilterActions";
import { formatFloat } from "@phoenix/utils/numberFormatUtils";

import { Annotation } from "./types";

const customTableCSS = css`
  & thead tr th {
    background-color: transparent;
  }
`;

export function AnnotationSummaryPopover({
  annotations,
  children,
  width,
  meanScore,
  showFilterActions,
}: {
  /** Annotations of the same name */
  annotations: Annotation[] | readonly Annotation[];
  children: ReactNode;
  width?: CSSProperties["width"];
  meanScore?: number | null;
  showFilterActions?: boolean;
}) {
  const filteredAnnotations = useMemo(
    () =>
      annotations.filter(
        (annotation) => annotation.label != null || annotation.score != null
      ),
    [annotations]
  );
  const prototypicalAnnotation = filteredAnnotations[0];
  if (!prototypicalAnnotation) {
    return null;
  }
  return (
    <DialogTrigger>
      <Pressable>
        <span role="button">{children}</span>
      </Pressable>
      <StopPropagation>
        <Popover
          shouldCloseOnInteractOutside={() => true}
          style={{ minWidth: width }}
        >
          <PopoverArrow />
          <Dialog
            css={css`
              border-radius: var(--ac-global-radius-200);
            `}
          >
            <FocusScope autoFocus contain restoreFocus>
              <View>
                <Flex direction="column">
                  <View
                    borderBottomWidth="thin"
                    borderColor="dark"
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
                      <TooltipTrigger delay={0} placement="top">
                        <TriggerWrap>
                          <MeanScore
                            size="L"
                            value={meanScore}
                            fallback={null}
                          />
                        </TriggerWrap>
                        <Tooltip>
                          <PopoverArrow />
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
                          <th>filters</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAnnotations.map((annotation) => (
                          <tr
                            css={css`
                              padding-left: var(ac-global-dimensions-size-200);
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
                                  <Truncate maxWidth="150px">
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
                                  <AnnotationTooltipFilterActions
                                    annotation={annotation}
                                  />
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
