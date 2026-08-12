import type { ReactNode } from "react";
import { createContext, useContext, useMemo } from "react";

export type CardContextValue = {
  /**
   * Whether the card is currently collapsed.
   */
  isCollapsed: boolean;
};

const CardContext = createContext<CardContextValue | null>(null);

export function CardProvider({
  isCollapsed,
  children,
}: CardContextValue & { children: ReactNode }) {
  const value = useMemo(() => ({ isCollapsed }), [isCollapsed]);
  return <CardContext.Provider value={value}>{children}</CardContext.Provider>;
}

/**
 * The state of the closest enclosing card, for content that has to answer to
 * the card it sits in — header content that only makes sense in one of the two
 * collapse states, say.
 *
 * "Closest" is the point: cards nest — message cards render inside an input
 * card's body — and content has to answer to the card it belongs to rather than
 * to any card further up. Reading this rather than matching on DOM ancestry is
 * what makes that automatic.
 *
 * `null` outside a card, so content written for one can bow out rather than
 * assume a state no card is actually in.
 */
export function useCard(): CardContextValue | null {
  return useContext(CardContext);
}
