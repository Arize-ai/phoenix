import { css } from "@emotion/react";
import { Suspense, useRef, useState } from "react";
import { graphql, useMutation } from "react-relay";

import {
  Button,
  Card,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Loading,
  Popover,
  useFilter,
  View,
} from "@phoenix/components";
import { Counter } from "@phoenix/components/core/counter";
import {
  CompactEmptyState,
  EmptyState,
  EmptyStateGraphic,
} from "@phoenix/components/core/empty";
import { DebouncedSearch } from "@phoenix/components/core/field";
import type { ProjectSelectionMenuProject } from "@phoenix/components/project";
import {
  ProjectSelectionMenu,
  ProjectToken,
  sortProjectsByName,
  useAllProjects,
} from "@phoenix/components/project";
import { useNotifyError } from "@phoenix/contexts/NotificationContext";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { RetentionPolicyProjectsPatchMutation } from "./__generated__/RetentionPolicyProjectsPatchMutation.graphql";

/**
 * The minimum number of projects before a filter field is shown. Below this
 * the full list is scannable at a glance and a filter is just clutter.
 */
const FILTER_VISIBLE_THRESHOLD = 10;

const projectTokenListCSS = css`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--global-dimension-size-50);
`;

/**
 * The projects a retention policy applies to, as a filterable token list.
 * When the viewer can manage the policy, projects can be added via a
 * searchable picker and removed from each token. Removed projects fall back
 * to the default policy.
 */
export function RetentionPolicyProjects({
  policyId,
  projects,
  canManage,
}: {
  policyId: string;
  projects: readonly ProjectSelectionMenuProject[];
  /**
   * Whether the viewer can add and remove projects on this policy
   */
  canManage: boolean;
}) {
  const [filterText, setFilterText] = useState("");
  const { contains } = useFilter({ sensitivity: "base" });
  const notifyError = useNotifyError();
  const [patchPolicy] = useMutation<RetentionPolicyProjectsPatchMutation>(
    graphql`
      mutation RetentionPolicyProjectsPatchMutation(
        $input: PatchProjectTraceRetentionPolicyInput!
      ) {
        patchProjectTraceRetentionPolicy(input: $input) {
          # Refetching the policies table updates every affected policy —
          # the patched one and the default policy that absorbs removals —
          # including the drawer, which reads the same normalized records.
          query {
            ...RetentionPoliciesTable_policies
          }
        }
      }
    `
  );

  const patchProjects = (action: "add" | "remove", projectId: string) => {
    patchPolicy({
      variables: {
        input: {
          id: policyId,
          [action === "add" ? "addProjects" : "removeProjects"]: [projectId],
        },
      },
      onError: (error) => {
        notifyError({
          title: `Failed to ${action} project`,
          message:
            getErrorMessagesFromRelayMutationError(error)?.join("\n") ??
            `An unknown error occurred while trying to ${action} the project.`,
        });
      },
    });
  };

  const showFilter = projects.length >= FILTER_VISIBLE_THRESHOLD;
  // The filter field unmounts when the list drops below the threshold (e.g.
  // by removing projects while filtering). Clear the stale filter text so an
  // invisible query can't keep hiding tokens with no way to reset it.
  if (!showFilter && filterText) {
    setFilterText("");
  }
  const sortedProjects = sortProjectsByName(projects);
  const visibleProjects = filterText
    ? sortedProjects.filter((project) => contains(project.name, filterText))
    : sortedProjects;

  return (
    <Card
      title="Projects"
      titleExtra={<Counter>{projects.length}</Counter>}
      extra={
        showFilter || canManage ? (
          <Flex direction="row" gap="size-100" alignItems="center">
            {showFilter && (
              <DebouncedSearch
                size="S"
                aria-label="Filter projects"
                placeholder="Filter projects"
                onChange={setFilterText}
              />
            )}
            {canManage && (
              <AddProjectButton
                assignedProjectIds={projects.map((project) => project.id)}
                onProjectAdded={(projectId) => patchProjects("add", projectId)}
              />
            )}
          </Flex>
        ) : undefined
      }
    >
      <View padding="size-200">
        {projects.length === 0 ? (
          <EmptyState
            graphic={<EmptyStateGraphic variant="trace" />}
            title="No projects"
            description={
              canManage
                ? "Add projects to apply this policy to their traces."
                : "This policy is not applied to any projects."
            }
          />
        ) : visibleProjects.length === 0 ? (
          <CompactEmptyState
            icon={<Icon svg={<Icons.Trace />} />}
            description="No projects"
            isFiltered
          />
        ) : (
          <ul css={projectTokenListCSS}>
            {visibleProjects.map((project) => (
              <li key={project.id}>
                <ProjectToken
                  projectId={project.id}
                  name={project.name}
                  gradientStartColor={project.gradientStartColor}
                  gradientEndColor={project.gradientEndColor}
                  size="L"
                  maxWidth="100%"
                  onRemove={
                    canManage
                      ? () => patchProjects("remove", project.id)
                      : undefined
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </View>
    </Card>
  );
}

function AddProjectButton({
  assignedProjectIds,
  onProjectAdded,
}: {
  assignedProjectIds: string[];
  onProjectAdded: (projectId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  // Selecting a menu item closes the containing popover. Suppress the close
  // that follows an add so several projects can be added in one sitting.
  const keepOpenRef = useRef(false);
  return (
    <DialogTrigger
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && keepOpenRef.current) {
          keepOpenRef.current = false;
          return;
        }
        keepOpenRef.current = false;
        setIsOpen(open);
      }}
    >
      <Button size="S" leadingVisual={<Icon svg={<Icons.Plus />} />}>
        Add project
      </Button>
      <Popover placement="bottom end">
        <Suspense fallback={<Loading />}>
          <AddProjectPicker
            assignedProjectIds={assignedProjectIds}
            onProjectAdded={(projectId) => {
              keepOpenRef.current = true;
              onProjectAdded(projectId);
            }}
          />
        </Suspense>
      </Popover>
    </DialogTrigger>
  );
}

/**
 * A searchable list of projects not yet on the policy. Selecting a project
 * adds it immediately and keeps the picker open so several projects can be
 * added in one sitting.
 */
function AddProjectPicker({
  assignedProjectIds,
  onProjectAdded,
}: {
  assignedProjectIds: string[];
  onProjectAdded: (projectId: string) => void;
}) {
  const allProjects = useAllProjects();
  const assigned = new Set(assignedProjectIds);
  const availableProjects = allProjects.filter(
    (project) => !assigned.has(project.id)
  );

  return (
    <ProjectSelectionMenu
      projects={availableProjects}
      onProjectSelect={onProjectAdded}
      emptyDescription="All projects already use this policy"
    />
  );
}
