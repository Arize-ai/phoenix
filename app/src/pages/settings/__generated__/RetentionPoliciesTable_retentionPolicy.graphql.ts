/**
 * @generated SignedSource<<030b1009e10c02889427d2b6ac43a6aa>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type RetentionPoliciesTable_retentionPolicy$data = {
  readonly cronExpression: string;
  readonly id: string;
  readonly name: string;
  readonly projects: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly gradientEndColor: string;
        readonly gradientStartColor: string;
        readonly id: string;
        readonly name: string;
      };
    }>;
  };
  readonly rule: {
    readonly __typename: "TraceRetentionRuleMaxCount";
    readonly maxCount: number;
  } | {
    readonly __typename: "TraceRetentionRuleMaxDays";
    readonly maxDays: number;
  } | {
    readonly __typename: "TraceRetentionRuleMaxDaysOrCount";
    readonly maxCount: number;
    readonly maxDays: number;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
  readonly " $fragmentType": "RetentionPoliciesTable_retentionPolicy";
};
export type RetentionPoliciesTable_retentionPolicy$key = {
  readonly " $data"?: RetentionPoliciesTable_retentionPolicy$data;
  readonly " $fragmentSpreads": FragmentRefs<"RetentionPoliciesTable_retentionPolicy">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "RetentionPoliciesTable_retentionPolicy"
};

(node as any).hash = "225cd8c5b7fa4e33336b3ebe392b3988";

export default node;
