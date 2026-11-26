/**
 * @generated SignedSource<<8f61efb2ea9c98f1a4d2f8f965afe917>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DecisionPageQuery$variables = {
  id: string;
  versionId?: string | null;
};
export type DecisionPageQuery$data = {
  readonly decision: {
    readonly __typename: "Decision";
    readonly description: string | null;
    readonly id: string;
    readonly metadata: any;
    readonly name: string;
    readonly sourceDecision: {
      readonly id: string;
      readonly name: string;
    } | null;
    readonly version: {
      readonly id: string;
      readonly " $fragmentSpreads": FragmentRefs<"DecisionVersionDetails_version">;
    } | null;
    readonly versionCount: number;
    readonly versionTags: ReadonlyArray<{
      readonly decisionVersionId: string;
      readonly description: string | null;
      readonly id: string;
      readonly name: string;
    }>;
    readonly " $fragmentSpreads": FragmentRefs<"DecisionLabels" | "DecisionLatestVersionsList_decision" | "DecisionVersionsList_versions">;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type DecisionPageQuery = {
  response: DecisionPageQuery$data;
  variables: DecisionPageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "versionId"
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
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "metadata",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "versionCount",
  "storageKey": null
},
v8 = [
  (v3/*:: as any*/),
  (v4/*:: as any*/)
],
v9 = {
  "alias": null,
  "args": null,
  "concreteType": "Decision",
  "kind": "LinkedField",
  "name": "sourceDecision",
  "plural": false,
  "selections": (v8/*:: as any*/),
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "concreteType": "DecisionVersionTag",
  "kind": "LinkedField",
  "name": "versionTags",
  "plural": true,
  "selections": [
    (v3/*:: as any*/),
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
v11 = [
  {
    "kind": "Variable",
    "name": "versionId",
    "variableName": "versionId"
  }
],
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sequenceNumber",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "concreteType": "User",
  "kind": "LinkedField",
  "name": "user",
  "plural": false,
  "selections": [
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
  ],
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "concreteType": "DecisionVersionTag",
  "kind": "LinkedField",
  "name": "tags",
  "plural": true,
  "selections": (v8/*:: as any*/),
  "storageKey": null
},
v16 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 50
  }
],
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "templateFormat",
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "variables",
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "state",
  "plural": false,
  "selections": [
    (v2/*:: as any*/),
    {
      "kind": "InlineFragment",
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "text",
          "storageKey": null
        }
      ],
      "type": "DecisionTextState",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "json",
          "storageKey": null
        }
      ],
      "type": "DecisionJsonState",
      "abstractKey": null
    }
  ],
  "storageKey": null
},
v20 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "instructions",
  "storageKey": null
},
v21 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "questions",
  "plural": true,
  "selections": [
    (v2/*:: as any*/),
    {
      "kind": "InlineFragment",
      "selections": [
        (v4/*:: as any*/),
        (v20/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "concreteType": "DecisionPredicateCriteria",
          "kind": "LinkedField",
          "name": "criteria",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "true",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "false",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "type": "DecisionPredicateQuestion",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": [
        (v4/*:: as any*/),
        (v20/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "concreteType": "DecisionChoiceOption",
          "kind": "LinkedField",
          "name": "choices",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "value",
              "storageKey": null
            },
            (v5/*:: as any*/)
          ],
          "storageKey": null
        }
      ],
      "type": "DecisionChoiceQuestion",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": [
        (v4/*:: as any*/),
        (v20/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "concreteType": "DecisionScaleLevel",
          "kind": "LinkedField",
          "name": "levels",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "label",
              "storageKey": null
            },
            (v5/*:: as any*/)
          ],
          "storageKey": null
        }
      ],
      "type": "DecisionScaleQuestion",
      "abstractKey": null
    }
  ],
  "storageKey": null
},
v22 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelName",
  "storageKey": null
},
v23 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelProvider",
  "storageKey": null
},
v24 = {
  "alias": null,
  "args": null,
  "concreteType": "GenerativeModelCustomProvider",
  "kind": "LinkedField",
  "name": "customProvider",
  "plural": false,
  "selections": (v8/*:: as any*/),
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DecisionPageQuery",
    "selections": [
      {
        "alias": "decision",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*:: as any*/),
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              (v6/*:: as any*/),
              (v7/*:: as any*/),
              (v9/*:: as any*/),
              (v10/*:: as any*/),
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "DecisionLabels"
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "DecisionLatestVersionsList_decision"
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "DecisionVersionsList_versions"
              },
              {
                "alias": null,
                "args": (v11/*:: as any*/),
                "concreteType": "DecisionVersion",
                "kind": "LinkedField",
                "name": "version",
                "plural": false,
                "selections": [
                  (v3/*:: as any*/),
                  {
                    "args": null,
                    "kind": "FragmentSpread",
                    "name": "DecisionVersionDetails_version"
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "Decision",
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
    "name": "DecisionPageQuery",
    "selections": [
      {
        "alias": "decision",
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
              (v5/*:: as any*/),
              (v6/*:: as any*/),
              (v7/*:: as any*/),
              (v9/*:: as any*/),
              (v10/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "DecisionLabel",
                "kind": "LinkedField",
                "name": "labels",
                "plural": true,
                "selections": [
                  (v4/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "color",
                    "storageKey": null
                  },
                  (v3/*:: as any*/)
                ],
                "storageKey": null
              },
              {
                "alias": "latestVersions",
                "args": [
                  {
                    "kind": "Literal",
                    "name": "first",
                    "value": 5
                  }
                ],
                "concreteType": "DecisionVersionConnection",
                "kind": "LinkedField",
                "name": "versions",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "DecisionVersionEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "DecisionVersion",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v3/*:: as any*/),
                          (v12/*:: as any*/),
                          (v5/*:: as any*/),
                          (v13/*:: as any*/),
                          (v14/*:: as any*/),
                          (v15/*:: as any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": "versions(first:5)"
              },
              {
                "alias": "pagedVersions",
                "args": (v16/*:: as any*/),
                "concreteType": "DecisionVersionConnection",
                "kind": "LinkedField",
                "name": "versions",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "DecisionVersionEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "DecisionVersion",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v3/*:: as any*/),
                          (v5/*:: as any*/),
                          (v12/*:: as any*/),
                          (v13/*:: as any*/),
                          (v14/*:: as any*/),
                          (v15/*:: as any*/),
                          (v2/*:: as any*/)
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
                  }
                ],
                "storageKey": "versions(first:50)"
              },
              {
                "alias": "pagedVersions",
                "args": (v16/*:: as any*/),
                "filters": null,
                "handle": "connection",
                "key": "DecisionVersionsList_pagedVersions",
                "kind": "LinkedHandle",
                "name": "versions"
              },
              {
                "alias": null,
                "args": (v11/*:: as any*/),
                "concreteType": "DecisionVersion",
                "kind": "LinkedField",
                "name": "version",
                "plural": false,
                "selections": [
                  (v3/*:: as any*/),
                  (v6/*:: as any*/),
                  (v15/*:: as any*/),
                  (v17/*:: as any*/),
                  (v18/*:: as any*/),
                  (v19/*:: as any*/),
                  (v21/*:: as any*/),
                  (v22/*:: as any*/),
                  (v23/*:: as any*/),
                  (v24/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "DecisionVersion",
                    "kind": "LinkedField",
                    "name": "previousVersion",
                    "plural": false,
                    "selections": [
                      (v3/*:: as any*/),
                      (v17/*:: as any*/),
                      (v18/*:: as any*/),
                      (v19/*:: as any*/),
                      (v21/*:: as any*/),
                      (v22/*:: as any*/),
                      (v23/*:: as any*/),
                      (v24/*:: as any*/)
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "Decision",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "8a522638b5a54b58f5aec10807740e08",
    "id": null,
    "metadata": {},
    "name": "DecisionPageQuery",
    "operationKind": "query",
    "text": "query DecisionPageQuery(\n  $id: ID!\n  $versionId: ID\n) {\n  decision: node(id: $id) {\n    __typename\n    ... on Decision {\n      id\n      name\n      description\n      metadata\n      versionCount\n      sourceDecision {\n        id\n        name\n      }\n      versionTags {\n        id\n        name\n        description\n        decisionVersionId\n      }\n      ...DecisionLabels\n      ...DecisionLatestVersionsList_decision\n      ...DecisionVersionsList_versions\n      version(versionId: $versionId) {\n        id\n        ...DecisionVersionDetails_version\n      }\n    }\n    id\n  }\n}\n\nfragment DecisionLabels on Decision {\n  labels {\n    name\n    color\n    id\n  }\n}\n\nfragment DecisionLatestVersionsList_decision on Decision {\n  id\n  latestVersions: versions(first: 5) {\n    edges {\n      node {\n        id\n        sequenceNumber\n        ...DecisionVersionSummary_version\n      }\n    }\n  }\n}\n\nfragment DecisionVersionDetails_definition on DecisionVersion {\n  templateFormat\n  variables\n  state {\n    __typename\n    ... on DecisionTextState {\n      text\n    }\n    ... on DecisionJsonState {\n      json\n    }\n  }\n  questions {\n    __typename\n    ... on DecisionPredicateQuestion {\n      name\n      instructions\n      criteria {\n        true\n        false\n      }\n    }\n    ... on DecisionChoiceQuestion {\n      name\n      instructions\n      choices {\n        value\n        description\n      }\n    }\n    ... on DecisionScaleQuestion {\n      name\n      instructions\n      levels {\n        label\n        description\n      }\n    }\n  }\n  modelName\n  modelProvider\n  customProvider {\n    id\n    name\n  }\n}\n\nfragment DecisionVersionDetails_version on DecisionVersion {\n  id\n  metadata\n  tags {\n    id\n    name\n  }\n  ...DecisionVersionDetails_definition\n  previousVersion {\n    id\n    ...DecisionVersionDetails_definition\n  }\n}\n\nfragment DecisionVersionSummary_version on DecisionVersion {\n  id\n  description\n  sequenceNumber\n  createdAt\n  user {\n    username\n    profilePictureUrl\n    id\n  }\n  tags {\n    id\n    name\n  }\n}\n\nfragment DecisionVersionsList_versions on Decision {\n  pagedVersions: versions(first: 50) {\n    edges {\n      node {\n        id\n        ...DecisionVersionSummary_version\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  id\n}\n"
  }
};
})();

(node as any).hash = "3e3d8328b59949e0bf12fdab34d8cbf7";

export default node;
