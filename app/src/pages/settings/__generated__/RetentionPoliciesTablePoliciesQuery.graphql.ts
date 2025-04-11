/**
 * @generated SignedSource<<78277c609b2b7e4e70946848557dc832>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type RetentionPoliciesTablePoliciesQuery$variables = Record<PropertyKey, never>;
export type RetentionPoliciesTablePoliciesQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"RetentionPoliciesTable_policies">;
};
export type RetentionPoliciesTablePoliciesQuery = {
  response: RetentionPoliciesTablePoliciesQuery$data;
  variables: RetentionPoliciesTablePoliciesQuery$variables;
};

const node: ConcreteRequest = (function(){
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
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "RetentionPoliciesTablePoliciesQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "RetentionPoliciesTable_policies"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "RetentionPoliciesTablePoliciesQuery",
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
    ]
  },
  "params": {
    "cacheID": "4e8cc5986f4d500f915131f2e1348795",
    "id": null,
    "metadata": {},
    "name": "RetentionPoliciesTablePoliciesQuery",
    "operationKind": "query",
    "text": "query RetentionPoliciesTablePoliciesQuery {\n  ...RetentionPoliciesTable_policies\n}\n\nfragment RetentionPoliciesTable_policies on Query {\n  projectTraceRetentionPolicies {\n    edges {\n      node {\n        id\n        name\n        cronExpression\n        rule {\n          __typename\n          ... on TraceRetentionRuleMaxCount {\n            maxCount\n          }\n          ... on TraceRetentionRuleMaxDays {\n            maxDays\n          }\n          ... on TraceRetentionRuleMaxDaysOrCount {\n            maxDays\n            maxCount\n          }\n        }\n        projects {\n          edges {\n            node {\n              name\n              id\n            }\n          }\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "feb1765a1377047f429634b1ed579dbc";

export default node;
