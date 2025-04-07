import React, { useLayoutEffect, useRef } from "react";

import {
  Button,
  Label,
  ListBox,
  Popover,
  Select,
  SelectItem,
  SelectValue,
} from "@phoenix/components";
import { useAnnotationFocus } from "@phoenix/components/annotation/AnnotationFocusContext";
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
  const { register } = useAnnotationFocus();
  useLayoutEffect(() => {
    register(selectRef);
  }, [register]);
  return (
    <Select
      id={annotationConfig.id}
      name={annotationConfig.name}
      {...props}
      ref={selectRef}
    >
      <Label>{annotationConfig.name}</Label>
      <Button>
        <SelectValue />
        <SelectChevronUpDownIcon />
      </Button>
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
  );
};
