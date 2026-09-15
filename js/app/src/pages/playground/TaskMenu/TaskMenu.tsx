import { css } from "@emotion/react";
import { useDeferredValue, useState, useTransition } from "react";
import type { Key } from "react-aria-components";
import { useFilter } from "react-aria-components";

import {
  Button,
  CompositeField,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectValue,
  Text,
} from "@phoenix/components";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { PromptVersionSelector } from "@phoenix/pages/playground/PromptMenu";
import type { PlaygroundInstanceSource } from "@phoenix/store/playground";
import {
  getPlaygroundTaskKind,
  isTaskKindLocked,
} from "@phoenix/store/playground";
import { selectPlaygroundInstance } from "@phoenix/store/playground/selectors";

import { ConfirmReplaceTaskDialog } from "./ConfirmReplaceTaskDialog";
import {
  getTaskMenuLabel,
  getTaskMenuSections,
  getTaskMenuSelectedKey,
  parseTaskMenuKey,
  TASK_MENU_LOCK_NOTE,
} from "./taskMenuItems";
import { TaskMenuList } from "./TaskMenuList";
import { useTaskMenuOptions } from "./useTaskMenuOptions";

/**
 * Picks what a playground instance is: a saved prompt, a saved evaluator,
 * or a new draft of either. With one instance on the page any item is
 * offered and choosing another kind replaces the instance; with more, only
 * the page's kind is. A prompt task keeps the version and tag pickers.
 */
export function TaskMenu({ instanceId }: { instanceId: number }) {
  const instance = usePlaygroundContext(selectPlaygroundInstance(instanceId));
  const taskKind = usePlaygroundContext((state) =>
    getPlaygroundTaskKind(state.instances)
  );
  const isLocked = usePlaygroundContext((state) =>
    isTaskKindLocked(state.instances)
  );
  const isDirty = usePlaygroundContext(
    (state) => !!state.dirtyInstances[instanceId]
  );
  const isRunning = usePlaygroundContext((state) =>
    state.instances.some((current) => current.activeRunId != null)
  );
  const replaceInstance = usePlaygroundContext(
    (state) => state.replaceInstance
  );
  const updateInstance = usePlaygroundContext((state) => state.updateInstance);
  if (!instance) {
    throw new Error(`Playground instance ${instanceId} not found`);
  }

  const [hasOpened, setHasOpened] = useState(false);
  const [isLoadingOptions, startLoadingOptions] = useTransition();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [pendingSource, setPendingSource] =
    useState<PlaygroundInstanceSource | null>(null);
  const { contains } = useFilter({ sensitivity: "base" });

  const isPromptTask = instance.task.kind === "prompt";
  const offersPrompts = !isLocked || taskKind === "prompt";
  const offersEvaluators = !isLocked || taskKind === "evaluator";
  const { prompts, promptItems, evaluators } = useTaskMenuOptions({
    // A prompt task needs its prompt's versions before the menu opens.
    includePrompts: offersPrompts && (isPromptTask || hasOpened),
    includeEvaluators: offersEvaluators && hasOpened,
    search: deferredSearch,
    promptsFetchKey: instance.prompt
      ? `${instance.prompt.id}:${instance.prompt.version}`
      : undefined,
  });

  const sections = getTaskMenuSections({
    kind: taskKind,
    isLocked,
    prompts: promptItems,
    evaluators,
    search: deferredSearch,
    matches: contains,
  });
  const selectedKey = getTaskMenuSelectedKey(instance);
  const label = getTaskMenuLabel(instance);

  function loadPrompt(
    source: Extract<PlaygroundInstanceSource, { type: "prompt" }>
  ) {
    updateInstance({
      instanceId,
      patch: { loadingSource: source },
      dirty: null,
    });
  }

  function apply(source: PlaygroundInstanceSource) {
    setPendingSource(null);
    // Another prompt loads into the same prompt task, as it always has;
    // anything else is a different task and replaces the instance.
    if (isPromptTask && source.type === "prompt") {
      loadPrompt(source);
    } else {
      replaceInstance({ instanceId, source });
    }
  }

  function select(key: Key[] | Key | null) {
    if (key == null || Array.isArray(key) || String(key) === selectedKey) {
      return;
    }
    const source = parseTaskMenuKey(String(key), promptItems);
    if (!source) {
      return;
    }
    const replaces = !(isPromptTask && source.type === "prompt");
    if (replaces && isDirty) {
      setPendingSource(source);
    } else {
      apply(source);
    }
  }

  const menu = (
    <Select
      aria-label="Task"
      size="S"
      value={selectedKey}
      onChange={select}
      isDisabled={isRunning}
      onOpenChange={(isOpen) => {
        if (isOpen) startLoadingOptions(() => setHasOpened(true));
      }}
      css={taskSelectCSS}
    >
      <Button
        className="left-child"
        data-has-selection={label ? true : undefined}
      >
        <SelectValue>
          <Truncate maxWidth="var(--text-max-width)" title={label ?? undefined}>
            {label ?? (
              <Text color="text-500" fontStyle="italic">
                Select a task
              </Text>
            )}
          </Truncate>
        </SelectValue>
        <SelectChevronUpDownIcon />
      </Button>
      <Popover placement="bottom start">
        <TaskMenuList
          sections={sections}
          search={search}
          onSearchChange={setSearch}
          isLoading={isLoadingOptions}
          note={isLocked ? TASK_MENU_LOCK_NOTE : null}
        />
      </Popover>
    </Select>
  );

  const selectedPrompt = isPromptTask
    ? (prompts.find((prompt) => prompt.id === instance.prompt?.id) ?? null)
    : null;

  return (
    <div css={taskMenuContainerCSS}>
      {selectedPrompt && instance.prompt ? (
        <CompositeField>
          {menu}
          <PromptVersionSelector
            prompt={selectedPrompt}
            selectedVersionInfo={
              selectedPrompt.versions.find(
                (version) => version.id === instance.prompt?.version
              ) ?? null
            }
            selectedTagName={instance.prompt.tag}
            onSelectVersion={(promptVersionId) =>
              loadPrompt({
                type: "prompt",
                promptId: selectedPrompt.id,
                promptVersionId,
                tagName: null,
              })
            }
            onSelectTag={(tagName) =>
              loadPrompt({
                type: "prompt",
                promptId: selectedPrompt.id,
                promptVersionId: null,
                tagName,
              })
            }
          />
        </CompositeField>
      ) : (
        menu
      )}
      <ConfirmReplaceTaskDialog
        isOpen={pendingSource != null}
        onKeepEditing={() => setPendingSource(null)}
        onDiscard={() => {
          if (pendingSource) apply(pendingSource);
        }}
      />
    </div>
  );
}

const taskMenuContainerCSS = css`
  min-width: 0;
  flex: 0 1 auto;
  overflow: hidden;
  display: flex;
`;

/**
 * The trigger stays usably wide, does not stretch on its placeholder, and
 * may use the room a selection needs; long names truncate.
 */
const taskSelectCSS = css`
  --button-min-width: var(--global-dimension-size-1800);
  --button-max-width-placeholder: var(--global-dimension-size-2400);
  --text-max-width: 30ch;
  min-width: 0;
  max-width: 100%;

  button {
    flex: 1 1 auto;
    min-width: var(--button-min-width);
    max-width: var(--button-max-width-placeholder);
    overflow: hidden;

    &[data-has-selection] {
      max-width: none;
    }
  }

  /* The options load when the menu opens, so the selected task is not in
     the collection yet and the value would read as a placeholder; the
     trigger renders its own label and placeholder instead. */
  .react-aria-SelectValue[data-placeholder] {
    font-style: normal;
    color: inherit;
  }
`;
