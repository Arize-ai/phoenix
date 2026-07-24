import { css, keyframes } from "@emotion/react";
import type { Ref } from "react";
import type { ModalOverlayProps as AriaModalOverlayProps } from "react-aria-components";
import {
  Modal as AriaModal,
  ModalOverlay as AriaModalOverlay,
} from "react-aria-components";

import {
  MODAL_DIALOG_Z_INDEX,
  MODAL_OVERLAY_Z_INDEX,
} from "@phoenix/components/core/zIndex";
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
export const centeredModalCSS = css`
  --modal-width: var(--global-modal-width-M);

  &[data-size="S"] {
    --modal-width: var(--global-modal-width-S);
  }

  &[data-size="M"] {
    --modal-width: var(--global-modal-width-M);
  }

  &[data-size="L"] {
    --modal-width: var(--global-modal-width-L);
  }

  &[data-size="fullscreen"] {
    --modal-width: var(--global-modal-width-FULLSCREEN);
  }

  &[data-entering] {
    animation: ${modalFade} 200ms;
  }

  &[data-exiting] {
    animation: ${modalFade} 200ms reverse ease-in;
  }

  .react-aria-Dialog {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: ${MODAL_DIALOG_Z_INDEX};
    // 90% gives a decent amount of padding around the dialog when it would
    // otherwise be cut off by the edges of the screen
    max-height: calc(100% - var(--global-dimension-size-800));
    overflow: auto;
    // prevent bounce in safari when scrolling
    overscroll-behavior: contain;

    &[data-entering] {
      animation: ${modalZoom} 300ms cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
  }

  .react-aria-Dialog {
    box-shadow: 0 8px 20px rgba(0 0 0 / 0.1);
    width: var(--modal-width);
    border-radius: var(--global-rounding-medium);
    background: var(--global-background-color-default);
    color: var(--global-text-color-900);
    border: 1px solid var(--global-border-color-default);
    outline: none;

    & .dialog__header {
      position: sticky;
      top: 0;
      z-index: 1;
    }
  }
`;

export type ModalSize = "S" | "M" | "L" | "fullscreen";

export type ModalProps = AriaModalOverlayProps & {
  size?: ModalSize;
};

function Modal({ ref, ...props }: ModalProps & { ref?: Ref<HTMLDivElement> }) {
  const { size = "M", ...rest } = props;

  return (
    <AriaModal {...rest} data-size={size} ref={ref} css={centeredModalCSS} />
  );
}

export const modalBackdropCSS = css`
  position: fixed;
  inset: 0;
  background: var(--global-overlay-backdrop-color);
  z-index: ${MODAL_OVERLAY_Z_INDEX};

  &[data-entering] {
    // ensure overlay animation is longer than child animations
    animation: ${modalFade} 300ms;
  }

  &[data-exiting] {
    // ensure overlay animation is longer than child animations
    animation: ${modalFade} 300ms reverse ease-in;
  }
`;

function ModalOverlay({
  ref,
  ...props
}: AriaModalOverlayProps & { ref?: Ref<HTMLDivElement> }) {
  return (
    <AriaModalOverlay
      {...props}
      data-testid="modal-overlay"
      css={modalBackdropCSS}
      // default to true, but allow for override
      isDismissable={props.isDismissable ?? true}
      ref={ref}
    />
  );
}

export { Modal, ModalOverlay };
