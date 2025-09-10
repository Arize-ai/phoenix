/**
 * @generated SignedSource<<50cc6ba087cb8bbb2a6737878fafa5e3>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PatchProjectTraceRetentionPolicyInput = {
  addProjects?: ReadonlyArray<string> | null;
  cronExpression?: string | null;
  id: string;
  name?: string | null;
  removeProjects?: ReadonlyArray<string> | null;
  rule?: ProjectTraceRetentionRuleInput | null;
};
export type ProjectTraceRetentionRuleInput = {
  maxCount?: ProjectTraceRetentionRuleMaxCountInput | null;
  maxDays?: ProjectTraceRetentionRuleMaxDaysInput | null;
  maxDaysOrCount?: ProjectTraceRetentionRuleMaxDaysOrCountInput | null;
};
export type ProjectTraceRetentionRuleMaxDaysInput = {
  maxDays: number;
};
export type ProjectTraceRetentionRuleMaxCountInput = {
  maxCount: number;
};
export type ProjectTraceRetentionRuleMaxDaysOrCountInput = {
  maxCount: number;
  maxDays: number;
};
export type EditRetentionPolicyMutation$variables = {
  input: PatchProjectTraceRetentionPolicyInput;
};
export type EditRetentionPolicyMutation$data = {
  readonly patchProjectTraceRetentionPolicy: {
    readonly query: {
      readonly " $fragmentSpreads": FragmentRefs<"RetentionPoliciesTable_policies">;
    };
  };
};
export type EditRetentionPolicyMutation = {
  response: EditRetentionPolicyMutation$data;
  variables: EditRetentionPolicyMutation$variables;
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
    "name": "EditRetentionPolicyMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "ProjectTraceRetentionPolicyMutationPayload",
        "kind": "LinkedField",
        "name": "patchProjectTraceRetentionPolicy",
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
    "name": "EditRetentionPolicyMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "ProjectTraceRetentionPolicyMutationPayload",
        "kind": "LinkedField",
        "name": "patchProjectTraceRetentionPolicy",
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
    "cacheID": "33fe12216c505479e31745383b2089cb",
    "id": null,
    "metadata": {},
    "name": "EditRetentionPolicyMutation",
    "operationKind": "mutation",
    "text": "mutation EditRetentionPolicyMutation(\n  $input: PatchProjectTraceRetentionPolicyInput!\n) {\n  patchProjectTraceRetentionPolicy(input: $input) {\n    query {\n      ...RetentionPoliciesTable_policies\n    }\n  }\n}\n\nfragment RetentionPoliciesTable_policies on Query {\n  projectTraceRetentionPolicies(first: 1000) {\n    edges {\n      node {\n        ...RetentionPoliciesTable_retentionPolicy\n        id\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n\nfragment RetentionPoliciesTable_retentionPolicy on ProjectTraceRetentionPolicy {\n  id\n  name\n  cronExpression\n  rule {\n    __typename\n    ... on TraceRetentionRuleMaxCount {\n      maxCount\n    }\n    ... on TraceRetentionRuleMaxDays {\n      maxDays\n    }\n    ... on TraceRetentionRuleMaxDaysOrCount {\n      maxDays\n      maxCount\n    }\n  }\n  projects {\n    edges {\n      node {\n        name\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "9abcdadabb062864df4609df1e0448fd";

export default node;
