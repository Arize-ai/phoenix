/**
 * @generated SignedSource<<da43854d77079746917c236c9a1e4e14>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DeletePromptDialogMutation$variables = {
  promptId: string;
};
export type DeletePromptDialogMutation$data = {
  readonly deletePrompt: {
    readonly query: {
      readonly " $fragmentSpreads": FragmentRefs<"PromptsTable_items">;
    };
  };
};
export type DeletePromptDialogMutation = {
  response: DeletePromptDialogMutation$data;
  variables: DeletePromptDialogMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "promptId"
  }
],
v1 = [
  {
    "fields": [
      {
        "kind": "Variable",
        "name": "promptId",
        "variableName": "promptId"
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
  "name": "__typename",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
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
  "name": "description",
  "storageKey": null
},
v7 = [
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
  (v4/*:: as any*/)
],
v8 = {
  "alias": null,
  "args": null,
  "concreteType": "User",
  "kind": "LinkedField",
  "name": "createdBy",
  "plural": false,
  "selections": (v7/*:: as any*/),
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "concreteType": "User",
  "kind": "LinkedField",
  "name": "updatedBy",
  "plural": false,
  "selections": (v7/*:: as any*/),
  "storageKey": null
},
v10 = [
  (v4/*:: as any*/),
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
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "versionCount",
  "storageKey": null
},
v12 = [
  (v4/*:: as any*/),
  (v5/*:: as any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "color",
    "storageKey": null
  }
],
v13 = {
  "kind": "InlineFragment",
  "selections": [
    (v4/*:: as any*/)
  ],
  "type": "Node",
  "abstractKey": "__isNode"
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DeletePromptDialogMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "DeletePromptMutationPayload",
        "kind": "LinkedField",
        "name": "deletePrompt",
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
                "name": "PromptsTable_items"
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
    "name": "DeletePromptDialogMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "DeletePromptMutationPayload",
        "kind": "LinkedField",
        "name": "deletePrompt",
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
                "concreteType": "PromptOrDecisionConnection",
                "kind": "LinkedField",
                "name": "promptsAndDecisions",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "PromptOrDecisionEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": "item",
                        "args": null,
                        "concreteType": null,
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v3/*:: as any*/),
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v4/*:: as any*/),
                              (v5/*:: as any*/),
                              (v6/*:: as any*/),
                              (v8/*:: as any*/),
                              (v9/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "PromptVersion",
                                "kind": "LinkedField",
                                "name": "version",
                                "plural": false,
                                "selections": (v10/*:: as any*/),
                                "storageKey": null
                              },
                              (v11/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "PromptVersionTag",
                                "kind": "LinkedField",
                                "name": "versionTags",
                                "plural": true,
                                "selections": [
                                  (v4/*:: as any*/),
                                  (v5/*:: as any*/),
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "promptVersionId",
                                    "storageKey": null
                                  }
                                ],
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "PromptLabel",
                                "kind": "LinkedField",
                                "name": "labels",
                                "plural": true,
                                "selections": (v12/*:: as any*/),
                                "storageKey": null
                              }
                            ],
                            "type": "Prompt",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v4/*:: as any*/),
                              (v5/*:: as any*/),
                              (v6/*:: as any*/),
                              (v8/*:: as any*/),
                              (v9/*:: as any*/),
                              {
                                "alias": "latestVersion",
                                "args": null,
                                "concreteType": "DecisionVersion",
                                "kind": "LinkedField",
                                "name": "version",
                                "plural": false,
                                "selections": (v10/*:: as any*/),
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "updatedAt",
                                "storageKey": null
                              },
                              (v11/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "DecisionVersionTag",
                                "kind": "LinkedField",
                                "name": "versionTags",
                                "plural": true,
                                "selections": [
                                  (v4/*:: as any*/),
                                  (v5/*:: as any*/),
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
                                "selections": (v12/*:: as any*/),
                                "storageKey": null
                              }
                            ],
                            "type": "Decision",
                            "abstractKey": null
                          },
                          (v13/*:: as any*/)
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
                        "concreteType": null,
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v3/*:: as any*/),
                          (v13/*:: as any*/)
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
                "storageKey": "promptsAndDecisions(first:100)"
              },
              {
                "alias": null,
                "args": (v2/*:: as any*/),
                "filters": [
                  "filter",
                  "labelIds"
                ],
                "handle": "connection",
                "key": "PromptsTable_promptsAndDecisions",
                "kind": "LinkedHandle",
                "name": "promptsAndDecisions"
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
    "cacheID": "e417d7e6f075c5657715546d1ffe2ebe",
    "id": null,
    "metadata": {},
    "name": "DeletePromptDialogMutation",
    "operationKind": "mutation",
    "text": "mutation DeletePromptDialogMutation(\n  $promptId: ID!\n) {\n  deletePrompt(input: {promptId: $promptId}) {\n    query {\n      ...PromptsTable_items\n    }\n  }\n}\n\nfragment PromptsTable_items on Query {\n  promptsAndDecisions(first: 100) {\n    edges {\n      item: node {\n        __typename\n        ... on Prompt {\n          id\n          name\n          description\n          createdBy {\n            username\n            profilePictureUrl\n            id\n          }\n          updatedBy {\n            username\n            profilePictureUrl\n            id\n          }\n          version {\n            id\n            createdAt\n            modelName\n            modelProvider\n          }\n          versionCount\n          versionTags {\n            id\n            name\n            promptVersionId\n          }\n          labels {\n            id\n            name\n            color\n          }\n        }\n        ... on Decision {\n          id\n          name\n          description\n          createdBy {\n            username\n            profilePictureUrl\n            id\n          }\n          updatedBy {\n            username\n            profilePictureUrl\n            id\n          }\n          latestVersion: version {\n            id\n            createdAt\n            modelName\n            modelProvider\n          }\n          updatedAt\n          versionCount\n          versionTags {\n            id\n            name\n            decisionVersionId\n          }\n          labels {\n            id\n            name\n            color\n          }\n        }\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n      }\n      cursor\n      node {\n        __typename\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "2db5f2ee55e69d553929dfce9c88a028";

export default node;
