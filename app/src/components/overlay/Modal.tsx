import React, { Ref } from "react";
import {
  Modal as AriaModal,
  ModalOverlayProps as AriaModalOverlayProps,
} from "react-aria-components";
import { css, keyframes } from "@emotion/react";

const modalFade = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
  `;
const modalZoom = keyframes`
  from {
    transform: scale(0.8);
  }
  to {
    transform: scale(1);
  }
  `;
const modalCSS = css`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: var(--visual-viewport-height);
  background: rgba(0 0 0 / 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  &[data-entering] {
    animation: ${modalFade} 200ms;
  }

  &[data-exiting] {
    animation: ${modalFade} 150ms reverse ease-in;
  }

  .react-aria-Dialog {
    box-shadow: 0 8px 20px rgba(0 0 0 / 0.1);
    border-radius: 6px;
    background: var(--ac-global-background-color-dark);
    color: var(--ac-global-text-color-900);
    border: 1px solid var(--ac-global-border-color-light);
    outline: none;

    &[data-entering] {
      animation: ${modalZoom} 300ms cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    .ac-Heading[slot="title"] {
      padding: var(--ac-global-dimension-size-100)
        var(--ac-global-dimension-size-200);
      border-bottom: 1px solid var(--ac-global-border-color-light);
    }
  }
`;

export type ModalProps = AriaModalOverlayProps;
function Modal(props: ModalProps, ref: Ref<HTMLDivElement>) {
  return <AriaModal {...props} ref={ref} css={modalCSS} />;
}

const _Modal = React.forwardRef(Modal);
export { _Modal as Modal };
