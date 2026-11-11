/**
 * @generated SignedSource<<e0d6c72a8c9dfc57ab3898871ea6f4fc>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptLatestVersionsListTestQuery$variables = Record<PropertyKey, never>;
export type PromptLatestVersionsListTestQuery$data = {
  readonly prompt: {
    readonly " $fragmentSpreads": FragmentRefs<"PromptLatestVersionsListFragment">;
  };
};
export type PromptLatestVersionsListTestQuery = {
  response: PromptLatestVersionsListTestQuery$data;
  variables: PromptLatestVersionsListTestQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "kind": "Literal",
    "name": "id",
    "value": "test-prompt-id"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = {
  "enumValues": null,
  "nullable": false,
  "plural": false,
  "type": "String"
},
v3 = {
  "enumValues": null,
  "nullable": false,
  "plural": false,
  "type": "ID"
},
v4 = {
  "enumValues": null,
  "nullable": true,
  "plural": false,
  "type": "String"
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "PromptLatestVersionsListTestQuery",
    "selections": [
      {
        "alias": "prompt",
        "args": (v0/*:: as any*/),
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
                "name": "PromptLatestVersionsListFragment"
              }
            ],
            "type": "Prompt",
            "abstractKey": null
          }
        ],
        "storageKey": "node(id:\"test-prompt-id\")"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "PromptLatestVersionsListTestQuery",
    "selections": [
      {
        "alias": "prompt",
        "args": (v0/*:: as any*/),
        "concreteType": null,
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
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": "latestVersions",
                "args": [
                  {
                    "kind": "Literal",
                    "name": "first",
                    "value": 5
                  }
                ],
                "concreteType": "PromptVersionConnection",
                "kind": "LinkedField",
                "name": "promptVersions",
                "plural": false,
                "selections": [
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
                        "name": "hasNextPage",
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "PromptVersionEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": "version",
                        "args": null,
                        "concreteType": "PromptVersion",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v1/*:: as any*/),
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
                            "kind": "ScalarField",
                            "name": "sequenceNumber",
                            "storageKey": null
                          },
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
                            "concreteType": "User",
                            "kind": "LinkedField",
                            "name": "user",
                            "plural": false,
                            "selections": [
                              (v1/*:: as any*/),
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
                              }
                            ],
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "PromptVersionTag",
                            "kind": "LinkedField",
                            "name": "tags",
                            "plural": true,
                            "selections": [
                              (v1/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "name",
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
                "storageKey": "promptVersions(first:5)"
              }
            ],
            "type": "Prompt",
            "abstractKey": null
          },
          (v1/*:: as any*/)
        ],
        "storageKey": "node(id:\"test-prompt-id\")"
      }
    ]
  },
  "params": {
    "cacheID": "eb45a9078298ff1f44f04f0235cef636",
    "id": null,
    "metadata": {
      "relayTestingSelectionTypeInfo": {
        "prompt": {
          "enumValues": null,
          "nullable": false,
          "plural": false,
          "type": "Node"
        },
        "prompt.__typename": (v2/*:: as any*/),
        "prompt.id": (v3/*:: as any*/),
        "prompt.latestVersions": {
          "enumValues": null,
          "nullable": false,
          "plural": false,
          "type": "PromptVersionConnection"
        },
        "prompt.latestVersions.edges": {
          "enumValues": null,
          "nullable": false,
          "plural": true,
          "type": "PromptVersionEdge"
        },
        "prompt.latestVersions.edges.version": {
          "enumValues": null,
          "nullable": false,
          "plural": false,
          "type": "PromptVersion"
        },
        "prompt.latestVersions.edges.version.createdAt": {
          "enumValues": null,
          "nullable": false,
          "plural": false,
          "type": "DateTime"
        },
        "prompt.latestVersions.edges.version.description": (v4/*:: as any*/),
        "prompt.latestVersions.edges.version.id": (v3/*:: as any*/),
        "prompt.latestVersions.edges.version.sequenceNumber": {
          "enumValues": null,
          "nullable": false,
          "plural": false,
          "type": "Int"
        },
        "prompt.latestVersions.edges.version.tags": {
          "enumValues": null,
          "nullable": false,
          "plural": true,
          "type": "PromptVersionTag"
        },
        "prompt.latestVersions.edges.version.tags.id": (v3/*:: as any*/),
        "prompt.latestVersions.edges.version.tags.name": {
          "enumValues": null,
          "nullable": false,
          "plural": false,
          "type": "Identifier"
        },
        "prompt.latestVersions.edges.version.user": {
          "enumValues": null,
          "nullable": true,
          "plural": false,
          "type": "User"
        },
        "prompt.latestVersions.edges.version.user.id": (v3/*:: as any*/),
        "prompt.latestVersions.edges.version.user.profilePictureUrl": (v4/*:: as any*/),
        "prompt.latestVersions.edges.version.user.username": (v2/*:: as any*/),
        "prompt.latestVersions.pageInfo": {
          "enumValues": null,
          "nullable": false,
          "plural": false,
          "type": "PageInfo"
        },
        "prompt.latestVersions.pageInfo.hasNextPage": {
          "enumValues": null,
          "nullable": false,
          "plural": false,
          "type": "Boolean"
        }
      }
    },
    "name": "PromptLatestVersionsListTestQuery",
    "operationKind": "query",
    "text": "query PromptLatestVersionsListTestQuery {\n  prompt: node(id: \"test-prompt-id\") {\n    __typename\n    ... on Prompt {\n      ...PromptLatestVersionsListFragment\n    }\n    id\n  }\n}\n\nfragment PromptLatestVersionsListFragment on Prompt {\n  latestVersions: promptVersions(first: 5) {\n    pageInfo {\n      hasNextPage\n    }\n    edges {\n      version: node {\n        id\n        ...PromptVersionSummaryFragment\n      }\n    }\n  }\n}\n\nfragment PromptVersionSummaryFragment on PromptVersion {\n  id\n  description\n  sequenceNumber\n  createdAt\n  user {\n    id\n    username\n    profilePictureUrl\n  }\n  tags {\n    id\n  }\n  ...PromptVersionTagsList_data\n}\n\nfragment PromptVersionTagsList_data on PromptVersion {\n  tags {\n    id\n    name\n  }\n}\n"
  }
};
})();

(node as any).hash = "49af098691b605042f8244455b61cb59";

export default node;
