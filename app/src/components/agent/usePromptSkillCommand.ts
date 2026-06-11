import { useRef, useState } from "react";

import type { PromptCommand } from "@phoenix/agent/slashCommands/promptCommands";
import { findSlashTokens } from "@phoenix/agent/slashCommands/slashTokens";

import type { AvailableAgentSkill } from "./useAvailableAgentSkills";

/**
 * An entry the slash-command menu can offer: either a server-advertised skill
 * or a local prompt command. Both are inserted into the text as `/name `; the
 * `kind` (and a command's optional keybind) only affects the trailing pill the
 * menu renders on the row.
 */
export type SlashMenuItem = {
  name: string;
  summary: string;
  kind: "skill" | "command";
  /** Display string for a command's keyboard shortcut, when it has one. */
  keybind?: string;
};

/**
 * Describes the active slash-command query the user is typing, derived from the
 * textarea value and caret position.
 */
export type ActiveQuery = {
  /** Index of the triggering `/`. */
  slashIndex: number;
  /** Caret position (end of the query). */
  caret: number;
  /** End index (exclusive) of the slash-command token to replace. */
  replacementEnd: number;
  /** The text typed after the `/`, used to filter skills and commands. */
  query: string;
};

const SLASH_NAME_CHAR_PATTERN = /[a-zA-Z0-9-]/;

/**
 * Inspect the text immediately before the caret for an in-progress slash
 * command. A command is active when a `/` appears at the start of the input or
 * after whitespace, the caret is at or past that `/`, and only token-name
 * characters (letters, digits, hyphens) sit between the `/` and the caret.
 */
export function getActiveQuery(
  value: string,
  caret: number
): ActiveQuery | null {
  // Walk backwards from the caret to find the triggering slash.
  let index = caret - 1;
  while (index >= 0) {
    const char = value[index];
    if (char === "/") {
      const preceding = index === 0 ? "" : value[index - 1];
      if (index === 0 || /\s/.test(preceding)) {
        let replacementEnd = caret;
        while (
          replacementEnd < value.length &&
          SLASH_NAME_CHAR_PATTERN.test(value[replacementEnd])
        ) {
          replacementEnd += 1;
        }
        return {
          slashIndex: index,
          caret,
          replacementEnd,
          query: value.slice(index + 1, caret),
        };
      }
      return null;
    }
    // Token-name characters only; anything else (including whitespace) ends
    // the candidate query.
    if (!SLASH_NAME_CHAR_PATTERN.test(char)) {
      return null;
    }
    index -= 1;
  }
  return null;
}

/**
 * Whether two active queries refer to the same `/query` token (same slash
 * position and same typed text). Used to decide when the highlighted menu index
 * should reset: a caret-only move keeps the same query, so the selection is
 * preserved; a text change starts a fresh filter and resets to the top.
 */
export function isSameActiveQuery(
  a: ActiveQuery | null,
  b: ActiveQuery | null
): boolean {
  if (a === null || b === null) {
    return false;
  }
  return a.slashIndex === b.slashIndex && a.query === b.query;
}

function partitionItemsByMatch<Item extends { name: string }>(
  items: Item[],
  query: string,
  selectedNames: ReadonlySet<string>
): { prefixMatches: Item[]; substringMatches: Item[] } {
  const lowerQuery = query.toLowerCase();
  const prefixMatches: Item[] = [];
  const substringMatches: Item[] = [];
  for (const item of items) {
    if (selectedNames.has(item.name)) {
      continue;
    }
    const lowerName = item.name.toLowerCase();
    if (query === "" || lowerName.startsWith(lowerQuery)) {
      prefixMatches.push(item);
    } else if (lowerName.includes(lowerQuery)) {
      substringMatches.push(item);
    }
  }
  return { prefixMatches, substringMatches };
}

function mapSkillToMenuItem(skill: AvailableAgentSkill): SlashMenuItem {
  return {
    name: skill.name,
    summary: skill.summary,
    kind: "skill",
  };
}

function mapCommandToMenuItem(command: PromptCommand): SlashMenuItem {
  return {
    name: command.name,
    summary: command.summary,
    kind: "command",
    keybind: command.keybind,
  };
}

export function getFilteredSlashMenuItems({
  skills,
  commands,
  query,
  selectedNames,
  canShowCommands,
}: {
  skills: AvailableAgentSkill[];
  commands: PromptCommand[];
  query: string;
  selectedNames: ReadonlySet<string>;
  canShowCommands: boolean;
}): SlashMenuItem[] {
  const skillMatches = partitionItemsByMatch(skills, query, selectedNames);
  const commandMatches = canShowCommands
    ? partitionItemsByMatch(commands, query, selectedNames)
    : { prefixMatches: [], substringMatches: [] };
  return [
    ...skillMatches.prefixMatches.map(mapSkillToMenuItem),
    ...commandMatches.prefixMatches.map(mapCommandToMenuItem),
    ...commandMatches.substringMatches.map(mapCommandToMenuItem),
    ...skillMatches.substringMatches.map(mapSkillToMenuItem),
  ];
}

/**
 * Return the recognized token names already present in the prompt, excluding
 * the active token being edited so users can still refine or replace it from
 * the menu. Used to hide already-typed skills/commands from the menu.
 */
export function getSelectedTokenNames(
  value: string,
  availableNames: ReadonlySet<string>,
  activeQuery: ActiveQuery | null
): Set<string> {
  const selected = new Set<string>();
  for (const token of findSlashTokens(value)) {
    if (
      token.start === activeQuery?.slashIndex ||
      !availableNames.has(token.name)
    ) {
      continue;
    }
    selected.add(token.name);
  }
  return selected;
}

export type PromptSkillCommandState = {
  /** Whether the slash menu should be shown. */
  isOpen: boolean;
  /**
   * Menu entries matching the current query, in display order — skills first
   * (catalog order), then commands. One flat list: keyboard navigation and
   * `activeIndex` run straight over it.
   */
  filteredItems: SlashMenuItem[];
  /** Index of the highlighted entry in `filteredItems`. */
  activeIndex: number;
  /** Set the highlighted index (e.g. on hover). */
  setActiveIndex: (index: number) => void;
  /**
   * Recompute menu state from the latest textarea value and caret. Call on
   * every change and on selection-affecting key events.
   */
  syncFromInput: (value: string, caret: number) => void;
  /** Close the menu and suppress it until the next fresh `/` trigger. */
  dismiss: () => void;
  /**
   * Apply a menu selection to `value`, replacing the active `/query` with
   * `/name ` and returning the new value plus the caret position to restore.
   * Returns null when there is no active query to replace.
   */
  selectItem: (
    value: string,
    item: SlashMenuItem
  ) => { value: string; caret: number } | null;
};

/**
 * Owns the slash-command interaction state for the prompt input: trigger
 * detection, query filtering across skills and local commands, keyboard-driven
 * highlight, dismissal, and text insertion on selection. The textarea remains
 * the focus owner; this hook only computes state from `(value, caret)`
 * snapshots the textarea hands it.
 */
export function usePromptSkillCommand(
  skills: AvailableAgentSkill[],
  commands: PromptCommand[]
): PromptSkillCommandState {
  const [activeQuery, setActiveQuery] = useState<ActiveQuery | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(
    () => new Set()
  );
  // Tracks the active query so we can decide when to reset the highlight: the
  // index resets only when the *query string* changes, not on caret-only syncs
  // (e.g. arrow-key navigation), which would otherwise snap back to the top.
  const activeQueryRef = useRef<ActiveQuery | null>(null);
  activeQueryRef.current = activeQuery;
  // When the user dismisses the menu with Escape, suppress re-opening until the
  // dismissed `/query` is edited, so the literal `/` can be typed normally.
  const dismissedQueryRef = useRef<{
    slashIndex: number;
    query: string;
  } | null>(null);

  const filteredItems: SlashMenuItem[] = activeQuery
    ? getFilteredSlashMenuItems({
        skills,
        commands,
        query: activeQuery.query,
        selectedNames,
        canShowCommands: activeQuery.slashIndex === 0,
      })
    : [];
  const isOpen = activeQuery !== null && filteredItems.length > 0;

  const syncFromInput = (value: string, caret: number) => {
    const next = getActiveQuery(value, caret);
    const availableNames = new Set([
      ...skills.map((skill) => skill.name),
      ...commands.map((command) => command.name),
    ]);
    setSelectedNames(getSelectedTokenNames(value, availableNames, next));
    if (next === null) {
      setActiveQuery(null);
      dismissedQueryRef.current = null;
      return;
    }
    // Stay dismissed while the same `/query` is still under the caret. Editing
    // the query (different text or a different slash) re-arms the menu.
    const dismissed = dismissedQueryRef.current;
    if (
      dismissed &&
      dismissed.slashIndex === next.slashIndex &&
      dismissed.query === next.query
    ) {
      setActiveQuery(null);
      return;
    }
    dismissedQueryRef.current = null;
    setActiveQuery(next);
    // Reset the highlight only when the query text changed (new trigger or new
    // filter), preserving the user's arrow-key selection on caret-only syncs.
    if (!isSameActiveQuery(activeQueryRef.current, next)) {
      setActiveIndex(0);
    }
  };

  const dismiss = () => {
    if (activeQuery) {
      dismissedQueryRef.current = {
        slashIndex: activeQuery.slashIndex,
        query: activeQuery.query,
      };
    }
    setActiveQuery(null);
  };

  const selectItem = (value: string, item: SlashMenuItem) => {
    if (!activeQuery) {
      return null;
    }
    const before = value.slice(0, activeQuery.slashIndex);
    const after = value.slice(activeQuery.replacementEnd);
    const insertion = `/${item.name} `;
    const nextValue = `${before}${insertion}${after}`;
    setActiveQuery(null);
    dismissedQueryRef.current = null;
    return { value: nextValue, caret: before.length + insertion.length };
  };

  // Clamp the active index into the filtered range without an effect.
  const clampedActiveIndex =
    filteredItems.length === 0
      ? 0
      : Math.min(activeIndex, filteredItems.length - 1);

  return {
    isOpen,
    filteredItems,
    activeIndex: clampedActiveIndex,
    setActiveIndex,
    syncFromInput,
    dismiss,
    selectItem,
  };
}
