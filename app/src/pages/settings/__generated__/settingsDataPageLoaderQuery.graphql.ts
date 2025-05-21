/**
 * @generated SignedSource<<42c8ba4606e3b5085c1df33fbf4813f3>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type settingsDataPageLoaderQuery$variables = Record<PropertyKey, never>;
export type settingsDataPageLoaderQuery$data = {
  readonly __id: string;
  readonly " $fragmentSpreads": FragmentRefs<"RetentionPoliciesTable_policies">;
};
export type settingsDataPageLoaderQuery = {
  response: settingsDataPageLoaderQuery$data;
  variables: settingsDataPageLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
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
},
v1 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 1000
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "maxCount",
  "storageKey": null
},
v6 = {
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
    "name": "settingsDataPageLoaderQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "RetentionPoliciesTable_policies"
      },
      (v0/*: any*/)
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "settingsDataPageLoaderQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
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
                  (v2/*: any*/),
                  (v3/*: any*/),
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
                      (v4/*: any*/),
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v5/*: any*/)
                        ],
                        "type": "TraceRetentionRuleMaxCount",
                        "abstractKey": null
                      },
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v6/*: any*/)
                        ],
                        "type": "TraceRetentionRuleMaxDays",
                        "abstractKey": null
                      },
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v6/*: any*/),
                          (v5/*: any*/)
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
                              (v3/*: any*/),
                              (v2/*: any*/)
                            ],
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  (v4/*: any*/)
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
          (v0/*: any*/)
        ],
        "storageKey": "projectTraceRetentionPolicies(first:1000)"
      },
      {
        "alias": null,
        "args": (v1/*: any*/),
        "filters": null,
        "handle": "connection",
        "key": "RetentionPoliciesTable_projectTraceRetentionPolicies",
        "kind": "LinkedHandle",
        "name": "projectTraceRetentionPolicies"
      },
      (v0/*: any*/)
    ]
  },
  "params": {
    "cacheID": "f9f28f0c1f07a912207e1a17f4a46292",
    "id": null,
    "metadata": {},
    "name": "settingsDataPageLoaderQuery",
    "operationKind": "query",
    "text": "query settingsDataPageLoaderQuery {\n  ...RetentionPoliciesTable_policies\n}\n\nfragment RetentionPoliciesTable_policies on Query {\n  projectTraceRetentionPolicies(first: 1000) {\n    edges {\n      node {\n        ...RetentionPoliciesTable_retentionPolicy\n        id\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n\nfragment RetentionPoliciesTable_retentionPolicy on ProjectTraceRetentionPolicy {\n  id\n  name\n  cronExpression\n  rule {\n    __typename\n    ... on TraceRetentionRuleMaxCount {\n      maxCount\n    }\n    ... on TraceRetentionRuleMaxDays {\n      maxDays\n    }\n    ... on TraceRetentionRuleMaxDaysOrCount {\n      maxDays\n      maxCount\n    }\n  }\n  projects {\n    edges {\n      node {\n        name\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "17d72dfe84adde031abd0890b21bdea6";

export default node;
