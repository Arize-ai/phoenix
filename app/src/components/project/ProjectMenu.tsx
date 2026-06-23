import { css } from "@emotion/react";
import { startTransition, useState } from "react";
import { graphql, usePaginationFragment } from "react-relay";

import {
  Autocomplete,
  Icon,
  Icons,
  Input,
  Menu,
  MenuButton,
  MenuButtonValue,
  MenuContainer,
  MenuHeader,
  MenuItem,
  MenuTrigger,
  SearchField,
  SelectChevronUpDownIcon,
  useFilter,
} from "@phoenix/components";
import type { MenuButtonProps } from "@phoenix/components";
import { CompactEmptyState } from "@phoenix/components/core/empty";
import { SearchIcon } from "@phoenix/components/core/field";
import type { StylableProps } from "@phoenix/components/core/types";

import type { ProjectMenu_projects$key } from "./__generated__/ProjectMenu_projects.graphql";
import type { ProjectMenuProjectsQuery } from "./__generated__/ProjectMenuProjectsQuery.graphql";

const PAGE_SIZE = 50;

const projectMenuItemNameCSS = css`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

type SelectedProject = {
  id: string;
  name: string;
};

export type ProjectMenuProps = StylableProps & {
  query: ProjectMenu_projects$key;
  selectedProjectId?: string | null;
  onProjectChange: (projectId: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  size?: MenuButtonProps["size"];
};

export function ProjectMenu({
  query,
  selectedProjectId,
  onProjectChange,
  placeholder = "Select project",
  searchPlaceholder = "Search projects...",
  size,
  css: propCSS,
}: ProjectMenuProps) {
  const [search, setSearch] = useState("");
  const [optimisticProject, setOptimisticProject] =
    useState<SelectedProject | null>(null);
  const { contains } = useFilter({ sensitivity: "base" });
  const { data, loadNext, hasNext, isLoadingNext, refetch } =
    usePaginationFragment<ProjectMenuProjectsQuery, ProjectMenu_projects$key>(
      graphql`
        fragment ProjectMenu_projects on Query
        @refetchable(queryName: "ProjectMenuProjectsQuery")
        @argumentDefinitions(
          after: { type: "String", defaultValue: null }
          first: { type: "Int", defaultValue: 50 }
          filter: { type: "ProjectFilter", defaultValue: null }
          hasSelectedProject: { type: "Boolean!" }
          selectedProjectId: { type: "ID!" }
        ) {
          selectedProject: node(id: $selectedProjectId)
            @include(if: $hasSelectedProject) {
            __typename
            id
            ... on Project {
              name
            }
          }
          projects(first: $first, after: $after, filter: $filter)
            @connection(key: "ProjectMenu_projects") {
            edges {
              project: node {
                id
                name
              }
            }
          }
        }
      `,
      query
    );

  const projects = data.projects.edges.map((edge) => edge.project);
  const selectedProjectFromMenu = projects.find(
    (project) => project.id === selectedProjectId
  );
  const selectedProjectFromRoute: SelectedProject | null =
    data.selectedProject?.__typename === "Project" &&
    data.selectedProject.id === selectedProjectId &&
    typeof data.selectedProject.name === "string"
      ? {
          id: data.selectedProject.id,
          name: data.selectedProject.name,
        }
      : null;
  const selectedProject = selectedProjectFromMenu ?? selectedProjectFromRoute;
  const selectedProjectVariables = selectedProjectId
    ? {
        hasSelectedProject: true,
        selectedProjectId,
      }
    : {
        hasSelectedProject: false,
        selectedProjectId: "",
      };
  const projectFilter = search ? { col: "name" as const, value: search } : null;
  const displayProjectName = selectedProjectId
    ? (selectedProject?.name ??
      (optimisticProject?.id === selectedProjectId
        ? optimisticProject.name
        : null))
    : null;

  const onSearchChange = (value: string) => {
    setSearch(value);
    if (selectedProject) {
      setOptimisticProject({
        id: selectedProject.id,
        name: selectedProject.name,
      });
    }
    startTransition(() => {
      refetch(
        {
          after: null,
          first: PAGE_SIZE,
          filter: value ? { col: "name", value } : null,
          ...selectedProjectVariables,
        },
        { fetchPolicy: "store-and-network" }
      );
    });
  };

  const resetSearch = () => {
    if (!search) {
      return;
    }
    setSearch("");
    startTransition(() => {
      refetch(
        {
          after: null,
          first: PAGE_SIZE,
          filter: null,
          ...selectedProjectVariables,
        },
        { fetchPolicy: "store-and-network" }
      );
    });
  };

  return (
    <MenuTrigger
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          resetSearch();
        }
      }}
    >
      <MenuButton
        aria-label={
          displayProjectName ? `Project: ${displayProjectName}` : "Project"
        }
        css={propCSS}
        leadingVisual={<Icon svg={<Icons.Trace />} />}
        size={size}
        trailingVisual={<SelectChevronUpDownIcon />}
      >
        {displayProjectName ? (
          <MenuButtonValue>{displayProjectName}</MenuButtonValue>
        ) : (
          <MenuButtonValue isPlaceholder>{placeholder}</MenuButtonValue>
        )}
      </MenuButton>
      <MenuContainer placement="bottom start">
        <Autocomplete filter={contains}>
          <MenuHeader>
            <SearchField
              aria-label="Search projects"
              autoFocus
              onChange={onSearchChange}
              size={size}
              value={search}
              variant="quiet"
            >
              <SearchIcon />
              <Input placeholder={searchPlaceholder} />
            </SearchField>
          </MenuHeader>
          <Menu
            aria-label="Projects"
            items={projects}
            renderEmptyState={() => (
              <CompactEmptyState
                icon={<Icon svg={<Icons.Folder />} />}
                description="No projects found"
              />
            )}
            selectedKeys={selectedProjectId ? [selectedProjectId] : []}
            selectionMode="single"
            onAction={(key) => {
              if (typeof key === "string") {
                const project = projects.find((project) => project.id === key);
                if (project) {
                  setOptimisticProject(project);
                }
                onProjectChange(key);
              }
            }}
            onScroll={(event) => {
              const { scrollHeight, scrollTop, clientHeight } =
                event.currentTarget;
              if (
                scrollHeight - scrollTop - clientHeight < 300 &&
                hasNext &&
                !isLoadingNext
              ) {
                loadNext(PAGE_SIZE, {
                  UNSTABLE_extraVariables: {
                    filter: projectFilter,
                    ...selectedProjectVariables,
                  },
                });
              }
            }}
          >
            {(project) => (
              <MenuItem id={project.id} textValue={project.name}>
                <span css={projectMenuItemNameCSS}>{project.name}</span>
              </MenuItem>
            )}
          </Menu>
        </Autocomplete>
      </MenuContainer>
    </MenuTrigger>
  );
}
