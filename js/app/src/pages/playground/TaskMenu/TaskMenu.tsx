import { css } from "@emotion/react";
import type { ReactNode } from "react";
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
import { DecisionVersionSelector } from "@phoenix/pages/playground/DecisionVersionSelector";
import type { PromptData } from "@phoenix/pages/playground/PromptMenu";
import { PromptVersionSelector } from "@phoenix/pages/playground/PromptMenu";
import type {
  PlaygroundInstanceSource,
  PlaygroundNormalizedInstance,
  PlaygroundTaskMember,
} from "@phoenix/store/playground";
import {
  getPlaygroundTaskRole,
  isTaskRoleLocked,
} from "@phoenix/store/playground";
import { selectPlaygroundInstance } from "@phoenix/store/playground/selectors";

import { ConfirmReplaceTaskDialog } from "./ConfirmReplaceTaskDialog";
import {
  doesSourceLoadInPlace,
  getTaskMenuLabel,
  getTaskMenuSelectedKey,
  getTaskMenuTabs,
  parseTaskMenuKey,
  TASK_MENU_LOCK_NOTE,
} from "./taskMenuItems";
import { TaskMenuList } from "./TaskMenuList";
import { useTaskMenuOptions } from "./useTaskMenuOptions";

/**
 * Picks what a playground instance is: a saved prompt, decision or
 * evaluator, or a new draft of any, from a tab per member, grouped by role:
 * prompts and decisions (tested), then evaluators (judging). With one
 * instance on the page every tab is offered and choosing from another
 * member's tab replaces the instance; with more, only the page's role's
 * members are, so prompts and decisions can sit side by side. A prompt or
 * decision task keeps the version and tag pickers.
 */
export function TaskMenu({ instanceId }: { instanceId: number }) {
  const instance = usePlaygroundContext(selectPlaygroundInstance(instanceId));

  const taskRole = usePlaygroundContext((state) =>
    getPlaygroundTaskRole(state.instances)
  );

  const isLocked = usePlaygroundContext((state) =>
    isTaskRoleLocked(state.instances)
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

  // How many times the menu has opened: the options load on the first and
  // the evaluators are fetched again on each, so saves made in between show.
  const [openCount, setOpenCount] = useState(0);
  const hasOpened = openCount > 0;
  // The menu opens on the tab of what the task is now.
  const [selectedMember, setSelectedMember] = useState<PlaygroundTaskMember>(
    instance.task.member
  );
  const [isLoadingOptions, startLoadingOptions] = useTransition();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const [pendingSource, setPendingSource] =
    useState<PlaygroundInstanceSource | null>(null);

  const { contains } = useFilter({ sensitivity: "base" });

  const member = instance.task.member;
  const isPromptTask = member === "prompt";
  const isDecisionTask = member === "decision";
  const offersTested = !isLocked || taskRole === "tested";
  const offersEvaluators = !isLocked || taskRole === "judging";

  const { prompts, promptItems, decisions, evaluators } = useTaskMenuOptions({
    // A prompt task needs its prompt's versions before the menu opens.
    includePrompts: offersTested && (isPromptTask || hasOpened),
    includeDecisions: offersTested && hasOpened,
    includeEvaluators: offersEvaluators && hasOpened,
    search: deferredSearch,
    promptsFetchKey: instance.prompt
      ? `${instance.prompt.id}:${instance.prompt.version}`
      : undefined,
    evaluatorsFetchKey: openCount,
  });

  const tabs = getTaskMenuTabs({
    role: taskRole,
    isLocked,
    prompts: promptItems,
    decisions,
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

  function loadDecision(
    source: Extract<PlaygroundInstanceSource, { type: "decision" }>
  ) {
    updateInstance({
      instanceId,
      patch: { loadingSource: source },
      dirty: null,
    });
  }

  function apply(source: PlaygroundInstanceSource) {
    setPendingSource(null);

    // Another prompt loads into the same prompt task, as it always has, and
    // another decision into the same decision task; anything else is a
    // different task and replaces the instance.
    if (isPromptTask && source.type === "prompt") {
      loadPrompt(source);
    } else if (isDecisionTask && source.type === "decision") {
      loadDecision(source);
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

    const replaces = !doesSourceLoadInPlace(member, source);

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
        if (isOpen) {
          setSelectedMember(instance.task.member);
          startLoadingOptions(() => setOpenCount((count) => count + 1));
        }
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
          tabs={tabs}
          selectedMember={selectedMember}
          onSelectedMemberChange={setSelectedMember}
          search={search}
          onSearchChange={setSearch}
          isLoading={isLoadingOptions}
          note={isLocked ? TASK_MENU_LOCK_NOTE : null}
        />
      </Popover>
    </Select>
  );

  return (
    <div css={taskMenuContainerCSS}>
      <TaskVersionPickers
        instance={instance}
        prompts={prompts}
        loadPrompt={loadPrompt}
        loadDecision={loadDecision}
      >
        {menu}
      </TaskVersionPickers>
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

/**
 * The task menu, with the version and tag pickers of what it holds beside it:
 * a prompt's, or a decision's. A task without a saved prompt or decision has
 * none.
 */
function TaskVersionPickers({
  instance,
  prompts,
  loadPrompt,
  loadDecision,
  children,
}: {
  instance: PlaygroundNormalizedInstance;
  prompts: PromptData[];
  loadPrompt: (
    source: Extract<PlaygroundInstanceSource, { type: "prompt" }>
  ) => void;
  loadDecision: (
    source: Extract<PlaygroundInstanceSource, { type: "decision" }>
  ) => void;
  children: ReactNode;
}) {
  const { decision, prompt } = instance;

  if (instance.task.member === "decision" && decision) {
    return (
      <CompositeField>
        {children}
        <DecisionVersionSelector
          decision={decision}
          onSelectVersion={(decisionVersionId) =>
            loadDecision({
              type: "decision",
              decisionId: decision.id,
              decisionVersionId,
              tagName: null,
            })
          }
          onSelectTag={(tagName) =>
            loadDecision({
              type: "decision",
              decisionId: decision.id,
              decisionVersionId: null,
              tagName,
            })
          }
        />
      </CompositeField>
    );
  }

  const selectedPrompt =
    instance.task.member === "prompt" && prompt
      ? prompts.find((candidate) => candidate.id === prompt.id)
      : undefined;

  if (!selectedPrompt || !prompt) {
    return children;
  }

  return (
    <CompositeField>
      {children}
      <PromptVersionSelector
        prompt={selectedPrompt}
        selectedVersionInfo={
          selectedPrompt.versions.find(
            (version) => version.id === prompt.version
          ) ?? null
        }
        selectedTagName={prompt.tag}
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
