/**
 * @generated SignedSource<<dae34ede650d12ee9fbcd726a67b1ec2>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DeleteProjectTraceRetentionPolicyInput = {
  id: string;
};
export type RetentionPolicyActionMenuDeletePolicyMutation$variables = {
  input: DeleteProjectTraceRetentionPolicyInput;
};
export type RetentionPolicyActionMenuDeletePolicyMutation$data = {
  readonly deleteProjectTraceRetentionPolicy: {
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
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v2 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 1000
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "maxCount",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "maxDays",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "RetentionPolicyActionMenuDeletePolicyMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "RetentionPolicyActionMenuDeletePolicyMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
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
                "args": (v2/*: any*/),
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
                          (v4/*: any*/),
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
                              (v5/*: any*/),
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v6/*: any*/)
                                ],
                                "type": "TraceRetentionRuleMaxCount",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v7/*: any*/)
                                ],
                                "type": "TraceRetentionRuleMaxDays",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v7/*: any*/),
                                  (v6/*: any*/)
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
                                      (v4/*: any*/),
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
                          (v5/*: any*/)
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
                  }
                ],
                "storageKey": "projectTraceRetentionPolicies(first:1000)"
              },
              {
                "alias": null,
                "args": (v2/*: any*/),
                "filters": null,
                "handle": "connection",
                "key": "RetentionPoliciesTable_projectTraceRetentionPolicies",
                "kind": "LinkedHandle",
                "name": "projectTraceRetentionPolicies"
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
    "cacheID": "afc021156633e97d64f94bfdf6a1829d",
    "id": null,
    "metadata": {},
    "name": "RetentionPolicyActionMenuDeletePolicyMutation",
    "operationKind": "mutation",
    "text": "mutation RetentionPolicyActionMenuDeletePolicyMutation(\n  $input: DeleteProjectTraceRetentionPolicyInput!\n) {\n  deleteProjectTraceRetentionPolicy(input: $input) {\n    query {\n      ...RetentionPoliciesTable_policies\n    }\n  }\n}\n\nfragment RetentionPoliciesTable_policies on Query {\n  projectTraceRetentionPolicies(first: 1000) {\n    edges {\n      node {\n        id\n        name\n        cronExpression\n        rule {\n          __typename\n          ... on TraceRetentionRuleMaxCount {\n            maxCount\n          }\n          ... on TraceRetentionRuleMaxDays {\n            maxDays\n          }\n          ... on TraceRetentionRuleMaxDaysOrCount {\n            maxDays\n            maxCount\n          }\n        }\n        projects {\n          edges {\n            node {\n              name\n              id\n            }\n          }\n        }\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "788c62dc4dbfec7dfce278655dc9cc63";

export default node;
