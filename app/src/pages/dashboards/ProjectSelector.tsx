import { css } from "@emotion/react";
import { graphql, usePaginationFragment } from "react-relay";
import { useNavigate, useParams } from "react-router";

import {
  Button,
  Icon,
  Icons,
  ListBox,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
} from "@phoenix/components";
import { usePreferencesContext } from "@phoenix/contexts";

import type { ProjectSelector_projects$key } from "./__generated__/ProjectSelector_projects.graphql";
import type { ProjectSelectorProjectsQuery } from "./__generated__/ProjectSelectorProjectsQuery.graphql";

const PAGE_SIZE = 50;

const selectorWrapCSS = css`
  flex: 0 1 320px;
  min-width: 220px;
  max-width: 360px;

  .select {
    width: 100%;
  }

  .select button {
    justify-content: flex-start;
  }

  .react-aria-SelectValue {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-align: start;
    text-overflow: ellipsis;
  }
`;

type ProjectSelectorProps = {
  query: ProjectSelector_projects$key;
};

export function ProjectSelector({ query }: ProjectSelectorProps) {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const setLastSelectedDashboardProjectId = usePreferencesContext(
    (state) => state.setLastSelectedDashboardProjectId
  );
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    ProjectSelectorProjectsQuery,
    ProjectSelector_projects$key
  >(
    graphql`
      fragment ProjectSelector_projects on Query
      @refetchable(queryName: "ProjectSelectorProjectsQuery")
      @argumentDefinitions(
        after: { type: "String", defaultValue: null }
        first: { type: "Int", defaultValue: 50 }
      ) {
        projects(first: $first, after: $after)
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

  return (
    <div css={selectorWrapCSS}>
      <Select
        aria-label="Project"
        placeholder="Select project"
        selectedKey={projectId ?? null}
        size="S"
        onSelectionChange={(key) => {
          if (typeof key === "string") {
            setLastSelectedDashboardProjectId(key);
            navigate(`/dashboards/projects/${key}`);
          }
        }}
      >
        <Button
          leadingVisual={<Icon svg={<Icons.Trace />} />}
          trailingVisual={<SelectChevronUpDownIcon />}
        >
          <SelectValue />
        </Button>
        <Popover placement="bottom start">
          <ListBox
            items={projects}
            renderEmptyState={() => "No projects found"}
            onScroll={(event) => {
              const { scrollHeight, scrollTop, clientHeight } =
                event.currentTarget;
              if (
                scrollHeight - scrollTop - clientHeight < 300 &&
                hasNext &&
                !isLoadingNext
              ) {
                loadNext(PAGE_SIZE);
              }
            }}
          >
            {(project) => (
              <SelectItem id={project.id} textValue={project.name}>
                {project.name}
              </SelectItem>
            )}
          </ListBox>
        </Popover>
      </Select>
    </div>
  );
}
