import type { PropsWithChildren } from "react";
import { createContext, startTransition, useContext, useState } from "react";

import type { CardProps } from "@phoenix/components";

/**
 * The cards the info tab's expand/collapse control acts on.
 *
 * Every span kind renders its input and output cards differently, but each of
 * those renders under one of these keys, so the control reaches them all
 * without knowing which kind is on screen. Cards nested inside these — a
 * prompt template, a tool schema — are left to the reader.
 */
export const SPAN_INFO_CARD_KEYS = [
  "annotations",
  "input",
  "output",
  "metadata",
  "attributes",
  "notes",
] as const;

export type SpanInfoCardKey = (typeof SPAN_INFO_CARD_KEYS)[number];

type SpanInfoCardsContextType = {
  /**
   * The open state chosen for each card. A card missing from this map has not
   * been touched and still decides for itself, which is how cards keep the
   * defaults that suit their content.
   */
  openStateByCard: Partial<Record<SpanInfoCardKey, boolean>>;

  /** Records the open state the reader asked for on a single card. */
  setCardOpen: (cardKey: SpanInfoCardKey, isOpen: boolean) => void;

  /** Whether every card is currently collapsed. Drives the toolbar toggle. */
  areAllCardsCollapsed: boolean;

  /**
   * Opens or collapses every card at once, overriding whatever the reader had
   * set on the individual cards.
   */
  setAllCardsOpen: (isOpen: boolean) => void;
};

const SpanInfoCardsContext = createContext<SpanInfoCardsContextType | null>(
  null
);

/**
 * Shares the info tab's card open state between the cards and the control that
 * expands or collapses them all.
 *
 * Mount above the span details view rather than inside it: the reader picks
 * spans from the trace tree while the drawer stays open, and a collapse they
 * asked for should hold across that.
 */
export function SpanInfoCardsProvider({ children }: PropsWithChildren) {
  const [openStateByCard, setOpenStateByCard] = useState<
    Partial<Record<SpanInfoCardKey, boolean>>
  >({});

  const setCardOpen = (cardKey: SpanInfoCardKey, isOpen: boolean) => {
    setOpenStateByCard((prev) => ({ ...prev, [cardKey]: isOpen }));
  };

  /**
   * Applies a global expand/collapse as a non-urgent update — opening every
   * card can mount an entire attributes table and both message lists at once.
   */
  const setAllCardsOpen = (isOpen: boolean) => {
    startTransition(() => {
      setOpenStateByCard(
        Object.fromEntries(SPAN_INFO_CARD_KEYS.map((key) => [key, isOpen]))
      );
    });
  };

  const areAllCardsCollapsed = SPAN_INFO_CARD_KEYS.every(
    (cardKey) => openStateByCard[cardKey] === false
  );

  return (
    <SpanInfoCardsContext.Provider
      value={{
        openStateByCard,
        setCardOpen,
        areAllCardsCollapsed,
        setAllCardsOpen,
      }}
    >
      {children}
    </SpanInfoCardsContext.Provider>
  );
}

/**
 * Returns the info tab's card open state and actions.
 *
 * @throws Error when called outside of a `SpanInfoCardsProvider`.
 */
export function useSpanInfoCards() {
  const context = useContext(SpanInfoCardsContext);
  if (context === null) {
    throw new Error(
      "useSpanInfoCards must be used within a SpanInfoCardsProvider"
    );
  }
  return context;
}

/**
 * `Card` props that put one of the info tab's main cards under the tab's
 * expand/collapse control. Spread these alongside `defaultCardProps`.
 *
 * `isOpen` stays undefined until something sets the card's state, so a card
 * nobody has touched still honors its own `defaultOpen`.
 */
export function useSpanInfoCardProps(
  cardKey: SpanInfoCardKey
): SpanInfoCardProps {
  const { openStateByCard, setCardOpen } = useSpanInfoCards();
  return {
    isOpen: openStateByCard[cardKey],
    onOpenChange: (isOpen) => setCardOpen(cardKey, isOpen),
  };
}

/** The `Card` props {@link useSpanInfoCardProps} supplies. */
export type SpanInfoCardProps = Pick<CardProps, "isOpen" | "onOpenChange">;
