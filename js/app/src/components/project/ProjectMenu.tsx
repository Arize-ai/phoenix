import {
  startTransition,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { graphql, useLazyLoadQuery, usePaginationFragment } from "react-relay";

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
import { ErrorBoundary } from "@phoenix/components/exception";

import type { ProjectMenu_projects$key } from "./__generated__/ProjectMenu_projects.graphql";
import type { ProjectMenuProjectsQuery } from "./__generated__/ProjectMenuProjectsQuery.graphql";
import type { ProjectMenuSelectedProjectQuery } from "./__generated__/ProjectMenuSelectedProjectQuery.graphql";
import { ProjectItemContent } from "./ProjectItemContent";

const PAGE_SIZE = 50;

export type ProjectMenuProps = StylableProps & {
  query: ProjectMenu_projects$key;
  selectedProjectId?: string | null;
  onProjectChange: (projectId: string) => void;
  /**
   * Called when the selected project no longer exists (the lookup failed with
   * a not-found error). The menu itself degrades to its placeholder; use this
   * to clean up state that references the project, such as a remembered
   * last-selected id. Transient failures (e.g. a network blip) do not trigger
   * this — the menu retries those on its next open.
   */
  onSelectedProjectNotFound?: () => void;
  placeholder?: string;
  searchPlaceholder?: string;
  size?: MenuButtonProps["size"];
};

type ProjectMenuButtonProps = StylableProps & {
  projectName: string | null;
  placeholder: string;
  size?: MenuButtonProps["size"];
};

function ProjectMenuButton({
  projectName,
  placeholder,
  size,
  css: propCSS,
}: ProjectMenuButtonProps) {
  return (
    <MenuButton
      aria-label={projectName ? `Project: ${projectName}` : "Project"}
      css={propCSS}
      leadingVisual={<Icon svg={<Icons.Trace />} />}
      size={size}
      trailingVisual={<SelectChevronUpDownIcon />}
    >
      {projectName ? (
        <MenuButtonValue>{projectName}</MenuButtonValue>
      ) : (
        <MenuButtonValue isPlaceholder>{placeholder}</MenuButtonValue>
      )}
    </MenuButton>
  );
}

/**
 * A menu button that resolves the selected project's name by id. Used when
 * the name is not available from data already fetched, i.e. when the selected
 * project is not in the loaded pages of the connection. Must be rendered
 * inside an error boundary: the query fails when the selected project no
 * longer exists (e.g. a stale id for a deleted project).
 */
function SelectedProjectMenuButton({
  projectId,
  fetchKey,
  ...buttonProps
}: Omit<ProjectMenuButtonProps, "projectName"> & {
  projectId: string;
  fetchKey: number;
}) {
  const data = useLazyLoadQuery<ProjectMenuSelectedProjectQuery>(
    graphql`
      query ProjectMenuSelectedProjectQuery($id: ID!) {
        node(id: $id) {
          __typename
          id
          ... on Project {
            name
          }
        }
      }
    `,
    { id: projectId },
    { fetchPolicy: "store-or-network", fetchKey }
  );
  const projectName =
    data.node?.__typename === "Project" && typeof data.node.name === "string"
      ? data.node.name
      : null;
  return <ProjectMenuButton projectName={projectName} {...buttonProps} />;
}

/**
 * Error fallback for the selected-project lookup. Renders the same
 * placeholder button and reports the failure so the caller can react (e.g.
 * clear a remembered project id) or retry on the next menu open.
 */
function SelectedProjectMenuButtonFallback({
  error,
  onError,
  ...buttonProps
}: ProjectMenuButtonProps & {
  error?: string | null;
  onError: (error: string | null) => void;
}) {
  useEffect(() => {
    onError(error ?? null);
  }, [error, onError]);
  return <ProjectMenuButton {...buttonProps} />;
}

export function ProjectMenu({
  query,
  selectedProjectId,
  onProjectChange,
  onSelectedProjectNotFound,
  placeholder = "Select project",
  searchPlaceholder = "Search projects...",
  size,
  css: propCSS,
}: ProjectMenuProps) {
  const [search, setSearch] = useState("");
  // Bumped to retry the selected-project lookup after a transient failure;
  // failedProjectId records which project's lookup failed so a retry only
  // happens while that project is still the selection.
  const [selectedProjectFetchKey, setSelectedProjectFetchKey] = useState(0);
  const [failedProjectId, setFailedProjectId] = useState<string | null>(null);
  const handleSelectedProjectError = useCallback(
    (error: string | null) => {
      if (error != null && /not found/i.test(error)) {
        // Permanent: the project no longer exists. Retrying cannot succeed,
        // so let the caller clean up instead.
        onSelectedProjectNotFound?.();
      } else if (selectedProjectId) {
        setFailedProjectId(selectedProjectId);
      }
    },
    [onSelectedProjectNotFound, selectedProjectId]
  );
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
        ) {
          projects(first: $first, after: $after, filter: $filter)
            @connection(key: "ProjectMenu_projects") {
            edges {
              project: node {
                id
                name
                gradientStartColor
                gradientEndColor
              }
            }
          }
        }
      `,
      query
    );

  const projects = useMemo(
    () => data.projects.edges.map((edge) => edge.project),
    [data.projects.edges]
  );
  const selectedProject = projects.find(
    (project) => project.id === selectedProjectId
  );
  const projectFilter = search ? { col: "name" as const, value: search } : null;
  // When the selected project is not in the loaded pages of the connection
  // (e.g. the connection is filtered by search), SelectedProjectMenuButton
  // resolves the name — synchronously from the Relay store when the record
  // was fetched before.
  const displayProjectName = selectedProject?.name ?? null;

  const onSearchChange = (value: string) => {
    setSearch(value);
    startTransition(() => {
      refetch(
        {
          after: null,
          first: PAGE_SIZE,
          filter: value ? { col: "name", value } : null,
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
        },
        { fetchPolicy: "store-and-network" }
      );
    });
  };

  const buttonProps = useMemo(
    () => ({
      css: propCSS,
      placeholder,
      size,
    }),
    [propCSS, placeholder, size]
  );

  // Stable across re-renders: ErrorBoundary renders this as a component type,
  // so a fresh identity per render would remount the fallback (and re-fire
  // its onError effect) on every parent re-render.
  const selectedProjectErrorFallback = useCallback(
    ({ error }: { error?: string | null }) => (
      <SelectedProjectMenuButtonFallback
        {...buttonProps}
        projectName={null}
        error={error}
        onError={handleSelectedProjectError}
      />
    ),
    [buttonProps, handleSelectedProjectError]
  );

  return (
    <MenuTrigger
      onOpenChange={(isOpen) => {
        if (isOpen) {
          // Retry a previously failed selected-project lookup: a transient
          // network error should not latch the placeholder for the rest of
          // the session. Only retries the project that actually failed.
          if (
            failedProjectId != null &&
            failedProjectId === selectedProjectId
          ) {
            setFailedProjectId(null);
            setSelectedProjectFetchKey((key) => key + 1);
          }
        } else {
          resetSearch();
        }
      }}
    >
      {selectedProjectId && displayProjectName == null ? (
        // The error boundary keeps a failed lookup (e.g. a stale id for a
        // deleted project) from crashing the page: the menu falls back to its
        // placeholder so the user can pick a different project. Keyed so the
        // boundary resets when the selection changes or a retry is requested.
        <ErrorBoundary
          key={`${selectedProjectId}:${selectedProjectFetchKey}`}
          fallback={selectedProjectErrorFallback}
        >
          <Suspense
            fallback={<ProjectMenuButton {...buttonProps} projectName={null} />}
          >
            <SelectedProjectMenuButton
              {...buttonProps}
              fetchKey={selectedProjectFetchKey}
              projectId={selectedProjectId}
            />
          </Suspense>
        </ErrorBoundary>
      ) : (
        <ProjectMenuButton {...buttonProps} projectName={displayProjectName} />
      )}
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
                description="No projects"
              />
            )}
            selectedKeys={selectedProjectId ? [selectedProjectId] : []}
            selectionMode="single"
            onAction={(key) => {
              if (typeof key === "string") {
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
                  },
                });
              }
            }}
          >
            {(project) => (
              <MenuItem id={project.id} textValue={project.name}>
                <ProjectItemContent
                  name={project.name}
                  gradientStartColor={project.gradientStartColor}
                  gradientEndColor={project.gradientEndColor}
                />
              </MenuItem>
            )}
          </Menu>
        </Autocomplete>
      </MenuContainer>
    </MenuTrigger>
  );
}
