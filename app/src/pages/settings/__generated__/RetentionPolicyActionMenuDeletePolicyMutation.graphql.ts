/**
 * @generated SignedSource<<d97c7415da3bb3b176723a30541ce9a5>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type RetentionPolicyActionMenuDeletePolicyMutation$variables = {
  connectionId: string;
  policyId: string;
};
export type RetentionPolicyActionMenuDeletePolicyMutation$data = {
  readonly deleteProjectTraceRetentionPolicy: {
    readonly node: {
      readonly id: string;
    };
    readonly query: {
      readonly " $fragmentSpreads": FragmentRefs<"RetentionPoliciesTable_policies">;
    };
  };
};
export type RetentionPolicyActionMenuDeletePolicyMutation = {
  response: RetentionPolicyActionMenuDeletePolicyMutation$data;
  variables: RetentionPolicyActionMenuDeletePolicyMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "connectionId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "policyId"
},
v2 = [
  {
    "fields": [
      {
        "kind": "Variable",
        "name": "id",
        "variableName": "policyId"
      }
    ],
    "kind": "ObjectValue",
    "name": "input"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 1000
  }
],
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "maxCount",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "maxDays",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "RetentionPolicyActionMenuDeletePolicyMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "ProjectTraceRetentionPolicyMutationPayload",
        "kind": "LinkedField",
        "name": "deleteProjectTraceRetentionPolicy",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "RetentionPoliciesTable_policies"
              }
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "ProjectTraceRetentionPolicy",
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              (v3/*: any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "RetentionPolicyActionMenuDeletePolicyMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "ProjectTraceRetentionPolicyMutationPayload",
        "kind": "LinkedField",
        "name": "deleteProjectTraceRetentionPolicy",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": (v4/*: any*/),
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
                          (v3/*: any*/),
                          (v5/*: any*/),
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
                              (v6/*: any*/),
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v7/*: any*/)
                                ],
                                "type": "TraceRetentionRuleMaxCount",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v8/*: any*/)
                                ],
                                "type": "TraceRetentionRuleMaxDays",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v8/*: any*/),
                                  (v7/*: any*/)
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
                                      (v5/*: any*/),
                                      (v3/*: any*/)
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "storageKey": null
                              }
                            ],
                            "storageKey": null
                          },
                          (v6/*: any*/)
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
                "storageKey": "projectTraceRetentionPolicies(first:1000)"
              },
              {
                "alias": null,
                "args": (v4/*: any*/),
                "filters": null,
                "handle": "connection",
                "key": "RetentionPoliciesTable_projectTraceRetentionPolicies",
                "kind": "LinkedHandle",
                "name": "projectTraceRetentionPolicies"
              }
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "ProjectTraceRetentionPolicy",
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              (v3/*: any*/),
              {
                "alias": null,
                "args": null,
                "filters": null,
                "handle": "deleteEdge",
                "key": "",
                "kind": "ScalarHandle",
                "name": "id",
                "handleArgs": [
                  {
                    "items": [
                      {
                        "kind": "Variable",
                        "name": "connections.0",
                        "variableName": "connectionId"
                      }
                    ],
                    "kind": "ListValue",
                    "name": "connections"
                  }
                ]
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
    "cacheID": "25d6433327bd55427c59288866e3f402",
    "id": null,
    "metadata": {},
    "name": "RetentionPolicyActionMenuDeletePolicyMutation",
    "operationKind": "mutation",
    "text": "mutation RetentionPolicyActionMenuDeletePolicyMutation(\n  $policyId: ID!\n) {\n  deleteProjectTraceRetentionPolicy(input: {id: $policyId}) {\n    query {\n      ...RetentionPoliciesTable_policies\n    }\n    node {\n      id\n    }\n  }\n}\n\nfragment RetentionPoliciesTable_policies on Query {\n  projectTraceRetentionPolicies(first: 1000) {\n    edges {\n      node {\n        ...RetentionPoliciesTable_retentionPolicy\n        id\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n\nfragment RetentionPoliciesTable_retentionPolicy on ProjectTraceRetentionPolicy {\n  id\n  name\n  cronExpression\n  rule {\n    __typename\n    ... on TraceRetentionRuleMaxCount {\n      maxCount\n    }\n    ... on TraceRetentionRuleMaxDays {\n      maxDays\n    }\n    ... on TraceRetentionRuleMaxDaysOrCount {\n      maxDays\n      maxCount\n    }\n  }\n  projects {\n    edges {\n      node {\n        name\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "8bcb6bc7271304d7bf45d4a661cee1ff";

export default node;
