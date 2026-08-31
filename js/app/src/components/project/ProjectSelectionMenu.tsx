import { css } from "@emotion/react";

import {
  Autocomplete,
  Dialog,
  Icon,
  Icons,
  Input,
  Menu,
  MenuHeader,
  MenuHeaderTitle,
  MenuItem,
  SearchField,
  useFilter,
} from "@phoenix/components";
import { CompactEmptyState } from "@phoenix/components/core/empty";
import { SearchIcon } from "@phoenix/components/core/field";

import { ProjectItemContent } from "./ProjectItemContent";

export type ProjectSelectionMenuProject = {
  id: string;
  name: string;
  gradientStartColor: string;
  gradientEndColor: string;
};

/**
 * Sorts projects alphabetically by name, the display order shared by
 * project pickers and token lists.
 */
export function sortProjectsByName<Project extends { name: string }>(
  projects: readonly Project[]
): Project[] {
  return [...projects].sort((a, b) => a.name.localeCompare(b.name));
}

export interface ProjectSelectionMenuProps {
  projects: readonly ProjectSelectionMenuProject[];
  onProjectSelect: (projectId: string) => void;
  /**
   * Projects that are shown but cannot be selected
   */
  disabledProjectIds?: string[];
  /**
   * Description shown when there are no projects to choose from
   */
  emptyDescription?: string;
  /**
   * Title shown above the search field naming the action the selection
   * performs (e.g. "Transfer Traces to Project"). Also used as the
   * dialog's accessible label.
   */
  label?: string;
}

/* Inherit the max height React Aria computes for the popover from the
   available viewport space so the menu never spills past the popover edge. */
const projectSelectionDialogCSS = css`
  max-height: inherit;
  display: flex;
  flex-direction: column;
`;

/* A fixed width keeps the popover from resizing as the search narrows the
   list; the max height keeps long project lists scrolling inside the menu
   instead of growing past the viewport. */
const projectSelectionMenuCSS = css`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
  width: 300px;
  max-height: var(--global-menu-max-height-small);
`;

/**
 * A searchable menu of projects, each identified by its color gradient.
 * Renders a dialog that fills a `Popover` (place it directly inside one):
 * a search field pinned at the top with the matching projects scrolling
 * beneath it. Projects are listed alphabetically and selection is reported
 * through `onProjectSelect`.
 *
 * Selecting a project closes the containing popover. To let several
 * projects be picked in one sitting, control the trigger's open state and
 * ignore the close that follows a selection.
 */
export function ProjectSelectionMenu({
  projects,
  onProjectSelect,
  disabledProjectIds,
  emptyDescription = "No projects",
  label,
}: ProjectSelectionMenuProps) {
  const { contains } = useFilter({ sensitivity: "base" });
  const sortedProjects = sortProjectsByName(projects);
  return (
    <Dialog
      aria-label={label ?? "Select project"}
      css={projectSelectionDialogCSS}
    >
      <div css={projectSelectionMenuCSS}>
        <Autocomplete filter={contains}>
          <MenuHeader>
            {label && <MenuHeaderTitle>{label}</MenuHeaderTitle>}
            <SearchField aria-label="Search projects" variant="quiet" autoFocus>
              <SearchIcon />
              <Input placeholder="Search projects..." />
            </SearchField>
          </MenuHeader>
          <Menu
            aria-label="Projects"
            items={sortedProjects}
            disabledKeys={disabledProjectIds}
            onAction={(key) => {
              if (typeof key === "string") {
                onProjectSelect(key);
              }
            }}
            renderEmptyState={() => (
              <CompactEmptyState
                icon={<Icon svg={<Icons.Folder />} />}
                description={emptyDescription}
              />
            )}
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
      </div>
    </Dialog>
  );
}
