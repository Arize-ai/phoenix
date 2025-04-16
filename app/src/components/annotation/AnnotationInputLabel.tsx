import React from "react";
import { LabelProps } from "react-aria-components";
import { css } from "@emotion/react";

import { classNames } from "@arizeai/components";

import { Label } from "@phoenix/components";
import { EXPLANATION_LABEL_WIDTH } from "@phoenix/components/annotation/AnnotationInputExplanation";

export const LABEL_WIDTH = `calc(100% - ${EXPLANATION_LABEL_WIDTH})`;

export const AnnotationInputLabel = (props: LabelProps) => {
  return (
    <Label
      className={classNames("react-aria-Label", props.className)}
      css={css`
        max-width: ${LABEL_WIDTH};
      `}
      {...props}
    />
  );
};
