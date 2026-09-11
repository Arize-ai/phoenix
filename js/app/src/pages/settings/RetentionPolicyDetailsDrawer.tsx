import { css } from "@emotion/react";
import { Suspense } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { useNavigate, useParams } from "react-router";
import invariant from "tiny-invariant";

import {
  Dialog,
  Drawer,
  Flex,
  Skeleton,
  Text,
  View,
  VisuallyHidden,
} from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import {
  DRAWER_DEFAULT_MIN_SIZE,
  useDefaultDrawerSize,
} from "@phoenix/components/core/overlay";
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

function RetentionPolicyDetailsFallback() {
  return (
    <DialogContent>
      <VisuallyHidden role="status">
        Loading retention policy details
      </VisuallyHidden>
      <DialogHeader>
        <Flex direction="row" gap="size-200" alignItems="center">
          <DialogCloseButton slot="close" />
          <Skeleton width={200} height={24} animation="wave" />
        </Flex>
      </DialogHeader>
      <View padding="size-200">
        <Flex direction="column" gap="size-200">
          <Flex direction="row" gap="size-100">
            <Skeleton height={60} animation="wave" />
            <Skeleton height={60} animation="wave" />
          </Flex>
          <Skeleton height={200} animation="wave" />
        </Flex>
      </View>
    </DialogContent>
  );
}

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
                Projects without an explicitly assigned policy automatically use
                this default policy.
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
      <Dialog aria-label="Retention policy details">
        <Suspense fallback={<RetentionPolicyDetailsFallback />}>
          <RetentionPolicyDetailsContent policyId={policyId} />
        </Suspense>
      </Dialog>
    </Drawer>
  );
}
