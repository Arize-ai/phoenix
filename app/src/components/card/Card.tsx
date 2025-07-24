import { forwardRef, PropsWithChildren, Ref } from "react";
import { css } from "@emotion/react";

import { Heading } from "@phoenix/components";
import { ViewStyleProps } from "@phoenix/components/types";
import { useStyleProps } from "@phoenix/components/utils";

interface CardProps extends PropsWithChildren<ViewStyleProps> {
  title: string;
}

const cardCSS = css`
  --scope-border-color: var(--ac-global-border-color-default);
  --card-header-height: 68px;

  display: flex;
  flex-direction: column;
  background-color: var(--ac-global-background-color-dark);
  color: var(--ac-global-text-color-900);
  border-radius: var(--ac-global-rounding-medium);
  border: 1px solid var(--scope-border-color);
  overflow: hidden;
`;

const cardHeaderCSS = css`
  display: flex;
  flex-direction: row;
  flex: none;
  justify-content: space-between;
  align-items: center;
  padding: 0 var(--ac-global-dimension-static-size-200);
  height: var(--card-header-height);
  transition: background-color 0.2s ease-in-out;
  border-bottom: 1px solid var(--scope-border-color);
`;

const cardBodyCSS = css`
  flex: 1 1 auto;
  padding: var(--ac-global-dimension-static-size-200);
`;

function Card(
  { title, children, ...otherProps }: CardProps,
  ref: Ref<HTMLElement>
) {
  const { styleProps } = useStyleProps(otherProps);
  return (
    <section {...styleProps} ref={ref} css={cardCSS}>
      <header css={cardHeaderCSS}>
        <Heading level={3} weight="heavy">
          {title}
        </Heading>
      </header>
      <div css={cardBodyCSS}>{children}</div>
    </section>
  );
}

const _Card = forwardRef(Card);
export { _Card as Card };
