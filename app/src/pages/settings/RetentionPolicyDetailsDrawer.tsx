import { css } from "@emotion/react";
import { Suspense } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { useNavigate, useParams } from "react-router";
import invariant from "tiny-invariant";

import { Dialog, Drawer, Flex, Loading, Text, View } from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import { DRAWER_DEFAULT_MIN_SIZE } from "@phoenix/components/core/overlay/constants";
import { useDefaultDrawerSize } from "@phoenix/components/core/overlay/useDefaultDrawerSize";
import { DEFAULT_RETENTION_POLICY_NAME } from "@phoenix/constants";
import { useViewerCanManageRetentionPolicy } from "@phoenix/contexts/ViewerContext";
import type { RetentionPolicyDetailsDrawerQuery } from "@phoenix/pages/settings/__generated__/RetentionPolicyDetailsDrawerQuery.graphql";
import {
  createPolicyRuleSummaryText,
  createPolicyScheduleSummaryText,
} from "@phoenix/utils/retentionPolicyUtils";

import { RetentionPolicyActionMenu } from "./RetentionPolicyActionMenu";
import { RetentionPolicyProjects } from "./RetentionPolicyProjects";

const policyDetailsBodyCSS = css`
  overflow-y: auto;
  min-height: 0;
`;

const policyDetailsGridCSS = css`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--global-dimension-size-100);
`;

const policyDetailsValueCSS = css`
  margin-top: var(--global-dimension-size-50);
`;

function RetentionPolicyDetailsContent({ policyId }: { policyId: string }) {
  const navigate = useNavigate();
  const canManageRetentionPolicy = useViewerCanManageRetentionPolicy();
  const data = useLazyLoadQuery<RetentionPolicyDetailsDrawerQuery>(
    graphql`
      query RetentionPolicyDetailsDrawerQuery($policyId: ID!) {
        node(id: $policyId) {
          __typename
          ... on ProjectTraceRetentionPolicy {
            id
            name
            cronExpression
            rule {
              __typename
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
            projects(first: 1000) {
              edges {
                node {
                  id
                  name
                  gradientStartColor
                  gradientEndColor
                }
              }
            }
          }
        }
      }
    `,
    { policyId },
    { fetchPolicy: "store-and-network" }
  );
  const policy = data.node;
  invariant(
    policy.__typename === "ProjectTraceRetentionPolicy",
    "Retention policy is required"
  );
  const projects = policy.projects.edges.map((edge) => edge.node);
  const isDefaultPolicy = policy.name === DEFAULT_RETENTION_POLICY_NAME;

  return (
    <Dialog aria-label={`Retention policy details for ${policy.name}`}>
      <DialogContent>
        <DialogHeader>
          <Flex direction="row" gap="size-200" alignItems="center">
            <DialogCloseButton slot="close" />
            <DialogTitle>{`Policy: ${policy.name}`}</DialogTitle>
          </Flex>
          <DialogTitleExtra>
            {canManageRetentionPolicy && (
              <RetentionPolicyActionMenu
                policyId={policy.id}
                policyName={policy.name}
                projectNames={projects.map((project) => project.name)}
                onPolicyDelete={() => navigate("/settings/data")}
              />
            )}
          </DialogTitleExtra>
        </DialogHeader>
        <div css={policyDetailsBodyCSS}>
          <View padding="size-200">
            <Flex direction="column" gap="size-200">
              {isDefaultPolicy && (
                <Text size="S" color="text-700">
                  Projects without an explicitly assigned policy automatically
                  use this default policy.
                </Text>
              )}
              <ul css={policyDetailsGridCSS}>
                <li>
                  <Text size="XS" color="text-700">
                    Schedule
                  </Text>
                  <div css={policyDetailsValueCSS}>
                    <Text>
                      {createPolicyScheduleSummaryText({
                        schedule: policy.cronExpression,
                      })}
                    </Text>
                  </div>
                </li>
                <li>
                  <Text size="XS" color="text-700">
                    Rule
                  </Text>
                  <div css={policyDetailsValueCSS}>
                    <Text>{createPolicyRuleSummaryText(policy.rule)}</Text>
                  </div>
                </li>
              </ul>
            </Flex>
          </View>
          <View paddingX="size-200" paddingBottom="size-200">
            <RetentionPolicyProjects
              policyId={policy.id}
              projects={projects}
              canManage={canManageRetentionPolicy && !isDefaultPolicy}
            />
          </View>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RetentionPolicyDetailsDrawer() {
  const { policyId } = useParams();
  const navigate = useNavigate();
  const { defaultSize, onSizeChange } = useDefaultDrawerSize({
    id: "settings-retention-policy-details",
  });
  invariant(policyId, "policyId is required");

  return (
    <Drawer
      isOpen
      onClose={() => navigate("/settings/data")}
      defaultSize={defaultSize}
      minSize={DRAWER_DEFAULT_MIN_SIZE}
      onResize={onSizeChange}
    >
      <Suspense
        fallback={
          <View padding="size-400">
            <Loading />
          </View>
        }
      >
        <RetentionPolicyDetailsContent policyId={policyId} />
      </Suspense>
    </Drawer>
  );
}
