import { LabelProps } from "react-aria-components";
import { css } from "@emotion/react";

import { classNames } from "@arizeai/components";

import { Label } from "@phoenix/components";
import { ANNOTATION_INPUT_LABEL_WIDTH } from "@phoenix/components/annotation/constants";

export const AnnotationInputLabel = (props: LabelProps) => {
  return (
    <Label
      className={classNames("react-aria-Label", props.className)}
      css={css`
        max-width: ${ANNOTATION_INPUT_LABEL_WIDTH};
      `}
      {...props}
    />
  );
};
