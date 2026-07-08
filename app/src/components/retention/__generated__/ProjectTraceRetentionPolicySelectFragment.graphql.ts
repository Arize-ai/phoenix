/**
 * @generated SignedSource<<e60a1564b12b64b2c1bd32a9acfc6e23>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectTraceRetentionPolicySelectFragment$data = {
  readonly projectTraceRetentionPolicies: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly cronExpression: string;
        readonly id: string;
        readonly name: string;
        readonly rule: {
          readonly maxCount?: number;
          readonly maxDays?: number;
        };
      };
    }>;
  };
  readonly " $fragmentType": "ProjectTraceRetentionPolicySelectFragment";
};
export type ProjectTraceRetentionPolicySelectFragment$key = {
  readonly " $data"?: ProjectTraceRetentionPolicySelectFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectTraceRetentionPolicySelectFragment">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "maxCount",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "maxDays",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "ProjectTraceRetentionPolicySelectFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "ProjectTraceRetentionPolicyConnection",
      "kind": "LinkedField",
      "name": "projectTraceRetentionPolicies",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "ProjectTraceRetentionPolicyEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "ProjectTraceRetentionPolicy",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "id",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "name",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "cronExpression",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "concreteType": null,
                  "kind": "LinkedField",
                  "name": "rule",
                  "plural": false,
                  "selections": [
                    {
                      "kind": "InlineFragment",
                      "selections": [
                        (v0/*: any*/)
                      ],
                      "type": "TraceRetentionRuleMaxCount",
                      "abstractKey": null
                    },
                    {
                      "kind": "InlineFragment",
                      "selections": [
                        (v1/*: any*/)
                      ],
                      "type": "TraceRetentionRuleMaxDays",
                      "abstractKey": null
                    },
                    {
                      "kind": "InlineFragment",
                      "selections": [
                        (v1/*: any*/),
                        (v0/*: any*/)
                      ],
                      "type": "TraceRetentionRuleMaxDaysOrCount",
                      "abstractKey": null
                    }
                  ],
                  "storageKey": null
                }
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};
})();

(node as any).hash = "319a452afbbe089cfba02eaf9722b595";

export default node;
