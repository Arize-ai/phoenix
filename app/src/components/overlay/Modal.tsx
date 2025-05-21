import { forwardRef, Ref } from "react";
import {
  Modal as AriaModal,
  ModalOverlayProps as AriaModalOverlayProps,
} from "react-aria-components";
import { css, keyframes } from "@emotion/react";

import { SizingProps } from "../types";

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
  --modal-width: var(--ac-global-modal-width-M);
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

  &[data-size="S"] {
    --modal-width: var(--ac-global-modal-width-S);
  }

  &[data-size="M"] {
    --modal-width: var(--ac-global-modal-width-M);
  }

  .react-aria-Dialog {
    box-shadow: 0 8px 20px rgba(0 0 0 / 0.1);
    width: var(--modal-width);
    border-radius: var(--ac-global-rounding-medium);
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

export interface ModalProps extends AriaModalOverlayProps, SizingProps {}

function Modal(props: ModalProps, ref: Ref<HTMLDivElement>) {
  const { size = "M", ...otherProps } = props;
  return (
    <AriaModal {...otherProps} data-size={size} ref={ref} css={modalCSS} />
  );
}

const _Modal = forwardRef(Modal);
export { _Modal as Modal };
