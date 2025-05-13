import { graphql, useFragment } from "react-relay";

import {
  Button,
  Label,
  ListBox,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
} from "@phoenix/components";

import type { ProjectTraceRetentionPolicySelectFragment$key } from "./__generated__/ProjectTraceRetentionPolicySelectFragment.graphql";

export interface ProjectTraceRetentionPolicySelectProps {
  defaultValue?: string;
  onChange?: (value: string) => void;
  isDisabled?: boolean;
  query: ProjectTraceRetentionPolicySelectFragment$key;
}

export function ProjectTraceRetentionPolicySelect({
  defaultValue,
  onChange,
  query,
  isDisabled,
}: ProjectTraceRetentionPolicySelectProps) {
  const data = useFragment(
    graphql`
      fragment ProjectTraceRetentionPolicySelectFragment on Query {
        projectTraceRetentionPolicies {
          edges {
            node {
              id
              name
              cronExpression
              rule {
                ... on TraceRetentionRuleMaxCount {
                  maxCount
                }
                ... on TraceRetentionRuleMaxDays {
                  maxDays
                }
                ... on TraceRetentionRuleMaxDaysOrCount {
                  maxDays
                  maxCount
                }
              }
            }
          }
        }
      }
    `,
    query
  );
  const retentionOptions = data.projectTraceRetentionPolicies.edges.map(
    (edge) => edge.node
  );
  return (
    <Select
      size="S"
      defaultSelectedKey={defaultValue}
      onSelectionChange={(key) => onChange?.(key.toString())}
      isDisabled={isDisabled}
    >
      <Label>Retention Policy</Label>
      <Button>
        <SelectValue />
        <SelectChevronUpDownIcon />
      </Button>
      <Popover>
        <ListBox>
          {retentionOptions.map((option) => (
            <SelectItem key={option.id} id={option.id}>
              {option.name}
            </SelectItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}
