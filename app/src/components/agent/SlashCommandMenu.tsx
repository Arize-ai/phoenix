import { css } from "@emotion/react";
import { motion } from "motion/react";
import { useLayoutEffect } from "react";

import {
  Flex,
  KeyboardToken,
  Text,
  Token,
  VisuallyHidden,
} from "@phoenix/components";
import { classNames } from "@phoenix/utils/classNames";

import type { SlashMenuItem } from "./usePromptSkillCommand";

const slashCommandMenuSpring = {
  type: "spring" as const,
  stiffness: 700,
  damping: 28,
  mass: 0.65,
};

const slashCommandMenuCSS = css`
  position: absolute;
  bottom: calc(100% - var(--global-dimension-size-150));
  left: 0;
  right: 0;
  max-height: 240px;
  overflow-y: auto;
  scroll-padding-bottom: var(--global-dimension-size-150);
  overscroll-behavior: none;
  background-color: var(--prompt-input-background-color);
  border: var(--global-border-size-thin) solid var(--global-menu-border-color);
  border-radius: var(--global-rounding-medium);
  // box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
  padding: var(--global-dimension-size-50);
  // The menu's bottom edge overlaps the prompt input by size-150 (see the
  // bottom offset above), so add that back on top of the size-50 used on the
  // other edges to keep the visible bottom padding consistent.
  padding-bottom: var(--global-dimension-size-200);
`;

const slashCommandMenuItemCSS = css`
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  border-radius: var(--global-rounding-small);
  padding: var(--global-dimension-size-100) var(--global-dimension-size-150);
  cursor: pointer;
  color: var(--global-text-color-900);

  &[data-active="true"],
  &:hover {
    background-color: var(--global-color-primary-100);
  }
`;

const slashCommandMenuNameCSS = css`
  font-family: var(--global-font-family-mono);
  font-size: var(--global-font-size-s);
`;

/**
 * The trailing pill that identifies a row: skills are tagged `skill`, commands
 * with a shortcut show their keybind, and plain commands include a screen-reader
 * label so the visual "unmarked means command" convention is accessible.
 */
function SlashMenuItemPill({ item }: { item: SlashMenuItem }) {
  if (item.kind === "skill") {
    return <Token size="S">skill</Token>;
  }
  if (item.keybind) {
    return (
      <>
        <VisuallyHidden>command</VisuallyHidden>
        <KeyboardToken>{item.keybind}</KeyboardToken>
      </>
    );
  }
  return <VisuallyHidden>command</VisuallyHidden>;
}

export type SlashCommandMenuProps = {
  /**
   * Entries to display, already filtered to the active query, in display order
   * (skills first, then commands). One flat list; each row carries a trailing
   * pill identifying its kind.
   */
  items: SlashMenuItem[];
  /** Index of the highlighted item for keyboard navigation. */
  activeIndex: number;
  /** Called with the item's index when the user picks it. */
  onSelect: (index: number) => void;
  /** Called when the pointer hovers an item, to sync the active index. */
  onActiveIndexChange: (index: number) => void;
  /** DOM id used to wire `aria-activedescendant` from the textarea. */
  listboxId: string;
  /** Builds the DOM id for an option at `index`. */
  getOptionId: (index: number) => string;
};

/**
 * The slash-command picker shown above the prompt textarea, listing skills and
 * local commands as one flat list with a trailing pill per row (see
 * {@link SlashMenuItemPill}).
 *
 * This is a presentational listbox: it does not own focus (the textarea keeps
 * it) and is driven entirely by `activeIndex`. Keyboard handling lives in the
 * textarea's key handler, which moves `activeIndex` and triggers `onSelect`.
 * Accessibility is provided through `aria-activedescendant` on the textarea
 * pointing at the active option's id.
 */
export function SlashCommandMenu({
  items,
  activeIndex,
  onSelect,
  onActiveIndexChange,
  listboxId,
  getOptionId,
}: SlashCommandMenuProps) {
  useLayoutEffect(() => {
    document.getElementById(getOptionId(activeIndex))?.scrollIntoView({
      block: "nearest",
    });
  }, [activeIndex, getOptionId]);

  if (items.length === 0) {
    return null;
  }
  return (
    <motion.div
      css={slashCommandMenuCSS}
      id={listboxId}
      role="listbox"
      aria-label="Slash commands"
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{
        ...slashCommandMenuSpring,
        opacity: { duration: 0.12 },
      }}
    >
      {items.map((item, index) => {
        const isActive = index === activeIndex;
        return (
          <button
            key={item.name}
            type="button"
            id={getOptionId(index)}
            role="option"
            aria-selected={isActive}
            data-active={isActive}
            css={slashCommandMenuItemCSS}
            className={classNames("slash-command-menu__item", {
              "slash-command-menu__item--active": isActive,
            })}
            // Prevent the textarea from losing focus on mousedown.
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => onActiveIndexChange(index)}
            onClick={() => onSelect(index)}
          >
            <Flex direction="column" gap="size-25">
              <Flex
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                gap="size-100"
              >
                <span css={slashCommandMenuNameCSS}>/{item.name}</span>
                <SlashMenuItemPill item={item} />
              </Flex>
              <Text size="XS" color="text-700">
                {item.summary}
              </Text>
            </Flex>
          </button>
        );
      })}
    </motion.div>
  );
}
