import { css } from "@emotion/react";
import { startTransition, useState } from "react";
import { graphql, usePaginationFragment } from "react-relay";
import { useNavigate, useParams } from "react-router";

import {
  Autocomplete,
  Button,
  Icon,
  Icons,
  Input,
  Menu,
  MenuContainer,
  MenuEmpty,
  MenuHeader,
  MenuItem,
  MenuTrigger,
  SearchField,
  SelectChevronUpDownIcon,
  useFilter,
} from "@phoenix/components";
import { SearchIcon } from "@phoenix/components/core/field";
import { usePreferencesContext } from "@phoenix/contexts";

import type { ProjectSelector_projects$key } from "./__generated__/ProjectSelector_projects.graphql";
import type { ProjectSelectorProjectsQuery } from "./__generated__/ProjectSelectorProjectsQuery.graphql";

const PAGE_SIZE = 50;

const selectorWrapCSS = css`
  flex: 0 1 320px;
  min-width: 220px;
  max-width: 360px;

  .project-selector__button {
    width: 100%;
    justify-content: flex-start;
  }

  .project-selector__button:not([data-disabled="true"]) {
    &[data-pressed],
    &:hover {
      --button-border-color: var(--global-input-field-border-color-active);
    }
  }

  .project-selector__value {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-align: start;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .project-selector__value--placeholder {
    color: var(--text-color-placeholder);
    font-style: italic;
  }

  .project-selector__button > .icon-wrap:last-child {
    flex: none;
    margin-left: auto;
  }
`;

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

type ProjectSelectorProps = {
  query: ProjectSelector_projects$key;
};

export function ProjectSelector({ query }: ProjectSelectorProps) {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [search, setSearch] = useState("");
  const [optimisticProject, setOptimisticProject] =
    useState<SelectedProject | null>(null);
  const { contains } = useFilter({ sensitivity: "base" });
  const setLastSelectedDashboardProjectId = usePreferencesContext(
    (state) => state.setLastSelectedDashboardProjectId
  );
  const { data, loadNext, hasNext, isLoadingNext, refetch } =
    usePaginationFragment<
      ProjectSelectorProjectsQuery,
      ProjectSelector_projects$key
    >(
      graphql`
        fragment ProjectSelector_projects on Query
        @refetchable(queryName: "ProjectSelectorProjectsQuery")
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
            @connection(key: "ProjectSelector_projects") {
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
    (project) => project.id === projectId
  );
  const selectedProjectFromRoute: SelectedProject | null =
    data.selectedProject?.__typename === "Project" &&
    data.selectedProject.id === projectId &&
    typeof data.selectedProject.name === "string"
      ? {
          id: data.selectedProject.id,
          name: data.selectedProject.name,
        }
      : null;
  const selectedProject = selectedProjectFromMenu ?? selectedProjectFromRoute;
  const selectedProjectVariables = projectId
    ? {
        hasSelectedProject: true,
        selectedProjectId: projectId,
      }
    : {
        hasSelectedProject: false,
        selectedProjectId: "",
      };
  const projectFilter = search ? { col: "name" as const, value: search } : null;
  const displayProjectName = projectId
    ? (selectedProject?.name ??
      (optimisticProject?.id === projectId ? optimisticProject.name : null))
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
    <div css={selectorWrapCSS}>
      <MenuTrigger
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            resetSearch();
          }
        }}
      >
        <Button
          aria-label={
            displayProjectName ? `Project: ${displayProjectName}` : "Project"
          }
          className="project-selector__button"
          leadingVisual={<Icon svg={<Icons.Trace />} />}
          size="S"
          trailingVisual={<SelectChevronUpDownIcon />}
        >
          {displayProjectName ? (
            <span className="project-selector__value">
              {displayProjectName}
            </span>
          ) : (
            <span className="project-selector__value project-selector__value--placeholder">
              Select project
            </span>
          )}
        </Button>
        <MenuContainer
          placement="bottom start"
          minHeight={240}
          maxHeight={420}
          maxWidth={360}
        >
          <Autocomplete filter={contains}>
            <MenuHeader>
              <SearchField
                aria-label="Search projects"
                autoFocus
                onChange={onSearchChange}
                size="L"
                value={search}
                variant="quiet"
              >
                <SearchIcon />
                <Input placeholder="Search projects..." />
              </SearchField>
            </MenuHeader>
            <Menu
              aria-label="Projects"
              items={projects}
              renderEmptyState={() => <MenuEmpty>No projects found</MenuEmpty>}
              selectedKeys={projectId ? [projectId] : []}
              selectionMode="single"
              onAction={(key) => {
                if (typeof key === "string") {
                  const project = projects.find(
                    (project) => project.id === key
                  );
                  if (project) {
                    setOptimisticProject(project);
                  }
                  setLastSelectedDashboardProjectId(key);
                  navigate(`/dashboards/projects/${key}`);
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
    </div>
  );
}
