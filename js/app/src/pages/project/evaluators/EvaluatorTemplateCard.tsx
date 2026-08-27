import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { ListBoxItem } from "@phoenix/components";
import { classNames } from "@phoenix/utils/classNames";

type EvaluatorTemplateCardProps = {
  id: string;
  textValue: string;
  children: ReactNode;
};

export function EvaluatorTemplateCard({
  id,
  textValue,
  children,
}: EvaluatorTemplateCardProps) {
  return (
    <ListBoxItem
      css={evaluatorTemplateCardCSS}
      id={id}
      textValue={textValue}
      className={classNames(
        "react-aria-ListBoxItem",
        "evaluator-template-card"
      )}
    >
      {children}
    </ListBoxItem>
  );
}

const evaluatorTemplateCardCSS = css`
  && {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    width: 100%;
    height: auto;
    min-height: var(--global-dimension-size-1400);
    gap: var(--global-dimension-size-100);
    margin: 0;
    padding: var(--global-dimension-size-150);
    text-align: left;
    border: var(--global-border-size-thin) solid
      var(--global-border-color-default);
    border-radius: var(--global-rounding-small);
  }
`;
