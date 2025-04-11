/**
 * @generated SignedSource<<44de54253ef3ceb18de55f439132a984>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type RetentionPoliciesTable_policies$data = {
  readonly projectTraceRetentionPolicies: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly cronExpression: string;
        readonly id: string;
        readonly name: string;
        readonly projects: {
          readonly edges: ReadonlyArray<{
            readonly node: {
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
      };
    }>;
  };
  readonly " $fragmentType": "RetentionPoliciesTable_policies";
};
export type RetentionPoliciesTable_policies$key = {
  readonly " $data"?: RetentionPoliciesTable_policies$data;
  readonly " $fragmentSpreads": FragmentRefs<"RetentionPoliciesTable_policies">;
};

import RetentionPoliciesTablePoliciesQuery_graphql from './RetentionPoliciesTablePoliciesQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "maxCount",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "maxDays",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [],
      "operation": RetentionPoliciesTablePoliciesQuery_graphql
    }
  },
  "name": "RetentionPoliciesTable_policies",
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
                (v0/*: any*/),
                (v1/*: any*/),
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
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "__typename",
                      "storageKey": null
                    },
                    {
                      "kind": "InlineFragment",
                      "selections": [
                        (v2/*: any*/)
                      ],
                      "type": "TraceRetentionRuleMaxCount",
                      "abstractKey": null
                    },
                    {
                      "kind": "InlineFragment",
                      "selections": [
                        (v3/*: any*/)
                      ],
                      "type": "TraceRetentionRuleMaxDays",
                      "abstractKey": null
                    },
                    {
                      "kind": "InlineFragment",
                      "selections": [
                        (v3/*: any*/),
                        (v2/*: any*/)
                      ],
                      "type": "TraceRetentionRuleMaxDaysOrCount",
                      "abstractKey": null
                    }
                  ],
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "ProjectConnection",
                  "kind": "LinkedField",
                  "name": "projects",
                  "plural": false,
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "ProjectEdge",
                      "kind": "LinkedField",
                      "name": "edges",
                      "plural": true,
                      "selections": [
                        {
                          "alias": null,
                          "args": null,
                          "concreteType": "Project",
                          "kind": "LinkedField",
                          "name": "node",
                          "plural": false,
                          "selections": [
                            (v1/*: any*/),
                            (v0/*: any*/)
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

(node as any).hash = "feb1765a1377047f429634b1ed579dbc";

export default node;
