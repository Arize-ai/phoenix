import type { PropsWithChildren } from "react";
import { createContext, startTransition, useContext, useState } from "react";

import type { CardProps } from "@phoenix/components";

/**
 * The disclosures the span details expand/collapse control acts on.
 *
 * Every span kind renders its input and output sections differently, but each of
 * those renders under one of these keys, so the control reaches them all
 * without knowing which kind is on screen. Nested cards — a prompt template or
 * an individual tool schema — are left to the reader.
 */
export const SPAN_INFO_CARD_KEYS = [
  "input",
  "output",
  "toolDefinitions",
  "metadata",
  "attributes",
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
   * Opens or collapses every top-level disclosure at once, overriding whatever
   * the reader had set on the individual disclosure.
   */
  setAllCardsOpen: (isOpen: boolean) => void;
};

const SpanInfoCardsContext = createContext<SpanInfoCardsContextType | null>(
  null
);

/**
 * Shares the span details open state between the top-level disclosures and the
 * control that expands or collapses them all.
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
   * card can mount the input, output, metadata, and attributes views at once.
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
 * Returns the span details card open state and actions.
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
 * Open-state props that put a top-level span detail disclosure under the
 * details expand/collapse control.
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
