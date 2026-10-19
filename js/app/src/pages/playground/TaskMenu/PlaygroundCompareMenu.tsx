import { css } from "@emotion/react";
import { useDeferredValue, useState, useTransition } from "react";
import { useFilter } from "react-aria-components";

import { Button, Icon, Icons, Popover, Select } from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import type { PlaygroundTaskMember } from "@phoenix/store/playground";
import { getPlaygroundTaskRole } from "@phoenix/store/playground";

import { NUM_MAX_PLAYGROUND_INSTANCES } from "../constants";
import {
  DUPLICATE_SECTION,
  getTaskMenuTabs,
  parseTaskMenuKey,
} from "./taskMenuItems";
import { TaskMenuList } from "./TaskMenuList";
import { useTaskMenuOptions } from "./useTaskMenuOptions";

/**
 * Adds a task to compare against: a duplicate of the first task, a saved
 * prompt, decision or evaluator of the page's role, or a new draft of one.
 * The role is fixed here because the new task always joins an existing one;
 * a tested page offers prompts and decisions, so either can be compared with
 * the other.
 */
export function PlaygroundCompareMenu() {
  const addInstance = usePlaygroundContext((state) => state.addInstance);

  const taskRole = usePlaygroundContext((state) =>
    getPlaygroundTaskRole(state.instances)
  );

  const isFull = usePlaygroundContext(
    (state) => state.instances.length >= NUM_MAX_PLAYGROUND_INSTANCES
  );

  const isRunning = usePlaygroundContext((state) =>
    state.instances.some((instance) => instance.activeRunId != null)
  );

  // The tab shown; the first instance's member, as Compare most likely
  // adds another of it.
  const firstMember = usePlaygroundContext(
    (state) => state.instances[0]?.task.member ?? "prompt"
  );
  const [selectedMember, setSelectedMember] =
    useState<PlaygroundTaskMember>(firstMember);

  // Bumped on every opening, so evaluators saved since then show.
  const [openCount, setOpenCount] = useState(0);
  const hasOpened = openCount > 0;
  const [isLoadingOptions, startLoadingOptions] = useTransition();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const { contains } = useFilter({ sensitivity: "base" });

  const { promptItems, decisions, evaluators } = useTaskMenuOptions({
    includePrompts: hasOpened && taskRole === "tested",
    includeDecisions: hasOpened && taskRole === "tested",
    includeEvaluators: hasOpened && taskRole === "judging",
    search: deferredSearch,
    evaluatorsFetchKey: openCount,
  });

  // Locked to the page's role: a tested page has a tab each for prompts and
  // decisions, a judging page one list without a tab strip, the duplicate
  // action ahead of either.
  const tabs = getTaskMenuTabs({
    role: taskRole,
    isLocked: true,
    prompts: promptItems,
    decisions,
    evaluators,
    search: deferredSearch,
    matches: contains,
  });

  return (
    <Select
      aria-label="Compare"
      size="S"
      value={null}
      isDisabled={isFull || isRunning}
      onOpenChange={(isOpen) => {
        if (isOpen) {
          startLoadingOptions(() => setOpenCount((count) => count + 1));
        }
      }}
      onChange={(key) => {
        const source =
          key == null ? null : parseTaskMenuKey(String(key), promptItems);

        if (source) addInstance(source);
      }}
      css={compareSelectCSS}
    >
      <Button size="S" leadingVisual={<Icon svg={<Icons.PlusCircle />} />}>
        Compare
      </Button>
      <Popover placement="bottom end">
        <TaskMenuList
          tabs={tabs}
          selectedMember={selectedMember}
          onSelectedMemberChange={setSelectedMember}
          leadingSections={[DUPLICATE_SECTION]}
          search={search}
          onSearchChange={setSearch}
          isLoading={isLoadingOptions}
        />
      </Popover>
    </Select>
  );
}

// A Select styles its trigger as a field; Compare is a plain button.
const compareSelectCSS = css`
  button {
    width: auto;
    justify-content: center;
    gap: var(--global-dimension-size-50);

    &:not([data-disabled="true"]) {
      &[data-pressed],
      &:hover {
        --button-border-color: var(--button-border-color-hover, inherit);
      }
    }
  }
`;
