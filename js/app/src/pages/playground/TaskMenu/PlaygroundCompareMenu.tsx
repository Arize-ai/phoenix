import { css } from "@emotion/react";
import { useDeferredValue, useState, useTransition } from "react";
import { useFilter } from "react-aria-components";

import { Button, Icon, Icons, Popover, Select } from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { getPlaygroundTaskKind } from "@phoenix/store/playground";

import { NUM_MAX_PLAYGROUND_INSTANCES } from "../constants";
import {
  DUPLICATE_SECTION,
  getTaskMenuSections,
  parseTaskMenuKey,
} from "./taskMenuItems";
import { TaskMenuList } from "./TaskMenuList";
import { useTaskMenuOptions } from "./useTaskMenuOptions";

/**
 * Adds a task to compare against: a duplicate of the first task, a saved
 * prompt or evaluator of the page's kind, or a new draft of that kind. The
 * kind is fixed here because the new task always joins an existing one.
 */
export function PlaygroundCompareMenu() {
  const addInstance = usePlaygroundContext((state) => state.addInstance);

  const taskKind = usePlaygroundContext((state) =>
    getPlaygroundTaskKind(state.instances)
  );

  const isFull = usePlaygroundContext(
    (state) => state.instances.length >= NUM_MAX_PLAYGROUND_INSTANCES
  );

  const isRunning = usePlaygroundContext((state) =>
    state.instances.some((instance) => instance.activeRunId != null)
  );

  const [hasOpened, setHasOpened] = useState(false);
  const [isLoadingOptions, startLoadingOptions] = useTransition();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const { contains } = useFilter({ sensitivity: "base" });

  const { promptItems, evaluators } = useTaskMenuOptions({
    includePrompts: hasOpened && taskKind === "prompt",
    includeEvaluators: hasOpened && taskKind === "evaluator",
    search: deferredSearch,
  });

  const sections = [
    DUPLICATE_SECTION,
    ...getTaskMenuSections({
      kind: taskKind,
      isLocked: true,
      prompts: promptItems,
      evaluators,
      search: deferredSearch,
      matches: contains,
    }),
  ];

  return (
    <Select
      aria-label="Compare"
      size="S"
      value={null}
      isDisabled={isFull || isRunning}
      onOpenChange={(isOpen) => {
        if (isOpen) startLoadingOptions(() => setHasOpened(true));
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
          sections={sections}
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
