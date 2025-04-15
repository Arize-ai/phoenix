/**
 * @generated SignedSource<<8f83835f2ad5e8902e30e507855cd5eb>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type CreateProjectTraceRetentionPolicyInput = {
  addProjects?: ReadonlyArray<string> | null;
  cronExpression: string;
  name: string;
  rule: ProjectTraceRetentionRuleInput;
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
export type CreateRetentionPolicyMutation$variables = {
  input: CreateProjectTraceRetentionPolicyInput;
};
export type CreateRetentionPolicyMutation$data = {
  readonly createProjectTraceRetentionPolicy: {
    readonly query: {
      readonly " $fragmentSpreads": FragmentRefs<"RetentionPoliciesTable_policies">;
    };
  };
};
export type CreateRetentionPolicyMutation = {
  response: CreateRetentionPolicyMutation$data;
  variables: CreateRetentionPolicyMutation$variables;
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
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "CreateRetentionPolicyMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "ProjectTraceRetentionPolicyMutationPayload",
        "kind": "LinkedField",
        "name": "createProjectTraceRetentionPolicy",
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
    "name": "CreateRetentionPolicyMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "ProjectTraceRetentionPolicyMutationPayload",
        "kind": "LinkedField",
        "name": "createProjectTraceRetentionPolicy",
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
    "cacheID": "606b141232080d3d2b4ff4e75064cd94",
    "id": null,
    "metadata": {},
    "name": "CreateRetentionPolicyMutation",
    "operationKind": "mutation",
    "text": "mutation CreateRetentionPolicyMutation(\n  $input: CreateProjectTraceRetentionPolicyInput!\n) {\n  createProjectTraceRetentionPolicy(input: $input) {\n    query {\n      ...RetentionPoliciesTable_policies\n    }\n  }\n}\n\nfragment RetentionPoliciesTable_policies on Query {\n  projectTraceRetentionPolicies {\n    edges {\n      node {\n        id\n        name\n        cronExpression\n        rule {\n          __typename\n          ... on TraceRetentionRuleMaxCount {\n            maxCount\n          }\n          ... on TraceRetentionRuleMaxDays {\n            maxDays\n          }\n          ... on TraceRetentionRuleMaxDaysOrCount {\n            maxDays\n            maxCount\n          }\n        }\n        projects {\n          edges {\n            node {\n              name\n              id\n            }\n          }\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "b012653380fd1ba759a391f3eec9652b";

export default node;
