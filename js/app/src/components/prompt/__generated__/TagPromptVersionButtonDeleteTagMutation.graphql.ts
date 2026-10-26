/**
 * @generated SignedSource<<37155404a93bcc126477a7b11c9a16ca>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DeletePromptVersionTagInput = {
  promptVersionTagId: string;
};
export type TagPromptVersionButtonDeleteTagMutation$variables = {
  input: DeletePromptVersionTagInput;
  promptId: string;
};
export type TagPromptVersionButtonDeleteTagMutation$data = {
  readonly deletePromptVersionTag: {
    readonly query: {
      readonly prompt: {
        readonly " $fragmentSpreads": FragmentRefs<"PromptVersionTagsConfig_data" | "PromptVersionsList__main">;
      };
    };
  };
};
export type TagPromptVersionButtonDeleteTagMutation = {
  response: TagPromptVersionButtonDeleteTagMutation$data;
  variables: TagPromptVersionButtonDeleteTagMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "promptId"
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
    "kind": "Variable",
    "name": "id",
    "variableName": "promptId"
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
  "name": "description",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v6 = [
  (v3/*:: as any*/),
  (v4/*:: as any*/),
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
    "selections": [
      (v3/*:: as any*/),
      (v5/*:: as any*/)
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "TagPromptVersionButtonDeleteTagMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "PromptVersionTagMutationPayload",
        "kind": "LinkedField",
        "name": "deletePromptVersionTag",
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
                "alias": "prompt",
                "args": (v2/*:: as any*/),
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
                        "name": "PromptVersionsList__main"
                      },
                      {
                        "args": null,
                        "kind": "FragmentSpread",
                        "name": "PromptVersionTagsConfig_data"
                      }
                    ],
                    "type": "Prompt",
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "TagPromptVersionButtonDeleteTagMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "PromptVersionTagMutationPayload",
        "kind": "LinkedField",
        "name": "deletePromptVersionTag",
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
                "alias": "prompt",
                "args": (v2/*:: as any*/),
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
                  (v3/*:: as any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
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
                                "selections": (v6/*:: as any*/),
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
                        "concreteType": "PromptVersionTag",
                        "kind": "LinkedField",
                        "name": "versionTags",
                        "plural": true,
                        "selections": [
                          (v3/*:: as any*/),
                          (v5/*:: as any*/),
                          (v4/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "PromptVersion",
                            "kind": "LinkedField",
                            "name": "promptVersion",
                            "plural": false,
                            "selections": (v6/*:: as any*/),
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "type": "Prompt",
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
    "cacheID": "192ea763b2987fd632d9bdff5e74dbed",
    "id": null,
    "metadata": {},
    "name": "TagPromptVersionButtonDeleteTagMutation",
    "operationKind": "mutation",
    "text": "mutation TagPromptVersionButtonDeleteTagMutation(\n  $input: DeletePromptVersionTagInput!\n  $promptId: ID!\n) {\n  deletePromptVersionTag(input: $input) {\n    query {\n      prompt: node(id: $promptId) {\n        __typename\n        ... on Prompt {\n          ...PromptVersionsList__main\n          ...PromptVersionTagsConfig_data\n        }\n        id\n      }\n    }\n  }\n}\n\nfragment PromptVersionSummaryFragment on PromptVersion {\n  id\n  description\n  sequenceNumber\n  createdAt\n  user {\n    id\n    username\n    profilePictureUrl\n  }\n  tags {\n    id\n    name\n  }\n}\n\nfragment PromptVersionTagsConfig_data on Prompt {\n  id\n  versionTags {\n    id\n    name\n    description\n    promptVersion {\n      id\n      ...PromptVersionSummaryFragment\n    }\n  }\n}\n\nfragment PromptVersionsList__main on Prompt {\n  promptVersions {\n    edges {\n      version: node {\n        id\n        ...PromptVersionSummaryFragment\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "2c578fc716794eed4261d5fffb833ac0";

export default node;
