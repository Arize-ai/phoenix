/**
 * @generated SignedSource<<69c723037eabdc92be4bbf078e9028b5>>
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

(node as any).hash = "da2a0ca9f6bfed6895ca04372b118ce7";

export default node;
