import { ReactNode, useState } from "react";
import { css } from "@emotion/react";

import { classNames } from "@arizeai/components";

import { Button, Icon, Icons } from "@phoenix/components";

type SpanImageProps = {
  /**
   * The url of the image. Can be either be a data URL, a URL or a redacted string
   */

  url: string;
};

function isRedactedUrl(url: string) {
  return url === "__REDACTED__";
}

const imageContainerCSS = css`
  position: relative;
  overflow: hidden;
  width: 200px;
  height: 200px;
  border-radius: var(--ac-global-rounding-small);
  border: 1px solid var(--ac-global-color-grey-500);
  background-color: var(--ac-global-color-grey-200);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  transition:
    width 0.1s ease-in-out,
    height 0.1s ease-in-out opacity 0.1s ease-in-out;
  button {
    position: absolute;
    right: var(--ac-global-dimension-size-100);
    top: var(--ac-global-dimension-size-100);
    z-index: 1;
    opacity: 0;
  }
  &:hover button {
    opacity: 1;
  }
  img {
    width: inherit;
    height: inherit;
    object-fit: contain;
  }

  &.is-expanded {
    width: 100%;
    height: 100%;
    img {
      object-fit: cover;
    }
  }
`;
/**
 * Displays an image attribute of a span.
 */
export function SpanImage(props: SpanImageProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  let content: ReactNode;
  const isRedacted = isRedactedUrl(props.url);
  if (isRedacted) {
    content = <RedactedImageSVG />;
  } else {
    content = <img src={props.url} />;
  }
  return (
    <div
      className={classNames({
        "is-expanded": isExpanded,
      })}
      css={imageContainerCSS}
    >
      {!isRedacted && (
        <Button
          variant="default"
          size="S"
          onPress={() => setIsExpanded(!isExpanded)}
          leadingVisual={
            <Icon
              svg={
                isExpanded ? <Icons.CollapseOutline /> : <Icons.ExpandOutline />
              }
            />
          }
          aria-label="Expand / Collapse Image"
        />
      )}
      {content}
    </div>
  );
}

const RedactedImageSVG = () => (
  <svg
    width="130"
    height="130"
    viewBox="0 0 130 130"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="1.5"
      y="1.5"
      width="127"
      height="127"
      rx="6.5"
      strokeOpacity="0.8"
      strokeWidth="3"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M40 27.5H90C96.8917 27.5 102.5 33.1083 102.5 40V90C102.5 96.8917 96.8917 102.5 90 102.5H40C33.1083 102.5 27.5 96.8917 27.5 90V40C27.5 33.1083 33.1083 27.5 40 27.5ZM40 35.8333H90C92.3 35.8333 94.1667 37.7 94.1667 40V74.85L80.8208 63.4667C76.6958 59.9583 70.2417 59.9583 66.1542 63.4417L35.8333 88.7417V40C35.8333 37.7 37.7 35.8333 40 35.8333ZM54.5833 50.4167C54.5833 53.8667 51.7833 56.6667 48.3333 56.6667C44.8833 56.6667 42.0833 53.8667 42.0833 50.4167C42.0833 46.9667 44.8833 44.1667 48.3333 44.1667C51.7833 44.1667 54.5833 46.9667 54.5833 50.4167ZM42.3375 94.1667H90C92.3 94.1667 94.1667 92.3 94.1667 90V85.8083L75.4125 69.8083C74.4083 68.9458 72.55 68.9417 71.525 69.8125L42.3375 94.1667Z"
      fill="var(--ac-global-color-grey-300)"
    />
  </svg>
);
