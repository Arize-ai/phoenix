/**
 * @generated SignedSource<<1d2e2ace0c26ace14641b447a6152247>>
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
    readonly __id: string;
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly " $fragmentSpreads": FragmentRefs<"RetentionPoliciesTable_retentionPolicy">;
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
var v0 = [
  "projectTraceRetentionPolicies"
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "maxCount",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "maxDays",
  "storageKey": null
};
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "after"
    },
    {
      "defaultValue": 1000,
      "kind": "LocalArgument",
      "name": "first"
    }
  ],
  "kind": "Fragment",
  "metadata": {
    "connection": [
      {
        "count": "first",
        "cursor": "after",
        "direction": "forward",
        "path": (v0/*: any*/)
      }
    ],
    "refetch": {
      "connection": {
        "forward": {
          "count": "first",
          "cursor": "after"
        },
        "backward": null,
        "path": (v0/*: any*/)
      },
      "fragmentPathInResult": [],
      "operation": RetentionPoliciesTablePoliciesQuery_graphql
    }
  },
  "name": "RetentionPoliciesTable_policies",
  "selections": [
    {
      "alias": "projectTraceRetentionPolicies",
      "args": null,
      "concreteType": "ProjectTraceRetentionPolicyConnection",
      "kind": "LinkedField",
      "name": "__RetentionPoliciesTable_projectTraceRetentionPolicies_connection",
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
                  "kind": "InlineDataFragmentSpread",
                  "name": "RetentionPoliciesTable_retentionPolicy",
                  "selections": [
                    (v1/*: any*/),
                    (v2/*: any*/),
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
                        (v3/*: any*/),
                        {
                          "kind": "InlineFragment",
                          "selections": [
                            (v4/*: any*/)
                          ],
                          "type": "TraceRetentionRuleMaxCount",
                          "abstractKey": null
                        },
                        {
                          "kind": "InlineFragment",
                          "selections": [
                            (v5/*: any*/)
                          ],
                          "type": "TraceRetentionRuleMaxDays",
                          "abstractKey": null
                        },
                        {
                          "kind": "InlineFragment",
                          "selections": [
                            (v5/*: any*/),
                            (v4/*: any*/)
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
                                (v2/*: any*/),
                                (v1/*: any*/)
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
                  "args": null,
                  "argumentDefinitions": []
                },
                (v3/*: any*/)
              ],
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "cursor",
              "storageKey": null
            }
          ],
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "PageInfo",
          "kind": "LinkedField",
          "name": "pageInfo",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "endCursor",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "hasNextPage",
              "storageKey": null
            }
          ],
          "storageKey": null
        },
        {
          "kind": "ClientExtension",
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "__id",
              "storageKey": null
            }
          ]
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};
})();

(node as any).hash = "21f8b6156e669019ebb7877c04f48ade";

export default node;
