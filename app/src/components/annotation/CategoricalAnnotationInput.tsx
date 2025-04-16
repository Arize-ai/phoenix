import React, { forwardRef } from "react";

import {
  Button,
  Flex,
  Label,
  ListBox,
  Popover,
  Select,
  SelectItem,
  SelectValue,
  Text,
} from "@phoenix/components";
import { AnnotationInputExplanation } from "@phoenix/components/annotation/AnnotationInputExplanation";
import { SelectChevronUpDownIcon } from "@phoenix/components/icon";
import { SelectProps } from "@phoenix/components/select";
import { AnnotationConfigCategorical } from "@phoenix/pages/settings/types";

import { AnnotationInputPropsBase } from "./types";

type CategoricalAnnotationInputProps =
  AnnotationInputPropsBase<AnnotationConfigCategorical> & SelectProps;

export const CategoricalAnnotationInput = forwardRef<
  HTMLButtonElement,
  CategoricalAnnotationInputProps
>(({ annotationConfig, containerRef, annotation, ...props }, ref) => {
  return (
    <Flex gap="size-50" alignItems="center">
      <Select
        id={annotationConfig.id}
        name={annotationConfig.name}
        defaultSelectedKey={annotation?.label ?? undefined}
        {...props}
        css={{
          width: "100%",
        }}
      >
        <Label>{annotationConfig.name}</Label>
        <Button ref={ref}>
          <SelectValue />
          <SelectChevronUpDownIcon />
        </Button>
        <Text slot="description">{annotationConfig.description}</Text>
        <Popover UNSTABLE_portalContainer={containerRef}>
          <ListBox
            disallowEmptySelection={false}
            selectionMode="none"
            selectionBehavior="toggle"
          >
            {annotationConfig.values?.map((option) => (
              <SelectItem key={option.label} id={option.label}>
                {option.label}
              </SelectItem>
            ))}
          </ListBox>
        </Popover>
      </Select>
      <div style={{ marginTop: 8 }}>
        <AnnotationInputExplanation
          explanation={annotation?.explanation ?? undefined}
          containerRef={containerRef}
        />
      </div>
    </Flex>
  );
});

CategoricalAnnotationInput.displayName = "CategoricalAnnotationInput";
