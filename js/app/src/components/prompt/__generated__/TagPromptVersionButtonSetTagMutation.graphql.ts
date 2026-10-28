/**
 * @generated SignedSource<<9a1b343b8fe9592f7f0a51b69d411933>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SetPromptVersionTagInput = {
  description?: string | null;
  name: string;
  promptVersionId: string;
};
export type TagPromptVersionButtonSetTagMutation$variables = {
  input: SetPromptVersionTagInput;
  promptId: string;
};
export type TagPromptVersionButtonSetTagMutation$data = {
  readonly setPromptVersionTag: {
    readonly promptVersionTag: {
      readonly id: string;
    } | null;
    readonly query: {
      readonly prompt: {
        readonly " $fragmentSpreads": FragmentRefs<"PromptVersionTagsConfig_data">;
      };
    };
  };
};
export type TagPromptVersionButtonSetTagMutation = {
  response: TagPromptVersionButtonSetTagMutation$data;
  variables: TagPromptVersionButtonSetTagMutation$variables;
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
  "concreteType": "PromptVersionTag",
  "kind": "LinkedField",
  "name": "promptVersionTag",
  "plural": false,
  "selections": [
    (v2/*:: as any*/)
  ],
  "storageKey": null
},
v4 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "promptId"
  }
],
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
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "TagPromptVersionButtonSetTagMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "PromptVersionTagMutationPayload",
        "kind": "LinkedField",
        "name": "setPromptVersionTag",
        "plural": false,
        "selections": [
          (v3/*:: as any*/),
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
                "args": (v4/*:: as any*/),
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
    "name": "TagPromptVersionButtonSetTagMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "PromptVersionTagMutationPayload",
        "kind": "LinkedField",
        "name": "setPromptVersionTag",
        "plural": false,
        "selections": [
          (v3/*:: as any*/),
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
                "args": (v4/*:: as any*/),
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
                  (v2/*:: as any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "PromptVersionTag",
                        "kind": "LinkedField",
                        "name": "versionTags",
                        "plural": true,
                        "selections": [
                          (v2/*:: as any*/),
                          (v5/*:: as any*/),
                          (v6/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "PromptVersion",
                            "kind": "LinkedField",
                            "name": "promptVersion",
                            "plural": false,
                            "selections": [
                              (v2/*:: as any*/),
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
                                  (v2/*:: as any*/),
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
                                  (v2/*:: as any*/),
                                  (v5/*:: as any*/)
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
    "cacheID": "2a6568430ea3041967db43f24ba1e828",
    "id": null,
    "metadata": {},
    "name": "TagPromptVersionButtonSetTagMutation",
    "operationKind": "mutation",
    "text": "mutation TagPromptVersionButtonSetTagMutation(\n  $input: SetPromptVersionTagInput!\n  $promptId: ID!\n) {\n  setPromptVersionTag(input: $input) {\n    promptVersionTag {\n      id\n    }\n    query {\n      prompt: node(id: $promptId) {\n        __typename\n        ... on Prompt {\n          ...PromptVersionTagsConfig_data\n        }\n        id\n      }\n    }\n  }\n}\n\nfragment PromptVersionSummaryFragment on PromptVersion {\n  id\n  description\n  sequenceNumber\n  createdAt\n  user {\n    id\n    username\n    profilePictureUrl\n  }\n  tags {\n    id\n    name\n  }\n}\n\nfragment PromptVersionTagsConfig_data on Prompt {\n  id\n  versionTags {\n    id\n    name\n    description\n    promptVersion {\n      id\n      ...PromptVersionSummaryFragment\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "789d130891fe7c812b8990fdbd4bd58a";

export default node;
