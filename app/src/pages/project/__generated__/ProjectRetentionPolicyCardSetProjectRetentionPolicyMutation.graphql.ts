/**
 * @generated SignedSource<<6ba1f1d68793b0d9cebd6f87e52e585d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectRetentionPolicyCardSetProjectRetentionPolicyMutation$variables = {
  policyId: string;
  projectId: string;
};
export type ProjectRetentionPolicyCardSetProjectRetentionPolicyMutation$data = {
  readonly patchProjectTraceRetentionPolicy: {
    readonly query: {
      readonly node: {
        readonly " $fragmentSpreads": FragmentRefs<"ProjectRetentionPolicyCard_policy">;
      };
    };
  };
};
export type ProjectRetentionPolicyCardSetProjectRetentionPolicyMutation = {
  response: ProjectRetentionPolicyCardSetProjectRetentionPolicyMutation$data;
  variables: ProjectRetentionPolicyCardSetProjectRetentionPolicyMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "policyId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "projectId"
},
v2 = [
  {
    "fields": [
      {
        "items": [
          {
            "kind": "Variable",
            "name": "addProjects.0",
            "variableName": "projectId"
          }
        ],
        "kind": "ListValue",
        "name": "addProjects"
      },
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
v3 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
],
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
  "name": "id",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "maxDays",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "maxCount",
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
    "name": "ProjectRetentionPolicyCardSetProjectRetentionPolicyMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
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
                "args": (v3/*: any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "args": null,
                        "kind": "FragmentSpread",
                        "name": "ProjectRetentionPolicyCard_policy"
                      }
                    ],
                    "type": "Project",
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
    "name": "ProjectRetentionPolicyCardSetProjectRetentionPolicyMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
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
                "args": (v3/*: any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v4/*: any*/),
                  (v5/*: any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v6/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "ProjectTraceRetentionPolicy",
                        "kind": "LinkedField",
                        "name": "traceRetentionPolicy",
                        "plural": false,
                        "selections": [
                          (v5/*: any*/),
                          (v6/*: any*/),
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
                                  (v7/*: any*/)
                                ],
                                "type": "TraceRetentionRuleMaxDays",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v8/*: any*/)
                                ],
                                "type": "TraceRetentionRuleMaxCount",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v7/*: any*/),
                                  (v8/*: any*/)
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
                    "type": "Project",
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
    ]
  },
  "params": {
    "cacheID": "a98d713987237f83deb503164dc5d9b2",
    "id": null,
    "metadata": {},
    "name": "ProjectRetentionPolicyCardSetProjectRetentionPolicyMutation",
    "operationKind": "mutation",
    "text": "mutation ProjectRetentionPolicyCardSetProjectRetentionPolicyMutation(\n  $projectId: ID!\n  $policyId: ID!\n) {\n  patchProjectTraceRetentionPolicy(input: {id: $policyId, addProjects: [$projectId]}) {\n    query {\n      node(id: $projectId) {\n        __typename\n        ... on Project {\n          ...ProjectRetentionPolicyCard_policy\n        }\n        id\n      }\n    }\n  }\n}\n\nfragment ProjectRetentionPolicyCard_policy on Project {\n  id\n  name\n  traceRetentionPolicy {\n    id\n    name\n    cronExpression\n    rule {\n      __typename\n      ... on TraceRetentionRuleMaxDays {\n        maxDays\n      }\n      ... on TraceRetentionRuleMaxCount {\n        maxCount\n      }\n      ... on TraceRetentionRuleMaxDaysOrCount {\n        maxDays\n        maxCount\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "7b5534147b50d4a3232a2d5d94705212";

export default node;
