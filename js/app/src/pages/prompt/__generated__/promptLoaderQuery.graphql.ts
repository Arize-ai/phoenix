/**
 * @generated SignedSource<<db9d0d472e8c3f0ebd6deba6dd8be6c1>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type promptLoaderQuery$variables = {
  id: string;
};
export type promptLoaderQuery$data = {
  readonly prompt: {
    readonly __typename: string;
    readonly id: string;
    readonly name?: string;
    readonly " $fragmentSpreads": FragmentRefs<"PromptLayout__main" | "PromptVersionDetailsPage__prompt" | "PromptVersionsPageContent__main">;
  };
};
export type promptLoaderQuery = {
  response: promptLoaderQuery$data;
  variables: promptLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
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
    "concreteType": "PromptVersionEdge",
    "kind": "LinkedField",
    "name": "edges",
    "plural": true,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "PromptVersion",
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v3/*:: as any*/)
        ],
        "storageKey": null
      }
    ],
    "storageKey": null
  }
],
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v7 = [
  (v3/*:: as any*/),
  (v4/*:: as any*/)
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "promptLoaderQuery",
    "selections": [
      {
        "alias": "prompt",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          (v3/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*:: as any*/),
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "PromptVersionsPageContent__main"
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "PromptVersionDetailsPage__prompt"
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "PromptLayout__main"
              }
            ],
            "type": "Prompt",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "promptLoaderQuery",
    "selections": [
      {
        "alias": "prompt",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          (v3/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*:: as any*/),
              {
                "alias": "latestVersion",
                "args": [
                  {
                    "kind": "Literal",
                    "name": "first",
                    "value": 1
                  }
                ],
                "concreteType": "PromptVersionConnection",
                "kind": "LinkedField",
                "name": "promptVersions",
                "plural": false,
                "selections": (v5/*:: as any*/),
                "storageKey": "promptVersions(first:1)"
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "PromptVersionConnection",
                "kind": "LinkedField",
                "name": "promptVersions",
                "plural": false,
                "selections": [
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
                          (v3/*:: as any*/),
                          (v6/*:: as any*/),
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
                              (v3/*:: as any*/),
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
                            "selections": (v7/*:: as any*/),
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
              },
              {
                "alias": "latestVersions",
                "args": [
                  {
                    "kind": "Literal",
                    "name": "first",
                    "value": 2
                  }
                ],
                "concreteType": "PromptVersionConnection",
                "kind": "LinkedField",
                "name": "promptVersions",
                "plural": false,
                "selections": (v5/*:: as any*/),
                "storageKey": "promptVersions(first:2)"
              },
              (v6/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "metadata",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "PromptLabel",
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
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "Prompt",
                "kind": "LinkedField",
                "name": "sourcePrompt",
                "plural": false,
                "selections": (v7/*:: as any*/),
                "storageKey": null
              }
            ],
            "type": "Prompt",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "4ea153b6c24fa463b0d49699b9250d77",
    "id": null,
    "metadata": {},
    "name": "promptLoaderQuery",
    "operationKind": "query",
    "text": "query promptLoaderQuery(\n  $id: ID!\n) {\n  prompt: node(id: $id) {\n    __typename\n    id\n    ... on Prompt {\n      name\n      ...PromptVersionsPageContent__main\n      ...PromptVersionDetailsPage__prompt\n      ...PromptLayout__main\n    }\n  }\n}\n\nfragment PromptLayout__main on Prompt {\n  id\n  name\n  description\n  metadata\n  labels {\n    id\n    name\n    color\n  }\n  sourcePrompt {\n    id\n    name\n  }\n  latestVersion: promptVersions(first: 1) {\n    edges {\n      node {\n        id\n      }\n    }\n  }\n}\n\nfragment PromptVersionDetailsPage__prompt on Prompt {\n  latestVersions: promptVersions(first: 2) {\n    edges {\n      node {\n        id\n      }\n    }\n  }\n  ...PromptVersionDiffPicker__versions\n}\n\nfragment PromptVersionDiffPicker__versions on Prompt {\n  promptVersions {\n    edges {\n      version: node {\n        id\n        sequenceNumber\n        description\n        tags {\n          name\n          id\n        }\n        user {\n          username\n          id\n        }\n        ...PromptVersionSummaryFragment\n      }\n    }\n  }\n}\n\nfragment PromptVersionSummaryFragment on PromptVersion {\n  id\n  description\n  sequenceNumber\n  createdAt\n  user {\n    id\n    username\n    profilePictureUrl\n  }\n  tags {\n    id\n    name\n  }\n}\n\nfragment PromptVersionsList__main on Prompt {\n  promptVersions {\n    edges {\n      version: node {\n        id\n        ...PromptVersionSummaryFragment\n      }\n    }\n  }\n}\n\nfragment PromptVersionsPageContent__main on Prompt {\n  latestVersion: promptVersions(first: 1) {\n    edges {\n      node {\n        id\n      }\n    }\n  }\n  ...PromptVersionsList__main\n}\n"
  }
};
})();

(node as any).hash = "cf4a910335d61685bd17d54e364b3109";

export default node;
