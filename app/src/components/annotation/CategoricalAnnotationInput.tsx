import { forwardRef } from "react";

import {
  Button,
  Flex,
  ListBox,
  Popover,
  Select,
  SelectItem,
  SelectValue,
  Text,
} from "@phoenix/components";
import { AnnotationInputExplanation } from "@phoenix/components/annotation/AnnotationInputExplanation";
import { AnnotationInputLabel } from "@phoenix/components/annotation/AnnotationInputLabel";
import { SelectChevronUpDownIcon } from "@phoenix/components/icon";
import { SelectProps } from "@phoenix/components/select";
import { AnnotationConfigCategorical } from "@phoenix/pages/settings/types";

import { AnnotationInputPropsBase } from "./types";

type CategoricalAnnotationInputProps =
  AnnotationInputPropsBase<AnnotationConfigCategorical> & SelectProps;

export const CategoricalAnnotationInput = forwardRef<
  HTMLButtonElement,
  CategoricalAnnotationInputProps
>(
  (
    {
      annotationConfig,
      containerRef,
      annotation,
      onSubmitExplanation,
      ...props
    },
    ref
  ) => {
    return (
      <Flex gap="size-50" alignItems="center" position="relative">
        <AnnotationInputExplanation
          annotation={annotation}
          onSubmit={onSubmitExplanation}
          containerRef={containerRef}
        />
        <Select
          id={annotationConfig.id}
          name={annotationConfig.name}
          defaultSelectedKey={annotation?.label ?? undefined}
          size="S"
          {...props}
          css={{
            width: "100%",
          }}
        >
          <AnnotationInputLabel>{annotationConfig.name}</AnnotationInputLabel>
          <Button ref={ref}>
            <SelectValue />
            <SelectChevronUpDownIcon />
          </Button>
          <Text slot="description">{annotationConfig.description}</Text>
          <Popover UNSTABLE_portalContainer={containerRef}>
            <ListBox style={{ minHeight: "auto" }}>
              {annotationConfig.values?.map((option) => (
                <SelectItem key={option.label} id={option.label}>
                  {option.label}
                </SelectItem>
              ))}
            </ListBox>
          </Popover>
        </Select>
      </Flex>
    );
  }
);

CategoricalAnnotationInput.displayName = "CategoricalAnnotationInput";
