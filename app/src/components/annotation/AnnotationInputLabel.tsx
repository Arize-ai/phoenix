import { LabelProps } from "react-aria-components";
import { css } from "@emotion/react";

import { Label } from "@phoenix/components";
import { ANNOTATION_INPUT_LABEL_WIDTH } from "@phoenix/components/annotation/constants";
import { classNames } from "@phoenix/utils";

export const AnnotationInputLabel = (props: LabelProps) => {
  return (
    <Label
      className={classNames("react-aria-Label", props.className)}
      css={css`
        max-width: ${ANNOTATION_INPUT_LABEL_WIDTH};
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      `}
      {...props}
    />
  );
};
