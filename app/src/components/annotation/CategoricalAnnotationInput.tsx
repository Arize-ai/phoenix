import React, { useRef } from "react";

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

type CategoricalAnnotationInputProps = {
  annotationConfig: AnnotationConfigCategorical;
} & SelectProps;

export const CategoricalAnnotationInput = ({
  annotationConfig,
  ...props
}: CategoricalAnnotationInputProps) => {
  const selectRef = useRef<HTMLDivElement>(null);
  return (
    <Flex gap="size-50" alignItems="center">
      <Select
        id={annotationConfig.id}
        name={annotationConfig.name}
        {...props}
        ref={selectRef}
        css={{
          minWidth: "100%",
        }}
      >
        <Label>{annotationConfig.name}</Label>
        <Button>
          <SelectValue />
          <SelectChevronUpDownIcon />
        </Button>
        <Text slot="description">{annotationConfig.description}</Text>
        <Popover>
          <ListBox>
            {annotationConfig.values?.map((option) => (
              <SelectItem key={option.label} id={option.label}>
                {option.label}
              </SelectItem>
            ))}
          </ListBox>
        </Popover>
      </Select>
      <div style={{ marginTop: 8 }}>
        <AnnotationInputExplanation />
      </div>
    </Flex>
  );
};
