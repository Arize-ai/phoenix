import { createContext } from "react";

/**
 * Shared modal state exposed to descendants — mirrors `Modal`'s own props
 * 1:1 rather than deriving ad-hoc flags, so descendants can make whatever
 * decisions they need from the same shape the component itself receives.
 * Add more fields here (e.g. `variant`, `size`) as other descendants need
 * to react to modal-level state.
 */
export type ModalContextValue = {
  isResizable: boolean;
};

export const DEFAULT_MODAL_CONTEXT: ModalContextValue = {
  isResizable: false,
};

export const RESIZABLE_MODAL_CONTEXT: ModalContextValue = {
  isResizable: true,
};

export const ModalContext = createContext<ModalContextValue>(
  DEFAULT_MODAL_CONTEXT
);
