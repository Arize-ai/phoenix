import { Suspense } from "react";

import {
  Autocomplete,
  Button,
  Counter,
  Icon,
  Icons,
  Input,
  Loading,
  Menu,
  MenuFooter,
  MenuHeader,
  MenuItem,
  MenuTrigger,
  Popover,
  SearchField,
  type Selection,
  Text,
  useFilter,
} from "@phoenix/components";
import { CompactEmptyState } from "@phoenix/components/core/empty";
import { SearchIcon } from "@phoenix/components/core/field";
import {
  useServerEvaluationActivity,
  useServerProjectSeries,
} from "@phoenix/pages/evaluators/projectEvaluators/ServerEvaluationCharts";
import { MAX_PICKED_PROJECTS } from "@phoenix/pages/evaluators/projectEvaluators/serverProjectSeries";
import { EvaluationQueueSwatch } from "@phoenix/pages/project/evaluators/EvaluationQueueMeter";
import { intFormatter } from "@phoenix/utils/numberFormatUtils";

/**
 * Picks which projects the charts and table show. With none picked, the
 * heaviest few show on their own and the rest are grouped.
 */
export function ServerProjectsFilterButton({
  pickedProjectIds,
  onPickedProjectIdsChange,
  fetchKey,
}: {
  pickedProjectIds: ReadonlyArray<string>;
  onPickedProjectIdsChange: (projectIds: string[]) => void;
  fetchKey: number;
}) {
  return (
    <MenuTrigger>
      <Button
        variant="default"
        size="M"
        leadingVisual={<Icon svg={<Icons.Grid />} />}
        trailingVisual={
          pickedProjectIds.length > 0 ? (
            <Counter>{pickedProjectIds.length}</Counter>
          ) : undefined
        }
      >
        Projects
      </Button>
      <Popover placement="bottom end">
        <Suspense fallback={<Loading />}>
          <ServerProjectsFilterContent
            pickedProjectIds={pickedProjectIds}
            onPickedProjectIdsChange={onPickedProjectIdsChange}
            fetchKey={fetchKey}
          />
        </Suspense>
      </Popover>
    </MenuTrigger>
  );
}

function ServerProjectsFilterContent({
  pickedProjectIds,
  onPickedProjectIdsChange,
  fetchKey,
}: {
  pickedProjectIds: ReadonlyArray<string>;
  onPickedProjectIdsChange: (projectIds: string[]) => void;
  fetchKey: number;
}) {
  const { contains } = useFilter({ sensitivity: "base" });
  // The charts already loaded this; opening the menu reads it from the store.
  const { data } = useServerEvaluationActivity({
    fetchKey,
    fetchPolicy: "store-or-network",
  });
  const { ranked, colorById } = useServerProjectSeries(data, pickedProjectIds);
  const totalQueued = data.evaluationQueue.queuedCount;
  const isFull = pickedProjectIds.length >= MAX_PICKED_PROJECTS;
  const picked = new Set(pickedProjectIds);
  const disabledKeys = isFull
    ? ranked.filter((project) => !picked.has(project.id)).map(({ id }) => id)
    : [];
  const handleSelectionChange = (selection: Selection) => {
    if (selection === "all") {
      return;
    }
    onPickedProjectIdsChange(
      [...selection].map(String).slice(0, MAX_PICKED_PROJECTS)
    );
  };
  return (
    <>
      <Autocomplete filter={contains}>
        <MenuHeader>
          <SearchField aria-label="Search projects" variant="quiet" autoFocus>
            <SearchIcon />
            <Input placeholder="Search projects..." />
          </SearchField>
        </MenuHeader>
        <Menu
          aria-label="Projects"
          items={ranked}
          selectionMode="multiple"
          // Escape closes the menu; it must not also clear the picks.
          escapeKeyBehavior="none"
          selectedKeys={pickedProjectIds}
          disabledKeys={disabledKeys}
          onSelectionChange={handleSelectionChange}
          renderEmptyState={() => (
            <CompactEmptyState
              icon={<Icon svg={<Icons.Grid />} />}
              description="No projects with evaluators"
            />
          )}
        >
          {({ id, name, queuedCount }) => (
            <MenuItem
              id={id}
              textValue={name}
              leadingContent={
                <EvaluationQueueSwatch
                  color={colorById.get(id) ?? "transparent"}
                />
              }
              trailingContent={
                queuedCount > 0 && totalQueued > 0 ? (
                  <Text size="S" fontFamily="mono" color="text-700">
                    {`${intFormatter(queuedCount)} queued`}
                  </Text>
                ) : undefined
              }
            >
              {name}
            </MenuItem>
          )}
        </Menu>
      </Autocomplete>
      <MenuFooter>
        <Button
          variant="quiet"
          size="S"
          onPress={() => onPickedProjectIdsChange([])}
          isDisabled={pickedProjectIds.length === 0}
        >
          Clear All
        </Button>
      </MenuFooter>
    </>
  );
}
