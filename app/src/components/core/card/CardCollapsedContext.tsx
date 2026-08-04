import type { ReactNode } from "react";
import { createContext, useContext } from "react";

const CardCollapsedContext = createContext<boolean>(false);

export function CardCollapsedProvider({
  isCollapsed,
  children,
}: {
  isCollapsed: boolean;
  children: ReactNode;
}) {
  return (
    <CardCollapsedContext.Provider value={isCollapsed}>
      {children}
    </CardCollapsedContext.Provider>
  );
}

/**
 * Whether the closest enclosing card is collapsed, for header content that only
 * makes sense in one of the two states.
 *
 * "Closest" is the point: cards nest — message cards render inside an input
 * card's body — and content has to answer to the card it belongs to rather than
 * to any card further up. Reading this rather than matching on DOM ancestry is
 * what makes that automatic.
 *
 * `false` outside a card, so header content written for a collapsed card stays
 * out of the way when it is rendered somewhere without one.
 */
export function useCardIsCollapsed(): boolean {
  return useContext(CardCollapsedContext);
}
