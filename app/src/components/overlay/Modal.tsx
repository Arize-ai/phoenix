import { forwardRef, Ref } from "react";
import {
  Modal as AriaModal,
  ModalOverlay as AriaModalOverlay,
  ModalOverlayProps as AriaModalOverlayProps,
} from "react-aria-components";
import { css, keyframes } from "@emotion/react";

import { classNames } from "@arizeai/components";

import { SizingProps } from "../types";

const modalSlideover = keyframes`
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
    `;
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

  &[data-size="S"] {
    --modal-width: var(--ac-global-modal-width-S);
  }

  &[data-size="M"] {
    --modal-width: var(--ac-global-modal-width-M);
  }

  &[data-size="L"] {
    --modal-width: var(--ac-global-modal-width-L);
  }

  &[data-size="fullscreen"] {
    --modal-width: var(--ac-global-modal-width-FULLSCREEN);
  }

  &[data-variant="slideover"] {
    --visual-viewport-height: 100vh;
    width: var(--modal-width);
    height: var(--visual-viewport-height);
    position: fixed;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    top: 0;
    right: 0;
    left: auto;
    align-items: flex-start;
    justify-content: flex-end;

    &[data-entering] {
      animation: ${modalSlideover} 300ms;
    }

    &[data-exiting] {
      animation: ${modalSlideover} 300ms reverse ease-in;
    }

    .react-aria-Dialog {
      height: 100%;
      border-radius: 0;
      border-left-color: var(--ac-global-border-color-dark);
      border-top: none;
      border-bottom: none;
      border-right: none;
    }
  }

  &[data-variant="default"] {
    &[data-entering] {
      animation: ${modalFade} 200ms;
    }

    &[data-exiting] {
      animation: ${modalFade} 200ms reverse ease-in;
    }

    .react-aria-Dialog {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 1001;
      // 90% gives a decent amount of padding around the dialog when it would
      // otherwise be cut off by the edges of the screen
      max-height: calc(100% - var(--ac-global-dimension-size-800));
      overflow: auto;
      // prevent bounce in safari when scrolling
      overscroll-behavior: contain;

      &[data-entering] {
        animation: ${modalZoom} 300ms cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
    }
  }

  .react-aria-Dialog {
    box-shadow: 0 8px 20px rgba(0 0 0 / 0.1);
    width: var(--modal-width);
    border-radius: var(--ac-global-rounding-medium);
    background: var(--ac-global-background-color-dark);
    color: var(--ac-global-text-color-900);
    border: 1px solid var(--ac-global-border-color-light);
    outline: none;

    .ac-Heading[slot="title"] {
      padding: var(--ac-global-dimension-size-100)
        var(--ac-global-dimension-size-200);
      border-bottom: 1px solid var(--ac-global-border-color-light);
    }

    & .ac-DialogHeader {
      position: sticky;
      top: 0;
      background: var(--ac-global-background-color-dark);
      z-index: 1;
    }
  }
`;

export interface ModalProps extends AriaModalOverlayProps {
  variant?: "default" | "slideover";
  size?: SizingProps["size"] | "fullscreen";
}

function Modal(props: ModalProps, ref: Ref<HTMLDivElement>) {
  const { size = "M", variant = "default", ...otherProps } = props;
  return (
    <AriaModal
      {...otherProps}
      data-size={size}
      data-variant={variant}
      ref={ref}
      css={modalCSS}
    />
  );
}

const _Modal = forwardRef(Modal);

const modalOverlayCSS = css`
  position: fixed;
  inset: 0;
  background: rgba(0 0 0 / 0.5);
  z-index: 1000;

  &[data-entering] {
    // ensure overlay animation is longer than child animations
    animation: ${modalFade} 300ms;
  }

  &[data-exiting] {
    // ensure overlay animation is longer than child animations
    animation: ${modalFade} 300ms reverse ease-in;
  }
`;

function ModalOverlay(props: AriaModalOverlayProps, ref: Ref<HTMLDivElement>) {
  return (
    <AriaModalOverlay
      {...props}
      data-testid="modal-overlay"
      css={modalOverlayCSS}
      className={classNames(props.className, "react-aria-ModalOverlay")}
      // default to true, but allow for override
      isDismissable={props.isDismissable ?? true}
      ref={ref}
    />
  );
}

const _ModalOverlay = forwardRef(ModalOverlay);

export { _Modal as Modal, _ModalOverlay as ModalOverlay };
