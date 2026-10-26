/**
 * @generated SignedSource<<905c0aeae5a24b5aa47bdf119c41de25>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TagDecisionVersionButtonSetTagMutation$variables = {
  description?: string | null;
  name: string;
  versionId: string;
};
export type TagDecisionVersionButtonSetTagMutation$data = {
  readonly setDecisionVersionTag: {
    readonly decision: {
      readonly versionTags: ReadonlyArray<{
        readonly id: string;
        readonly name: string;
      }>;
      readonly " $fragmentSpreads": FragmentRefs<"DecisionLatestVersionsListFragment" | "DecisionVersionTagsConfigCard_data" | "DecisionVersionsList__main">;
    };
    readonly decisionVersionTag: {
      readonly decisionVersionId: string;
      readonly description: string | null;
      readonly id: string;
      readonly name: string;
    } | null;
  };
};
export type TagDecisionVersionButtonSetTagMutation = {
  response: TagDecisionVersionButtonSetTagMutation$data;
  variables: TagDecisionVersionButtonSetTagMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "description"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "name"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "versionId"
},
v3 = [
  {
    "fields": [
      {
        "kind": "Variable",
        "name": "decisionVersionId",
        "variableName": "versionId"
      },
      {
        "kind": "Variable",
        "name": "description",
        "variableName": "description"
      },
      {
        "kind": "Variable",
        "name": "name",
        "variableName": "name"
      }
    ],
    "kind": "ObjectValue",
    "name": "input"
  }
],
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
  (v4/*:: as any*/),
  (v5/*:: as any*/),
  (v6/*:: as any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "decisionVersionId",
    "storageKey": null
  }
],
v8 = {
  "alias": null,
  "args": null,
  "concreteType": "DecisionVersionTag",
  "kind": "LinkedField",
  "name": "decisionVersionTag",
  "plural": false,
  "selections": (v7/*:: as any*/),
  "storageKey": null
},
v9 = [
  (v4/*:: as any*/),
  (v5/*:: as any*/)
],
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sequenceNumber",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "concreteType": "User",
  "kind": "LinkedField",
  "name": "user",
  "plural": false,
  "selections": [
    (v4/*:: as any*/),
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
v13 = {
  "alias": null,
  "args": null,
  "concreteType": "DecisionVersionTag",
  "kind": "LinkedField",
  "name": "tags",
  "plural": true,
  "selections": (v9/*:: as any*/),
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "TagDecisionVersionButtonSetTagMutation",
    "selections": [
      {
        "alias": null,
        "args": (v3/*:: as any*/),
        "concreteType": "DecisionVersionTagMutationPayload",
        "kind": "LinkedField",
        "name": "setDecisionVersionTag",
        "plural": false,
        "selections": [
          (v8/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "Decision",
            "kind": "LinkedField",
            "name": "decision",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "DecisionVersionTag",
                "kind": "LinkedField",
                "name": "versionTags",
                "plural": true,
                "selections": (v9/*:: as any*/),
                "storageKey": null
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "DecisionVersionsList__main"
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "DecisionLatestVersionsListFragment"
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "DecisionVersionTagsConfigCard_data"
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
      (v2/*:: as any*/),
      (v1/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "TagDecisionVersionButtonSetTagMutation",
    "selections": [
      {
        "alias": null,
        "args": (v3/*:: as any*/),
        "concreteType": "DecisionVersionTagMutationPayload",
        "kind": "LinkedField",
        "name": "setDecisionVersionTag",
        "plural": false,
        "selections": [
          (v8/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "Decision",
            "kind": "LinkedField",
            "name": "decision",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "DecisionVersionTag",
                "kind": "LinkedField",
                "name": "versionTags",
                "plural": true,
                "selections": (v7/*:: as any*/),
                "storageKey": null
              },
              {
                "alias": null,
                "args": [
                  {
                    "kind": "Literal",
                    "name": "first",
                    "value": 100
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
                        "alias": "version",
                        "args": null,
                        "concreteType": "DecisionVersion",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v4/*:: as any*/),
                          (v6/*:: as any*/),
                          (v10/*:: as any*/),
                          (v11/*:: as any*/),
                          (v12/*:: as any*/),
                          (v13/*:: as any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": "versions(first:100)"
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
                        "alias": "version",
                        "args": null,
                        "concreteType": "DecisionVersion",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v4/*:: as any*/),
                          (v10/*:: as any*/),
                          (v6/*:: as any*/),
                          (v11/*:: as any*/),
                          (v12/*:: as any*/),
                          (v13/*:: as any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": "versions(first:5)"
              },
              (v4/*:: as any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "cdc4516c7261ba335ebd7ecfa0e7a4b7",
    "id": null,
    "metadata": {},
    "name": "TagDecisionVersionButtonSetTagMutation",
    "operationKind": "mutation",
    "text": "mutation TagDecisionVersionButtonSetTagMutation(\n  $versionId: ID!\n  $name: Identifier!\n  $description: String\n) {\n  setDecisionVersionTag(input: {decisionVersionId: $versionId, name: $name, description: $description}) {\n    decisionVersionTag {\n      id\n      name\n      description\n      decisionVersionId\n    }\n    decision {\n      versionTags {\n        id\n        name\n      }\n      ...DecisionVersionsList__main\n      ...DecisionLatestVersionsListFragment\n      ...DecisionVersionTagsConfigCard_data\n      id\n    }\n  }\n}\n\nfragment DecisionLatestVersionsListFragment on Decision {\n  latestVersions: versions(first: 5) {\n    edges {\n      version: node {\n        id\n        sequenceNumber\n        ...DecisionVersionSummaryFragment\n      }\n    }\n  }\n}\n\nfragment DecisionVersionSummaryFragment on DecisionVersion {\n  id\n  description\n  sequenceNumber\n  createdAt\n  user {\n    id\n    username\n    profilePictureUrl\n  }\n  ...DecisionVersionTagsList_data\n}\n\nfragment DecisionVersionTagsConfigCard_data on Decision {\n  id\n  versionTags {\n    id\n    name\n    description\n    decisionVersionId\n  }\n}\n\nfragment DecisionVersionTagsList_data on DecisionVersion {\n  tags {\n    id\n    name\n  }\n}\n\nfragment DecisionVersionsList__main on Decision {\n  versions(first: 100) {\n    edges {\n      version: node {\n        id\n        ...DecisionVersionSummaryFragment\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "b2ffb8667661807f5d9cf241b55548f2";

export default node;
