import { useDeferredValue, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  Button,
  DebouncedSearch,
  Flex,
  Icon,
  Icons,
  ListBox,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  Text,
  View,
} from "@phoenix/components";
import { CompactEmptyState } from "@phoenix/components/core/empty";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { ProjectItemContent } from "@phoenix/components/project/ProjectItemContent";

import type { EvaluatorPlaygroundProjectSelectQuery } from "./__generated__/EvaluatorPlaygroundProjectSelectQuery.graphql";

/**
 * The project counterpart of the dataset picker in the Results strip: a
 * searchable select over projects by name. The selected project is looked up
 * by id so its name shows even when the search no longer lists it. The list
 * loads up front: a select with an empty collection never opens, so it cannot
 * wait for the first open the way the slot's evaluator picker does.
 */
export function EvaluatorPlaygroundProjectSelect({
  projectId,
  onSelectionChange,
  isDisabled,
}: {
  projectId: string | null;
  onSelectionChange: (projectId: string) => void;
  isDisabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const data = useLazyLoadQuery<EvaluatorPlaygroundProjectSelectQuery>(
    graphql`
      query EvaluatorPlaygroundProjectSelectQuery(
        $filter: ProjectFilter
        $projectId: ID!
        $hasProject: Boolean!
      ) {
        projects(first: 50, filter: $filter) {
          edges {
            node {
              id
              name
              gradientStartColor
              gradientEndColor
            }
          }
        }
        selected: node(id: $projectId) @include(if: $hasProject) {
          ... on Project {
            id
            name
          }
        }
      }
    `,
    {
      filter: deferredSearch ? { col: "name", value: deferredSearch } : null,
      projectId: projectId ?? "",
      hasProject: projectId != null,
    },
    { fetchPolicy: "store-and-network" }
  );

  const options = (data.projects?.edges ?? []).map(({ node }) => node);

  const selectedName =
    options.find((option) => option.id === projectId)?.name ??
    data.selected?.name;

  return (
    <Select
      aria-label="Project"
      size="S"
      isDisabled={isDisabled}
      style={{ minWidth: 0, maxWidth: "100%" }}
      value={projectId}
      onChange={(key) => {
        if (key != null && key !== projectId) onSelectionChange(String(key));
      }}
    >
      <Button leadingVisual={<Icon svg={<Icons.Grid />} />}>
        <SelectValue>
          {projectId ? (
            <Truncate maxWidth="12rem">{selectedName ?? "Loading…"}</Truncate>
          ) : (
            <Text color="text-700">Select a project</Text>
          )}
        </SelectValue>
        <SelectChevronUpDownIcon />
      </Button>
      <Popover>
        <View padding="size-100">
          <DebouncedSearch
            aria-label="Search projects"
            defaultValue={search}
            onChange={setSearch}
            placeholder="Search projects"
          />
        </View>
        <ListBox
          renderEmptyState={() => (
            <CompactEmptyState
              icon={<Icon svg={<Icons.Grid />} />}
              description="No projects"
              isFiltered={deferredSearch.length > 0}
            />
          )}
        >
          {options.map((option) => (
            <SelectItem key={option.id} id={option.id} textValue={option.name}>
              <Flex direction="row" alignItems="center" minWidth={0}>
                <ProjectItemContent
                  name={option.name}
                  gradientStartColor={option.gradientStartColor}
                  gradientEndColor={option.gradientEndColor}
                />
              </Flex>
            </SelectItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}
