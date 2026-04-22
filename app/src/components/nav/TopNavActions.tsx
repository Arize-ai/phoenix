import { css } from "@emotion/react";
import { createContext, type ReactNode, useContext, useState } from "react";
import { createPortal } from "react-dom";

type TopNavActionsContextValue = {
  target: HTMLDivElement | null;
  setTarget: (el: HTMLDivElement | null) => void;
};

const TopNavActionsContext = createContext<TopNavActionsContextValue | null>(
  null
);

export function TopNavActionsProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  return (
    <TopNavActionsContext.Provider value={{ target, setTarget }}>
      {children}
    </TopNavActionsContext.Provider>
  );
}

const slotCSS = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--global-dimension-static-size-100);
  margin-inline-start: auto;
`;

/**
 * Portal target rendered inside TopNavbar. Pages declare content via
 * <TopNavActions> and it lands here.
 */
export function TopNavActionsSlot() {
  const ctx = useContext(TopNavActionsContext);
  if (!ctx) {
    throw new Error(
      "TopNavActionsSlot must be rendered inside a TopNavActionsProvider"
    );
  }
  return (
    <div ref={ctx.setTarget} css={slotCSS} data-testid="top-nav-actions" />
  );
}

/**
 * Declares content to be rendered in the top nav's right-side action area.
 * Children render in the declarer's React tree (inheriting its contexts) but
 * are portaled into the TopNavbar's slot via createPortal.
 */
export function TopNavActions({ children }: { children: ReactNode }) {
  const ctx = useContext(TopNavActionsContext);
  if (!ctx) {
    throw new Error(
      "TopNavActions must be rendered inside a TopNavActionsProvider"
    );
  }
  if (!ctx.target) return null;
  return createPortal(children, ctx.target);
}
