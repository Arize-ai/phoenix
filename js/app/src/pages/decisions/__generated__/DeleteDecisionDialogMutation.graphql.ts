/**
 * @generated SignedSource<<3558bbd871c8a3c63583e1d4ddd97561>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DeleteDecisionDialogMutation$variables = {
  decisionId: string;
};
export type DeleteDecisionDialogMutation$data = {
  readonly deleteDecision: {
    readonly query: {
      readonly " $fragmentSpreads": FragmentRefs<"DecisionsTable_decisions">;
    };
  };
};
export type DeleteDecisionDialogMutation = {
  response: DeleteDecisionDialogMutation$data;
  variables: DeleteDecisionDialogMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "decisionId"
  }
],
v1 = [
  {
    "fields": [
      {
        "kind": "Variable",
        "name": "decisionId",
        "variableName": "decisionId"
      }
    ],
    "kind": "ObjectValue",
    "name": "input"
  }
],
v2 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 100
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
v5 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "username",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "profilePictureUrl",
    "storageKey": null
  },
  (v3/*:: as any*/)
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DeleteDecisionDialogMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "DeleteDecisionMutationPayload",
        "kind": "LinkedField",
        "name": "deleteDecision",
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
                "name": "DecisionsTable_decisions"
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "DeleteDecisionDialogMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "DeleteDecisionMutationPayload",
        "kind": "LinkedField",
        "name": "deleteDecision",
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
                "args": (v2/*:: as any*/),
                "concreteType": "DecisionConnection",
                "kind": "LinkedField",
                "name": "decisions",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "DecisionEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": "decision",
                        "args": null,
                        "concreteType": "Decision",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v3/*:: as any*/),
                          (v4/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "description",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "User",
                            "kind": "LinkedField",
                            "name": "createdBy",
                            "plural": false,
                            "selections": (v5/*:: as any*/),
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "User",
                            "kind": "LinkedField",
                            "name": "updatedBy",
                            "plural": false,
                            "selections": (v5/*:: as any*/),
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "DecisionVersion",
                            "kind": "LinkedField",
                            "name": "version",
                            "plural": false,
                            "selections": [
                              (v3/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "createdAt",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "modelName",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "modelProvider",
                                "storageKey": null
                              }
                            ],
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "updatedAt",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "versionCount",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "DecisionVersionTag",
                            "kind": "LinkedField",
                            "name": "versionTags",
                            "plural": true,
                            "selections": [
                              (v3/*:: as any*/),
                              (v4/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "decisionVersionId",
                                "storageKey": null
                              }
                            ],
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "DecisionLabel",
                            "kind": "LinkedField",
                            "name": "labels",
                            "plural": true,
                            "selections": [
                              (v3/*:: as any*/),
                              (v4/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "color",
                                "storageKey": null
                              }
                            ],
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "cursor",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "Decision",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "__typename",
                            "storageKey": null
                          },
                          (v3/*:: as any*/)
                        ],
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
                "storageKey": "decisions(first:100)"
              },
              {
                "alias": null,
                "args": (v2/*:: as any*/),
                "filters": [
                  "filter",
                  "labelIds"
                ],
                "handle": "connection",
                "key": "DecisionsTable_decisions",
                "kind": "LinkedHandle",
                "name": "decisions"
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
    "cacheID": "0d8a6e7ff11fd747ca666ed100f3d01a",
    "id": null,
    "metadata": {},
    "name": "DeleteDecisionDialogMutation",
    "operationKind": "mutation",
    "text": "mutation DeleteDecisionDialogMutation(\n  $decisionId: ID!\n) {\n  deleteDecision(input: {decisionId: $decisionId}) {\n    query {\n      ...DecisionsTable_decisions\n    }\n  }\n}\n\nfragment DecisionsTable_decisions on Query {\n  decisions(first: 100) {\n    edges {\n      decision: node {\n        id\n        name\n        description\n        createdBy {\n          username\n          profilePictureUrl\n          id\n        }\n        updatedBy {\n          username\n          profilePictureUrl\n          id\n        }\n        version {\n          id\n          createdAt\n          modelName\n          modelProvider\n        }\n        updatedAt\n        versionCount\n        versionTags {\n          id\n          name\n          decisionVersionId\n        }\n        labels {\n          id\n          name\n          color\n        }\n      }\n      cursor\n      node {\n        __typename\n        id\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "104fabf48ed41ba0a494f5fe590b0938";

export default node;
