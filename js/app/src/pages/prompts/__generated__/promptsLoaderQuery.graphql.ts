/**
 * @generated SignedSource<<43ef6867c9542fd6b6a36f277b618bd9>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type promptsLoaderQuery$variables = Record<PropertyKey, never>;
export type promptsLoaderQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"PromptsTable_items">;
};
export type promptsLoaderQuery = {
  response: promptsLoaderQuery$data;
  variables: promptsLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 100
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
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
  "name": "description",
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
  (v2/*:: as any*/)
],
v6 = {
  "alias": null,
  "args": null,
  "concreteType": "User",
  "kind": "LinkedField",
  "name": "createdBy",
  "plural": false,
  "selections": (v5/*:: as any*/),
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "concreteType": "User",
  "kind": "LinkedField",
  "name": "updatedBy",
  "plural": false,
  "selections": (v5/*:: as any*/),
  "storageKey": null
},
v8 = [
  (v2/*:: as any*/),
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
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "versionCount",
  "storageKey": null
},
v10 = [
  (v2/*:: as any*/),
  (v3/*:: as any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "color",
    "storageKey": null
  }
],
v11 = {
  "kind": "InlineFragment",
  "selections": [
    (v2/*:: as any*/)
  ],
  "type": "Node",
  "abstractKey": "__isNode"
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "promptsLoaderQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "PromptsTable_items"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "promptsLoaderQuery",
    "selections": [
      {
        "alias": null,
        "args": (v0/*:: as any*/),
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
                  (v1/*:: as any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v2/*:: as any*/),
                      (v3/*:: as any*/),
                      (v4/*:: as any*/),
                      (v6/*:: as any*/),
                      (v7/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "PromptVersion",
                        "kind": "LinkedField",
                        "name": "version",
                        "plural": false,
                        "selections": (v8/*:: as any*/),
                        "storageKey": null
                      },
                      (v9/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "PromptVersionTag",
                        "kind": "LinkedField",
                        "name": "versionTags",
                        "plural": true,
                        "selections": [
                          (v2/*:: as any*/),
                          (v3/*:: as any*/),
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
                        "selections": (v10/*:: as any*/),
                        "storageKey": null
                      }
                    ],
                    "type": "Prompt",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v2/*:: as any*/),
                      (v3/*:: as any*/),
                      (v4/*:: as any*/),
                      (v6/*:: as any*/),
                      (v7/*:: as any*/),
                      {
                        "alias": "latestVersion",
                        "args": null,
                        "concreteType": "DecisionVersion",
                        "kind": "LinkedField",
                        "name": "version",
                        "plural": false,
                        "selections": (v8/*:: as any*/),
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "updatedAt",
                        "storageKey": null
                      },
                      (v9/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "DecisionVersionTag",
                        "kind": "LinkedField",
                        "name": "versionTags",
                        "plural": true,
                        "selections": [
                          (v2/*:: as any*/),
                          (v3/*:: as any*/),
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
                        "selections": (v10/*:: as any*/),
                        "storageKey": null
                      }
                    ],
                    "type": "Decision",
                    "abstractKey": null
                  },
                  (v11/*:: as any*/)
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
                  (v1/*:: as any*/),
                  (v11/*:: as any*/)
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
        "args": (v0/*:: as any*/),
        "filters": [
          "filter",
          "labelIds"
        ],
        "handle": "connection",
        "key": "PromptsTable_promptsAndDecisions",
        "kind": "LinkedHandle",
        "name": "promptsAndDecisions"
      }
    ]
  },
  "params": {
    "cacheID": "6fed6f17e6200ea2848fce80b25116a5",
    "id": null,
    "metadata": {},
    "name": "promptsLoaderQuery",
    "operationKind": "query",
    "text": "query promptsLoaderQuery {\n  ...PromptsTable_items\n}\n\nfragment PromptsTable_items on Query {\n  promptsAndDecisions(first: 100) {\n    edges {\n      item: node {\n        __typename\n        ... on Prompt {\n          id\n          name\n          description\n          createdBy {\n            username\n            profilePictureUrl\n            id\n          }\n          updatedBy {\n            username\n            profilePictureUrl\n            id\n          }\n          version {\n            id\n            createdAt\n            modelName\n            modelProvider\n          }\n          versionCount\n          versionTags {\n            id\n            name\n            promptVersionId\n          }\n          labels {\n            id\n            name\n            color\n          }\n        }\n        ... on Decision {\n          id\n          name\n          description\n          createdBy {\n            username\n            profilePictureUrl\n            id\n          }\n          updatedBy {\n            username\n            profilePictureUrl\n            id\n          }\n          latestVersion: version {\n            id\n            createdAt\n            modelName\n            modelProvider\n          }\n          updatedAt\n          versionCount\n          versionTags {\n            id\n            name\n            decisionVersionId\n          }\n          labels {\n            id\n            name\n            color\n          }\n        }\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n      }\n      cursor\n      node {\n        __typename\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "060b23998a47b0361d298c52896554e1";

export default node;
