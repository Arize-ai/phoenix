import { css } from "@emotion/react";
import { motion } from "motion/react";
import { useLayoutEffect } from "react";

import { Flex, Text } from "@phoenix/components";
import { classNames } from "@phoenix/utils/classNames";

import type { AvailableAgentSkill } from "./useAvailableAgentSkills";

const skillMenuSpring = {
  type: "spring" as const,
  stiffness: 700,
  damping: 28,
  mass: 0.65,
};

const skillMenuCSS = css`
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

const skillMenuItemCSS = css`
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

const skillMenuNameCSS = css`
  font-family: "Geist Mono", monospace;
  font-size: var(--global-font-size-s);
`;

export type SkillMenuProps = {
  /** Skills to display, already filtered to the active query. */
  skills: AvailableAgentSkill[];
  /** Index of the highlighted item for keyboard navigation. */
  activeIndex: number;
  /** Called when the user picks a skill (click or Enter). */
  onSelect: (skill: AvailableAgentSkill) => void;
  /** Called when the pointer hovers an item, to sync the active index. */
  onActiveIndexChange: (index: number) => void;
  /** DOM id used to wire `aria-activedescendant` from the textarea. */
  listboxId: string;
  /** Builds the DOM id for an option at `index`. */
  getOptionId: (index: number) => string;
};

/**
 * The slash-command skill picker shown above the prompt textarea.
 *
 * This is a presentational listbox: it does not own focus (the textarea keeps
 * it) and is driven entirely by `activeIndex`. Keyboard handling lives in the
 * textarea's key handler, which moves `activeIndex` and triggers `onSelect`.
 * Accessibility is provided through `aria-activedescendant` on the textarea
 * pointing at the active option's id.
 */
export function SkillMenu({
  skills,
  activeIndex,
  onSelect,
  onActiveIndexChange,
  listboxId,
  getOptionId,
}: SkillMenuProps) {
  useLayoutEffect(() => {
    document.getElementById(getOptionId(activeIndex))?.scrollIntoView({
      block: "nearest",
    });
  }, [activeIndex, getOptionId]);

  if (skills.length === 0) {
    return null;
  }
  return (
    <motion.div
      css={skillMenuCSS}
      id={listboxId}
      role="listbox"
      aria-label="Skills"
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{
        ...skillMenuSpring,
        opacity: { duration: 0.12 },
      }}
    >
      {skills.map((skill, index) => {
        const isActive = index === activeIndex;
        return (
          <button
            key={skill.name}
            type="button"
            id={getOptionId(index)}
            role="option"
            aria-selected={isActive}
            data-active={isActive}
            css={skillMenuItemCSS}
            className={classNames("skill-menu__item", {
              "skill-menu__item--active": isActive,
            })}
            // Prevent the textarea from losing focus on mousedown.
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => onActiveIndexChange(index)}
            onClick={() => onSelect(skill)}
          >
            <Flex direction="column" gap="size-25">
              <span css={skillMenuNameCSS}>/{skill.name}</span>
              <Text size="XS" color="text-700">
                {skill.summary}
              </Text>
            </Flex>
          </button>
        );
      })}
    </motion.div>
  );
}
